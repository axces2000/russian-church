// src/lib/canonReadingTemplate.ts
// Builds the Russian-language Canon Reading announcement HTML from a handful
// of structured fields. This step is intentionally NOT done by AI — it's the
// exact same wording pattern every week, so plain string templating is more
// reliable than asking a model to write it fresh each time. AI is only used
// (via the findCanonReading Cloud Function) to locate the canon text URL.
//
// NOTE ON GRAMMAR: Russian requires the canon's dedication to be in the
// dative case after "чтение канона" (e.g. "святителю Николаю", not
// "святитель Николай"). Rather than trying to auto-inflect this, the admin
// form asks for canonDedication already phrased in dative case — see the
// helper text in CanonReadingAdmin.tsx.
//
// AUDIENCE: the announcement is normally for the NZ parish, but Fr. Alexei
// re-uses the same weekly reading for his own Moscow congregation. The
// Moscow version differs in three ways: the clock time is converted to
// Moscow time (DST-aware — NZ observes daylight saving, Russia does not,
// so the offset between them isn't constant year-round), the timezone is
// named accordingly, and the "из Москвы" ("from Moscow") prefix on the
// priest's name is dropped since it's only meaningful to a NZ audience
// being told the priest is joining remotely. See buildCanonReadingHtml's
// `audience` parameter, which defaults to 'nz' — the Moscow version is
// generated on demand elsewhere and is never the one that gets published.

export type CanonAudience = 'nz' | 'moscow';

export interface CanonReadingFields {
  /** The date of the reading (usually a Saturday), in NZ terms. */
  date: Date;
  /** e.g. "21:30" — always NZ clock time; converted for the Moscow audience. */
  timeNZ: string;
  /** Dative case, e.g. "святителю Николаю Чудотворцу" or "Господу нашему Иисусу Христу" */
  canonDedication: string;
  /** e.g. "отец Алексей" */
  priestName: string;
  /** Optional, e.g. "из Москвы". Leave blank to omit. Only used for the NZ audience. */
  priestLocation: string;
  canonUrl: string;
  zoomLink1: string;
  zoomLink2: string;
  wikipediaLink: string;
  /** e.g. "Saint Nicholas" — the Wikipedia article's subject. Leave blank
   *  when using the general default link (not about a specific saint/feast);
   *  the line generated for that case reads differently — see below. */
  wikipediaTitle: string;
  reconciliationLink: string;
}

const MONTHS_GENITIVE_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

// "in [day]" phrasing (accusative case) — index matches Date.getDay() (0 = Sunday)
const IN_DAY_RU = [
  'в воскресенье', 'в понедельник', 'во вторник', 'в среду',
  'в четверг', 'в пятницу', 'в субботу',
];

const NZ_TIMEZONE = 'Pacific/Auckland';
const MOSCOW_TIMEZONE = 'Europe/Moscow';

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function link(url: string): string {
  const safeUrl = url.trim();
  return `<a href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a>`;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  const found = parts.find(p => p.type === type);
  if (!found) throw new Error(`Missing "${type}" in formatted date parts`);
  return found.value;
}

// Interprets year/month(0-indexed)/day + "HH:MM" as a wall-clock time IN
// the given IANA timezone, and returns the UTC instant it corresponds to.
// DST-aware via Intl's own timezone database — no external library needed.
function zonedTimeToUtc(
  year: number, month: number, day: number, timeStr: string, timeZone: string
): Date {
  const [hh, mm] = timeStr.split(':').map(Number);
  // First guess: treat the wall-clock time as if it were already UTC.
  const naiveUtc = new Date(Date.UTC(year, month, day, hh, mm, 0));
  // See what that UTC instant actually reads as in the target zone...
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(naiveUtc);
  const hourRaw = getPart(parts, 'hour');
  const asIfLocal = new Date(Date.UTC(
    Number(getPart(parts, 'year')), Number(getPart(parts, 'month')) - 1, Number(getPart(parts, 'day')),
    hourRaw === '24' ? 0 : Number(hourRaw), Number(getPart(parts, 'minute')), Number(getPart(parts, 'second'))
  ));
  // ...the gap between our guess and that reading is the zone's offset at
  // this specific instant (correct across DST transitions either side).
  return new Date(naiveUtc.getTime() + (naiveUtc.getTime() - asIfLocal.getTime()));
}

interface ZonedDateTime { year: number; month: number; day: number; hour: number; minute: number }

