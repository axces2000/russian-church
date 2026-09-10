// functions/index.js
//
// Two authenticated callable Cloud Functions:
//   findCanonLink(query)       — candidate pages with the canon's actual text
//   findWikiLink(dedication)   — candidate English Wikipedia article about
//                                 the saint/feast/icon named in the dedication
//
// These used to be one combined function, but running both grounded
// searches (each with a possible retry) inside a single invocation could
// add up to more wall-clock time than the function's execution budget
// allowed for — splitting them means each gets its own independent budget,
// and the client can show canon results as soon as they're ready instead of
// waiting for the slower of the two.
//
// IMPORTANT: these functions only *find links*. They do not write the
// announcement text — that's done deterministically in the client
// (see src/lib/canonReadingTemplate.ts) so wording never depends on an AI
// call succeeding or being phrased correctly.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
// Trailing slash forces resolution to the npm package rather than Node's
// own deprecated built-in module of the same name (require('punycode')
// without the slash silently resolves to core and prints a DEP0040 warning).
const punycode = require('punycode/');

admin.initializeApp();
setGlobalOptions({ region: 'australia-southeast1' });

// Stored in Secret Manager for production (see SETUP.md), and read from
// functions/.secret.local for the emulator.
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Swap this if Google renames/retires the model — check
// https://ai.google.dev/gemini-api/docs/models for current model IDs.
// (Updated Sept 2026: gemini-2.5-flash returns 404 "no longer available to
// new users" — Google's own error message recommends gemini-3.6-flash.)
const GEMINI_MODEL = 'gemini-3.6-flash';

const OTHER_CANON_DOMAINS = ['ruvera.ru', 'pravoslavie.ru'];
// Google's search index has this Cyrillic (IDN) domain under its punycode
// form, not the literal Unicode string — a `site:православный-молитвослов.рф`
// filter matches nothing even though the domain is well-indexed and has
// extensive content. Confirmed by directly searching `site:<this punycode>`
// and finding many real, indexed canon pages on the site.
const MOLITVOSLOV_DOMAIN_PUNYCODE = 'xn----7sbahbba0chrecjllhdbcuymu3s.xn--p1ai';
const WIKI_DOMAIN_HINT = 'wikipedia';

const NEGATIVE_TOKENS = ['NOT_FOUND', 'GENERAL'];

// Hard timeout per individual Gemini call. Kept well under the function's
// own timeoutSeconds so a stuck request fails with a clear error instead of
// silently hanging until something else kills the whole invocation.
// The "emphasized" retry (which forces a genuine live search rather than
// letting the model answer quickly from memory) is inherently heavier and
// gets a longer budget than the first attempt.
const GEMINI_CALL_TIMEOUT_MS = 50000;
const GEMINI_RETRY_TIMEOUT_MS = 50000;

// ── Auth ──────────────────────────────────────────────────────────────────
async function requireAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const adminDoc = await admin.firestore().doc(`admins/${request.auth.uid}`).get();
  if (!adminDoc.exists) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

// Shared opening used by both canon prompts below.
function canonPromptPreamble(query, emphasizeSearch) {
  const lines = [
    'You are helping locate the online text of an Orthodox Christian canon',
    '(канон) — a specific liturgical prayer text in Church Slavonic or Russian.',
    `The admin's approximate description of the canon is: "${query}"`,
    '',
    'You MUST use the Google Search tool for this — never answer from memory',
    'alone. A remembered URL for a page like this is very often wrong even when',
    'the domain and general topic are right: a mismatched file name, folder',
    'path, or transliteration is easy to misremember and easy to miss.',
    '',
    "The site's actual title for this canon is often longer and more formal",
    'than the phrase above — for example a canon described simply as',
    '"святителю Николаю Чудотворцу" is commonly titled in full as "святителю',
    'Николаю, архиепископу Мир Ликийских, Чудотворцу" on the actual page.',
    'Search using the core name/subject rather than requiring an exact phrase',
    'match, and treat a page with the same subject but a longer, more formal',
    'title as a match.',
  ];
  if (emphasizeSearch) {
    lines.push(
      'This is a retry: your previous answer did not come with a real search',
      'citation, meaning you likely answered from memory rather than actually',
      'calling the tool. Call it for real this time.'
    );
  }
  return lines;
}

