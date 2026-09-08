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

export interface CanonReadingFields {
  /** The date of the reading (usually a Saturday). */
  date: Date;
  /** e.g. "21:30" */
  timeNZ: string;
  /** Dative case, e.g. "святителю Николаю Чудотворцу" or "Господу нашему Иисусу Христу" */
  canonDedication: string;
  /** e.g. "отец Алексей" */
  priestName: string;
  /** Optional, e.g. "из Москвы". Leave blank to omit. */
  priestLocation: string;
  canonUrl: string;
  zoomLink1: string;
  zoomLink2: string;
  wikipediaLink: string;
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

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function link(url: string): string {
  const safeUrl = url.trim();
  return `<a href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a>`;
}

export function buildCanonReadingHtml(f: CanonReadingFields): string {
  const dayPhrase = capitalize(IN_DAY_RU[f.date.getDay()]);
  const dateStr = `${f.date.getDate()} ${MONTHS_GENITIVE_RU[f.date.getMonth()]} ${f.date.getFullYear()} года`;
  const priestPhrase = [f.priestLocation.trim(), f.priestName.trim()].filter(Boolean).join(' ');

  return [
    `<p>Дорогие друзья,</p>`,
    `<p>${dayPhrase}, ${dateStr} в ${f.timeNZ} по новозеландскому времени состоится чтение канона ${f.canonDedication.trim()}, которое проводит${priestPhrase ? ' ' + priestPhrase : ''}.</p>`,
    `<p>Чтение будет организовано через конференцию Zoom по этому адресу:<br/>${link(f.zoomLink1)}</p>`,
    `<p>Ссылка на альтернативную конференцию:<br/>${link(f.zoomLink2)}</p>`,
    `<p>Текст канона можно найти здесь:<br/>${link(f.canonUrl)}</p>`,
    `<p>The story and the structure of the Orthodox Church Canons (in English):<br/>${link(f.wikipediaLink)}</p>`,
    `<p>и молитвы:<br/>${link(f.reconciliationLink)}</p>`,
  ].join('\n');
}