// Reads the calendar date + clock time a UTC instant corresponds to in a
// given IANA timezone.
function readInZone(utcInstant: Date, timeZone: string): ZonedDateTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(utcInstant);
  const hourRaw = getPart(parts, 'hour');
  return {
    year: Number(getPart(parts, 'year')),
    month: Number(getPart(parts, 'month')) - 1, // 0-indexed, matches Date.getMonth()
    day: Number(getPart(parts, 'day')),
    hour: hourRaw === '24' ? 0 : Number(hourRaw),
    minute: Number(getPart(parts, 'minute')),
  };
}

// Converts NZ date+time to the Moscow-local calendar date and clock time
// for the SAME real-world instant. Deliberately re-derives the calendar
// date too (not just the time) — a late-evening NZ time can land on a
// different Moscow calendar day, and vice versa, depending on the current
// DST offset.
function toMoscow(nzDate: Date, timeNZ: string): ZonedDateTime {
  const utcInstant = zonedTimeToUtc(
    nzDate.getFullYear(), nzDate.getMonth(), nzDate.getDate(), timeNZ, NZ_TIMEZONE
  );
  return readInZone(utcInstant, MOSCOW_TIMEZONE);
}

export function buildCanonReadingHtml(f: CanonReadingFields, audience: CanonAudience = 'nz'): string {
  let dayPhrase: string;
  let dateStr: string;
  let timeStr: string;
  let timeZonePhrase: string;
  let priestPhrase: string;

  if (audience === 'moscow') {
    const moscow = toMoscow(f.date, f.timeNZ);
    // noon avoids any DST/date-boundary ambiguity when reading back getDay()
    const localNoon = new Date(Date.UTC(moscow.year, moscow.month, moscow.day, 12));
    dayPhrase = capitalize(IN_DAY_RU[localNoon.getDay()]);
    dateStr = `${moscow.day} ${MONTHS_GENITIVE_RU[moscow.month]} ${moscow.year} года`;
    timeStr = `${String(moscow.hour).padStart(2, '0')}:${String(moscow.minute).padStart(2, '0')}`;
    timeZonePhrase = 'по московскому времени';
    // Moscow parishioners don't need to be told the priest is joining
    // "from Moscow" — that framing only makes sense for the NZ audience.
    priestPhrase = f.priestName.trim();
  } else {
    dayPhrase = capitalize(IN_DAY_RU[f.date.getDay()]);
    dateStr = `${f.date.getDate()} ${MONTHS_GENITIVE_RU[f.date.getMonth()]} ${f.date.getFullYear()} года`;
    timeStr = f.timeNZ;
    timeZonePhrase = 'по новозеландскому времени';
    priestPhrase = [f.priestLocation.trim(), f.priestName.trim()].filter(Boolean).join(' ');
  }

  // With a specific article (e.g. "Saint Nicholas"), name it directly rather
  // than using the generic "structure of the Orthodox Church Canons" phrase,
  // which only fits the general default link.
  const wikiTitle = f.wikipediaTitle.trim();
  const wikiLine = wikiTitle
    ? `The story of ${wikiTitle} (in English):`
    : 'The story and the structure of the Orthodox Church Canons (in English):';

  return [
    `<p>Дорогие друзья,</p>`,
    `<p>${dayPhrase}, ${dateStr} в ${timeStr} ${timeZonePhrase} состоится чтение канона ${f.canonDedication.trim()}, которое проводит${priestPhrase ? ' ' + priestPhrase : ''}.</p>`,
    `<p>Чтение будет организовано через конференцию Zoom по этому адресу:<br/>${link(f.zoomLink1)}</p>`,
    `<p>Ссылка на альтернативную конференцию:<br/>${link(f.zoomLink2)}</p>`,
    `<p>Текст канона можно найти здесь:<br/>${link(f.canonUrl)}</p>`,
    `<p>${wikiLine}<br/>${link(f.wikipediaLink)}</p>`,
    `<p>и молитвы:<br/>${link(f.reconciliationLink)}</p>`,
  ].join('\n');
}

// Converts the generated HTML fragment into readable plain text (line
// breaks instead of <br/>/<p> tags, link text kept, tags stripped) — used
// for the Moscow-audience "copy to clipboard" convenience, since that's
// meant to be pasted into a message to Fr. Alexei, not published as HTML.
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<a[^>]*>/gi, '')
    .replace(/<\/a>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