// Searches azbyka.ru exclusively. Run as its own dedicated call (rather than
// as one option among several in a single combined prompt) so the parish's
// preferred, most reliable source is never simply skipped by a model that
// chose to spend its search budget elsewhere.
function buildAzbykaCanonPrompt(query, { emphasizeSearch } = {}) {
  const lines = canonPromptPreamble(query, emphasizeSearch);
  lines.push(
    '',
    `Search specifically on azbyka.ru — run: site:azbyka.ru ${query}`,
    "azbyka.ru is this parish's preferred, most reliable source and should be",
    'offered first whenever it has this canon.',
    '',
    'If azbyka.ru does not have this canon, respond with exactly the single',
    'word: NOT_FOUND',
    '',
    'Otherwise respond in exactly this format and nothing else:',
    'TITLE: <short Russian title of the canon>',
    'URL: <the direct azbyka.ru URL to the page with the canon text>'
  );
  return lines.join('\n');
}

// Searches православный-молитвослов.рф exclusively — same rationale as the
// dedicated azbyka search above: a specific site the admin wants reliably
// offered as an alternative shouldn't be left to chance as just one example
// buried inside a broader multi-site prompt.
function buildMolitvoslovCanonPrompt(query, { emphasizeSearch } = {}) {
  const lines = canonPromptPreamble(query, emphasizeSearch);
  lines.push(
    '',
    'Search specifically on the site православный-молитвослов.рф — its',
    "domain is indexed by Google under its punycode form, so run exactly:",
    `  site:${MOLITVOSLOV_DOMAIN_PUNYCODE} ${query}`,
    '(that site: value is correct even though it looks like gibberish — do',
    'not substitute the Cyrillic domain name in the site: filter itself)',
    '',
    'If that site does not have this canon, respond with exactly the single',
    'word: NOT_FOUND',
    '',
    'Otherwise respond in exactly this format and nothing else:',
    'TITLE: <short Russian title of the canon>',
    'URL: <the direct URL on that site to the page with the canon text>'
  );
  return lines.join('\n');
}

// Searches everywhere else. azbyka.ru and православный-молитвослов.рф are
// deliberately out of scope here — each is covered by its own dedicated
// search above — so this one's whole purpose is to surface further genuine
// alternatives beyond those two.
function buildOtherCanonSourcesPrompt(query, { emphasizeSearch } = {}) {
  const lines = canonPromptPreamble(query, emphasizeSearch);
  lines.push(
    '',
    'azbyka.ru and православный-молитвослов.рф are being checked separately',
    'by other searches, so focus here on OTHER sites only. Run several',
    'separate searches, each targeting a different specific site, for',
    'example:',
    `  site:ruvera.ru ${query}`,
    `  site:pravoslavie.ru ${query}`,
    `  ${query} текст канона`,
    'plus one general (not site-restricted, but excluding azbyka.ru and',
    'православный-молитвослов.рф) search.',
    'The admin wants alternatives to compare against azbyka.ru, since azbyka',
    'sometimes interleaves a Russian translation line-by-line with the Church',
    'Slavonic text, which is harder to read than a clean, uninterrupted text.',
    '',
    'If you cannot find a specific, confident match, respond with exactly',
    'the single word: NOT_FOUND',
    '',
    'Otherwise respond in exactly this format and nothing else, naming your',
    'single best result (every other page you searched is already captured',
    'automatically through your search citations, so you do not need to list',
    'them here):',
    'TITLE: <short Russian title of the canon>',
    'URL: <the direct URL to the page with the canon text>'
  );
  return lines.join('\n');
}

function buildWikiPrompt(dedication, { emphasizeSearch } = {}) {
  return [
    'You are finding the English Wikipedia article about the specific saint,',
    'feast, icon, or event named in this Orthodox Christian canon dedication',
    `(given in Russian, dative case): "${dedication}"`,
    '',
    emphasizeSearch
      ? 'You MUST call the Google Search tool to find the real English Wikipedia ' +
        'article before answering — do not answer from memory alone.'
      : 'Identify who or what this refers to, then find the single best',
    'matching English Wikipedia article about them.',
    '',
    'If this dedication is a general canon to the Lord, the Theotokos, or the',
    'Holy Trinity (i.e. not a specific named saint, icon, or feast), respond',
    'with exactly: GENERAL',
    '',
    'If you cannot find a matching English Wikipedia article, respond with',
    'exactly: NOT_FOUND',
    '',
    'Otherwise respond in exactly this format and nothing else:',
    'TITLE: <English name of the article>',
    'URL: <the en.wikipedia.org URL>',
  ].join('\n');
}

