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

const CANON_DOMAINS = ['azbyka.ru', 'pravoslavie.ru', 'молитвослов'];
const WIKI_DOMAIN_HINT = 'wikipedia';

const NEGATIVE_TOKENS = ['NOT_FOUND', 'GENERAL'];

// Hard timeout per individual Gemini call. Kept well under the function's
// own timeoutSeconds so a stuck request fails with a clear error instead of
// silently hanging until something else kills the whole invocation.
// The "emphasized" retry (which forces a genuine live search rather than
// letting the model answer quickly from memory) is inherently heavier and
// gets a longer budget than the first attempt.
const GEMINI_CALL_TIMEOUT_MS = 20000;
const GEMINI_RETRY_TIMEOUT_MS = 45000;

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

function buildCanonPrompt(query, { emphasizeSearch } = {}) {
  return [
    'You are helping locate the online text of an Orthodox Christian canon',
    '(канон) — a specific liturgical prayer text in Church Slavonic or Russian.',
    `The admin's approximate description of the canon is: "${query}"`,
    '',
    emphasizeSearch
      ? 'You MUST call the Google Search tool for this before answering — do not ' +
        'answer from memory alone, since a remembered URL is often wrong, ' +
        'outdated, or subtly different from the real page.'
      : 'Search the web and find web pages containing the full text of this',
    'exact canon. Strongly prefer azbyka.ru, православный-молитвослов.рф, or',
    'pravoslavie.ru over other sources.',
    '',
    'If you cannot find a specific, confident match, respond with exactly',
    'the single word: NOT_FOUND',
    '',
    'Otherwise respond in exactly this format and nothing else:',
    'TITLE: <short Russian title of the canon>',
    'URL: <the direct URL to the page with the canon text>',
  ].join('\n');
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

// Grounding citations come back as Google-hosted redirect links
// (vertexaisearch.cloud.google.com/grounding-api-redirect/...) rather than
// the real page URL. They work fine to click, but look wrong to publish in
// a public announcement — so resolve the redirect server-side and hand back
// the actual destination instead.
async function resolveFinalUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (res.url) return res.url;
    throw new Error('empty response.url');
  } catch (err) {
    // Some servers reject HEAD (405, etc.) — fall back to a GET.
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      return res.url || url;
    } catch (err2) {
      console.error('Could not resolve redirect for', url, err2.message);
      return url; // give up gracefully — better an ugly link than a crash
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

  if (chunks.length === 0 && text && !isNegative(text)) {
    console.log('No grounding citations on first attempt — retrying with emphasis.');
    data = await callGemini(apiKey, promptBuilder({ emphasizeSearch: true }), GEMINI_RETRY_TIMEOUT_MS);
    candidate = data.candidates && data.candidates[0];
    const retryText = extractText(candidate);
    const retryChunks = filterChunks(extractGroundingChunks(candidate));
    if (retryChunks.length > 0) {
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

  // No usable grounding citation — fall back to the model's own text as a
  // single unverified candidate, so the UI can warn strongly about it.
  const urlMatch = text.match(/URL:\s*(\S+)/i);
  if (!urlMatch) {
    return { found: false, rawText: text };
  }
  return {
    found: true,
    candidates: [{ title: fallbackTitle, url: urlMatch[1].trim(), verified: false }],
    rawText: text,
  };
}

// ── Callable functions ───────────────────────────────────────────────────────

exports.findCanonLink = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 120 },
  async (request) => {
    await requireAdmin(request);
    const query = (request.data && request.data.query || '').trim();
    if (!query) {
      throw new HttpsError('invalid-argument', 'Please provide a canon name or topic.');
    }
    return runGroundedSearch(geminiApiKey.value(), (opts) => buildCanonPrompt(query, opts), {
      domainPreference: CANON_DOMAINS,
      limit: 4,
    });
  }
);

exports.findWikiLink = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 120 },
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