// Translates the already-generated Russian announcement into English. This
// is a plain translation task, not a research task — no search grounding
// needed, so it deliberately does not go through callGemini/runGroundedSearch
// below (which always request Google Search tooling for the link-finding
// searches).
function buildTranslationPrompt(html) {
  return [
    'Translate the following Orthodox Christian parish announcement from',
    'Russian into natural, clear English suitable for an English-speaking',
    'parishioner. It is an HTML fragment — preserve every HTML tag,',
    'attribute, and URL EXACTLY as written; translate only the human-',
    'readable Russian text found between the tags. Keep the same number of',
    '<p> elements and the same overall structure.',
    '',
    'Any text that is already in English (for example a line already',
    'reading something like "The story of ... (in English):") must be left',
    'completely unchanged — do not re-translate or alter it in any way.',
    '',
    'Respond with ONLY the translated HTML fragment and nothing else — no',
    'preamble, no explanation, no markdown code fences, no commentary.',
    '',
    'HTML to translate:',
    html,
  ].join('\n');
}

// ── Gemini call (with a hard per-request timeout) ───────────────────────────

async function callGemini(apiKey, prompt, timeoutMs = GEMINI_CALL_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
        signal: controller.signal,
      }
    );
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`Gemini API call timed out after ${timeoutMs}ms`);
      throw new HttpsError('deadline-exceeded', 'The search service took too long to respond.');
    }
    console.error('Network error calling Gemini API:', err);
    throw new HttpsError('unavailable', 'Could not reach the search service.');
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('Gemini API error:', resp.status, errText);
    throw new HttpsError('internal', 'The search service returned an error.');
  }

  return resp.json();
}

// Same shape as callGemini above, but deliberately without the
// google_search tool — translation is a pure language task and doesn't
// need it. Kept as a separate function rather than adding a flag to
// callGemini, so the grounded-search code path above (already carefully
// tuned) is never at risk of being touched by this.
async function callGeminiPlain(apiKey, prompt, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: controller.signal,
      }
    );
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`Gemini translation call timed out after ${timeoutMs}ms`);
      throw new HttpsError('deadline-exceeded', 'The translation service took too long to respond.');
    }
    console.error('Network error calling Gemini API (translation):', err);
    throw new HttpsError('unavailable', 'Could not reach the translation service.');
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('Gemini API error (translation):', resp.status, errText);
    throw new HttpsError('internal', 'The translation service returned an error.');
  }

  return resp.json();
}

// A model asked to "respond with only the HTML" will still sometimes wrap
// its answer in a markdown code fence anyway — strip that defensively.
function stripCodeFence(text) {
  return text.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim();
}

function extractText(candidate) {
  return (
    candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map((p) => p.text || '').join('')
      : ''
  ).trim();
}

function extractGroundingChunks(candidate) {
  const chunks = (candidate && candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) || [];
  return chunks.filter((c) => c.web && c.web.uri);
}

function isNegative(text) {
  return NEGATIVE_TOKENS.some((token) => text.trim() === token || text.includes(token));
}

// Both fetch()'s own URL normalization and the WHATWG URL parser store
// international domains as ASCII punycode (xn--...) and non-ASCII path
// segments as percent-encoded bytes — technically correct, but unreadable
// for a Cyrillic site like православный-молитвослов.рф. Converts a URL
// back to its human-readable form for display; browsers handle a literal
// Unicode URL in an href just fine; they encode it again on click.
function humanizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const unicodeHost = punycode.toUnicode(u.hostname);
    // decodeURI leaves structural delimiters (/ ? # & = etc.) untouched, so
    // it's safe to run over the already-parsed path+search+hash together.
    const rest = decodeURI(u.pathname + u.search + u.hash);
    return `${u.protocol}//${unicodeHost}${u.port ? ':' + u.port : ''}${rest}`;
  } catch (err) {
    console.error('Could not humanize URL for display:', rawUrl, err.message);
    return rawUrl; // fall back to whatever we had rather than crash
  }
}

// Grounding citations come back as Google-hosted redirect links
// (vertexaisearch.cloud.google.com/grounding-api-redirect/...) rather than
// the real page URL. They work fine to click, but look wrong to publish in
// a public announcement — so resolve the redirect server-side and hand back
// the actual (human-readable) destination instead.
async function resolveFinalUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (res.url) return humanizeUrl(res.url);
    throw new Error('empty response.url');
  } catch (err) {
    // Some servers reject HEAD (405, etc.) — fall back to a GET.
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      return humanizeUrl(res.url || url);
    } catch (err2) {
      console.error('Could not resolve redirect for', url, err2.message);
      return humanizeUrl(url); // give up gracefully — better an ugly link than a crash
    }
  } finally {
    clearTimeout(timeout);
  }
}

// Confirms a URL genuinely loads. Used only on the last-resort candidate
// that came from the model's own text rather than a real search citation —
// a guessed URL for a page like this is often subtly wrong (a mismatched
// file name, folder path, or transliteration) even when the domain and
// general topic are right, and a broken link is worse than admitting no
// confident match was found.
async function urlLooksReachable(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; ChurchSiteLinkCheck/1.0)' };
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers, signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      throw new Error('HEAD not supported, falling back to GET');
    }
    return res.ok;
  } catch {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', headers, signal: controller.signal });
      return res.ok;
    } catch (err) {
      console.error('Could not verify guessed URL', url, err.message);
      return false;
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Runs a grounded Gemini search with a one-shot retry (emphasizing that the
 * model must actually search, not answer from memory) if no real citation
 * came back the first time. Returns up to `limit` deduped candidate links.
 */
async function runGroundedSearch(apiKey, promptBuilder, options = {}) {
  const { domainFilter, domainPreference, limit = 4 } = options;

  const filterChunks = (chunks) => {
    if (!domainFilter) return chunks;
    const needles = Array.isArray(domainFilter) ? domainFilter : [domainFilter];
    return chunks.filter((c) => needles.some((d) => (c.web.title || '').toLowerCase().includes(d)));
  };
  const sortChunks = (chunks) => {
    if (!domainPreference) return chunks;
    const needles = Array.isArray(domainPreference) ? domainPreference : [domainPreference];
    const isPreferred = (c) => needles.some((d) => (c.web.title || '').toLowerCase().includes(d));
    return [...chunks].sort((a, b) => Number(isPreferred(b)) - Number(isPreferred(a)));
  };

  let data = await callGemini(apiKey, promptBuilder({ emphasizeSearch: false }));
  let candidate = data.candidates && data.candidates[0];
  let text = extractText(candidate);
  let chunks = filterChunks(extractGroundingChunks(candidate));

  // Retry whenever the first attempt came back with no real search
  // citation at all — whether it claimed to have found something or
  // claimed it didn't, neither is trustworthy without evidence the tool
  // was actually invoked. This matters for two separate reasons: the model
  // can sometimes just answer from memory despite being told not to, and
  // separately, Gemini's grounding metadata is documented to occasionally
  // come back completely empty even when the search tool genuinely was
  // called (an upstream Google issue, not specific to this app). A
  // "NOT_FOUND" backed by zero evidence a search ever ran is exactly as
  // unreliable as an uncited "here's a URL" claim, so both get the same
  // forced-search retry before the answer is accepted. Once the retry
  // produces any text, it supersedes the original uncited answer — its
  // much stronger "you MUST call the tool" instruction makes it the more
  // trustworthy of the two either way.
  if (chunks.length === 0 && text) {
    console.log('No grounding citations on first attempt — retrying with emphasis.');
    data = await callGemini(apiKey, promptBuilder({ emphasizeSearch: true }), GEMINI_RETRY_TIMEOUT_MS);
    candidate = data.candidates && data.candidates[0];
    const retryText = extractText(candidate);
    const retryChunks = filterChunks(extractGroundingChunks(candidate));
    if (retryText) {
      text = retryText;
      chunks = retryChunks;
    }
  }

  if (!text || isNegative(text)) {
    return { found: false };
  }

  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const fallbackTitle = titleMatch ? titleMatch[1].trim() : '';

  if (chunks.length > 0) {
    const ordered = sortChunks(chunks);
    // Resolve redirects in PARALLEL, not one at a time.
    const toResolve = ordered.slice(0, limit + 2);
    const resolved = await Promise.all(
      toResolve.map(async (c) => ({
        title: c.web.title || fallbackTitle,
        url: await resolveFinalUrl(c.web.uri),
      }))
    );
    const seen = new Set();
    const candidates = [];
    for (const r of resolved) {
      const key = r.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ title: r.title, url: r.url, verified: true });
      if (candidates.length >= limit) break;
    }
    if (candidates.length > 0) {
      return { found: true, candidates, rawText: text };
    }
  }

  // No usable grounding citation — the model's own text is our only lead.
  // It's not backed by a real search result, so confirm it at least loads
  // before ever showing it to the admin.
  const urlMatch = text.match(/URL:\s*(\S+)/i);
  if (!urlMatch) {
    return { found: false, rawText: text };
  }
  const guessedUrl = urlMatch[1].trim();
  const reachable = await urlLooksReachable(guessedUrl);
  if (!reachable) {
    console.log('Guessed URL failed reachability check, discarding:', guessedUrl);
    return { found: false, rawText: text };
  }
  return {
    found: true,
    candidates: [{ title: fallbackTitle, url: humanizeUrl(guessedUrl), verified: false }],
    rawText: text,
  };
}

// ── Callable functions ───────────────────────────────────────────────────────

exports.findCanonLink = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 150 },
  async (request) => {
    await requireAdmin(request);
    const query = (request.data && request.data.query || '').trim();
    if (!query) {
      throw new HttpsError('invalid-argument', 'Please provide a canon name or topic.');
    }

    // Three independent searches, run in parallel: one scoped exclusively
    // to azbyka.ru (this parish's preferred, most reliable source — wanted
    // first whenever it has the text), one to православный-молитвослов.рф,
    // and one covering everything else. Keeping them separate means neither
    // of the two named sites' inclusion depends on a single combined search
    // happening to remember to check it — see the comments on
    // buildAzbykaCanonPrompt / buildMolitvoslovCanonPrompt above.
    //
    // Promise.allSettled (not Promise.all) is deliberate: each branch can
    // independently take up to ~100s in the worst case (an initial Gemini
    // call, then a retry, each with their own budget). If one of them times
    // out or errors, that must not wipe out a result the other branches did
    // manage to find — better to show partial results than nothing at all.
    const settled = await Promise.allSettled([
      runGroundedSearch(geminiApiKey.value(), (opts) => buildAzbykaCanonPrompt(query, opts), {
        limit: 1,
      }),
      runGroundedSearch(geminiApiKey.value(), (opts) => buildMolitvoslovCanonPrompt(query, opts), {
        limit: 1,
      }),
      runGroundedSearch(geminiApiKey.value(), (opts) => buildOtherCanonSourcesPrompt(query, opts), {
        domainPreference: OTHER_CANON_DOMAINS,
        limit: 4,
      }),
    ]);
    const toResult = (outcome, label) => {
      if (outcome.status === 'fulfilled') return outcome.value;
      console.error(`${label} canon search failed:`, outcome.reason && outcome.reason.message);
      return { found: false };
    };
    const azbykaResult = toResult(settled[0], 'azbyka');
    const molitvoslovResult = toResult(settled[1], 'molitvoslov');
    const otherResult = toResult(settled[2], 'other-sources');

    const candidates = [];
    const seen = new Set();
    for (const result of [azbykaResult, molitvoslovResult, otherResult]) {
      if (!result.found || !result.candidates) continue;
      for (const c of result.candidates) {
        const key = c.url.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push(c);
      }
    }

    if (candidates.length === 0) {
      const rawText = [azbykaResult.rawText, molitvoslovResult.rawText, otherResult.rawText]
        .filter(Boolean).join(' / ');
      return { found: false, rawText: rawText || undefined };
    }
    return { found: true, candidates: candidates.slice(0, 6) };
  }
);

exports.findWikiLink = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 150 },
  async (request) => {
    await requireAdmin(request);
    const dedication = (request.data && request.data.dedication || '').trim();
    if (!dedication) {
      throw new HttpsError('invalid-argument', 'Please provide a canon dedication.');
    }
    return runGroundedSearch(geminiApiKey.value(), (opts) => buildWikiPrompt(dedication, opts), {
      domainFilter: WIKI_DOMAIN_HINT,
      limit: 2,
    });
  }
);

exports.translateCanonReading = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 90 },
  async (request) => {
    await requireAdmin(request);
    const html = (request.data && request.data.html || '').trim();
    if (!html) {
      throw new HttpsError('invalid-argument', 'Please provide the Russian announcement HTML to translate.');
    }

    const data = await callGeminiPlain(geminiApiKey.value(), buildTranslationPrompt(html));
    const candidate = data.candidates && data.candidates[0];
    const translated = stripCodeFence(extractText(candidate));
    if (!translated) {
      throw new HttpsError('internal', 'Translation came back empty — try again.');
    }
    return { html: translated };
  }
);

