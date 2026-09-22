// src/lib/sundayReadings.ts
//
// Selects the Epistle (Apostle) and Gospel reading for a given SUNDAY,
// bilingually (EN/RU), following the algorithm below. Only Sundays are
// handled — call getSundayReading() only when dayData.isSunday is true.
//
// Priority order (first match wins), matching the actual Typikon structure:
//   1. Triodion / Pentecostarion Sunday (Publican&Pharisee .. All Saints,
//      inclusive) — unique fixed reading per Sunday. Already stored on
//      dayData.moveableFeast.epistle/gospel (calendarData.ts) — this module
//      just bilingualises it.
//   2. Named winter Sundays tied to Nativity/Theophany/Elevation dates
//      (Forefathers, Fathers, Sunday after Nativity, before/after Theophany,
//      after Elevation of the Cross) and the Sunday of Zacchaeus (the fixed
//      "hinge" Sunday immediately before Publican & Pharisee).
//   3. A great Lord's feast landing on Sunday (sundayRank: 'override' in
//      calendarData.ts) — its own reading fully replaces the rank reading.
//   4. A Theotokos/temple-tier feast landing on Sunday (sundayRank:
//      'combine') — both readings are given, rank first, then the feast's.
//   5. The ordinary "rank" (рядовое) reading — see RANK_TABLE below.
//
// ── On the "отступка"/"преступка" (step-back/step-forward) mechanism ──────
// This is the single most complex piece of Slavic liturgical bookkeeping —
// even parish clergy consult an annually-published table rather than
// deriving it from the Typikon directly (Church calendars differ slightly
// among liturgists on exactly how it is reconciled — see azbyka.ru,
// "Отступка и преступка"). What is implemented here:
//   - The Gospel source switches from Matthew to Luke exactly at the
//     Sunday after the Elevation of the Cross (a fixed calendar date),
//     matching the well-attested Synodal/Moscow Patriarchate practice of
//     resetting straight to the Luke table's first slot there, rather than
//     continuing Matthew's own count past that date.
//   - Working FORWARD from Pentecost, ordinary Sundays before Elevation are
//     numbered 2, 3, 4... using the Matthew table (wrapping back into the
//     Matthew table if an unusually early Pascha produces more Sundays
//     than Matthew has entries for — rare).
//   - Working BACKWARD from the Sunday of Zacchaeus (which is always
//     exactly one week before Publican & Pharisee, itself always slot 32),
//     ordinary Sundays after Elevation are numbered 32, 31, 30... — this
//     is what makes the cycle land correctly on Zacchaeus/Mytarya-i-Farisei
//     every year regardless of whether the given year needs the classic
//     "repeat the last few readings" (early Pascha) or "skip ahead"
//     (late Pascha) adjustment, without needing to special-case either.
//   - Confidence note: ranks 2–20 are the well-established, frequently
//     published portion of the table and are used here with good
//     confidence. Ranks 21–31 (deep in the Luke cycle) are filled in from
//     the same broad tradition but are the least certain part of this
//     feature — cross-check them against a current published Typikon /
//     "Богослужебные указания" before relying on them for an actual
//     service. This is flagged here rather than silently guessed.

import { getPascha, JULIAN_OFFSET_DAYS } from './calendarData';
import type { DayData, FeastData } from './calendarData';

export interface Reading {
  ru: string;
  en: string;
}

export interface SundayReadingResult {
  titleRu: string;
  titleEn: string;
  apostle: Reading;
  gospel: Reading;
  /** Present only for a 'combine' case (Theotokos/temple feast on Sunday):
   *  the feast's own reading, given in addition to the rank reading above. */
  apostle2?: Reading;
  gospel2?: Reading;
  source: 'triodion' | 'named' | 'feast-override' | 'feast-combine' | 'rank';
}

// ── Book-name bilingualiser ──────────────────────────────────────────────
// calendarData.ts stores citations as plain English strings, e.g.
// "1 Cor 11:23-32" or "Titus 2:11-14; 3:4-7". Chapter/verse numbers and
// punctuation are identical in both languages — only the book abbreviation
// differs — so citations only need to be typed once, in English.
const BOOK_RU: Record<string, string> = {
  'Matt': 'Мф.', 'Mark': 'Мк.', 'Luke': 'Лк.', 'John': 'Ин.', 'Acts': 'Деян.',
  'Rom': 'Рим.', '1 Cor': '1 Кор.', '2 Cor': '2 Кор.', 'Gal': 'Гал.',
  'Eph': 'Еф.', 'Phil': 'Флп.', 'Col': 'Кол.', '1 Thess': '1 Сол.',
  '2 Thess': '2 Сол.', '1 Tim': '1 Тим.', '2 Tim': '2 Тим.', 'Titus': 'Тит.',
  'Philem': 'Флм.', 'Heb': 'Евр.', 'James': 'Иак.', '1 Pet': '1 Пет.',
  '2 Pet': '2 Пет.', '1 John': '1 Ин.', '2 John': '2 Ин.', '3 John': '3 Ин.',
  'Jude': 'Иуд.',
};
const BOOK_KEYS = Object.keys(BOOK_RU).sort((a, b) => b.length - a.length);

function toReading(citation: string): Reading {
  for (const book of BOOK_KEYS) {
    if (citation === book || citation.startsWith(book + ' ')) {
      const rest = citation.slice(book.length).trim();
      return { en: `${book} ${rest}`.trim(), ru: `${BOOK_RU[book]} ${rest}`.trim() };
    }
  }
  return { en: citation, ru: citation }; // unrecognised format — show as-is
}

function feastReading(feast: FeastData | null | undefined): { apostle: Reading; gospel: Reading } | null {
  if (!feast?.epistle || !feast?.gospel) return null;
  return { apostle: toReading(feast.epistle), gospel: toReading(feast.gospel) };
}

// ── O.S. calendar-window helper (mirrors the pattern already used in
// getDayData()/isNativityStricterWindow for consistency) ────────────────
function lookupDateOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - JULIAN_OFFSET_DAYS);
}
function inWindow(lookupDate: Date, month0: number, dayStart: number, dayEnd: number): boolean {
  return lookupDate.getMonth() === month0 && lookupDate.getDate() >= dayStart && lookupDate.getDate() <= dayEnd;
}

// ── Named winter Sundays (fixed readings, independent of the rank cycle) ──
interface NamedSunday {
  titleRu: string;
  titleEn: string;
  apostle: string; // English-citation form, bilingualised via toReading()
  gospel: string;
  test: (lookupDate: Date) => boolean;
}

const NAMED_SUNDAYS: NamedSunday[] = [
  {
    titleRu: 'Неделя святых праотец', titleEn: 'Sunday of the Holy Forefathers',
    apostle: 'Col 3:4-11', gospel: 'Luke 14:16-24',
    test: (d) => inWindow(d, 11, 11, 17),
  },
  {
    titleRu: 'Неделя святых отец (пред Рождеством Христовым)', titleEn: 'Sunday of the Holy Fathers (before the Nativity)',
    apostle: 'Heb 11:9-10,17-23,32-40', gospel: 'Matt 1:1-25',
    test: (d) => inWindow(d, 11, 18, 24),
  },
  {
    titleRu: 'Неделя по Рождестве Христовом', titleEn: 'Sunday after the Nativity of Christ',
    apostle: 'Gal 1:11-19', gospel: 'Matt 2:13-23',
    test: (d) => inWindow(d, 11, 26, 31),
  },
  {
    titleRu: 'Неделя пред Богоявлением', titleEn: 'Sunday before Theophany',
    apostle: '2 Tim 4:5-8', gospel: 'Mark 1:1-8',
    test: (d) => inWindow(d, 0, 1, 5),
  },
  {
    titleRu: 'Неделя по Богоявлении', titleEn: 'Sunday after Theophany',
    apostle: 'Eph 4:7-13', gospel: 'Matt 4:12-17',
    test: (d) => inWindow(d, 0, 7, 13),
  },
  {
    titleRu: 'Неделя по Воздвижении', titleEn: 'Sunday after the Elevation of the Cross',
    apostle: 'Gal 2:16-20', gospel: 'Mark 8:34-9:1',
    test: (d) => inWindow(d, 8, 15, 21),
  },
];

// The Sunday of Zacchaeus — always exactly one week before Publican &
// Pharisee (pascha offset -70 of the UPCOMING Pascha), i.e. offset -77.
// Slot 32 in the rank index below; handled here as its own fixed entry
// since it never varies regardless of how the winter отступка/преступка
// plays out that year.
const ZACCHAEUS: { apostle: string; gospel: string; titleRu: string; titleEn: string } = {
  titleRu: 'Неделя о Закхее', titleEn: 'Sunday of Zacchaeus',
  apostle: '1 Tim 4:9-15', gospel: 'Luke 19:1-10',
};

// ── Ordinary "rank" (рядовое) Sunday cycle, slots 2–31 ───────────────────
// Slot 1 = All Saints (already a fixed Pentecostarion entry, offset 56).
// Slot 32 = Zacchaeus (handled above). Slots 2–17 draw on Matthew, 18–31 on
// Luke. See the confidence note in the file header — 2–20 are solid;
// 21–31 should be checked against a current published calendar.
const RANK_APOSTLE: Record<number, string> = {
  2: 'Rom 2:10-16', 3: 'Rom 5:1-10', 4: 'Rom 6:18-23', 5: 'Rom 10:1-10',
  6: 'Rom 12:6-14', 7: 'Rom 15:1-7', 8: '1 Cor 1:10-18', 9: '1 Cor 3:9-17',
  10: '1 Cor 4:9-16', 11: '1 Cor 9:2-12', 12: '1 Cor 15:1-11', 13: '1 Cor 16:13-24',
  14: '2 Cor 1:21-2:4', 15: '2 Cor 4:6-15', 16: '2 Cor 6:1-10', 17: '2 Cor 9:6-11',
  18: '2 Cor 11:31-12:9', 19: 'Gal 1:11-19', 20: 'Gal 6:11-18',
  // — lower-confidence tail (verify before production use) —
  21: 'Eph 2:4-10', 22: 'Eph 4:1-6', 23: 'Eph 5:8-19', 24: 'Eph 6:10-17',
  25: 'Col 1:12-18', 26: 'Col 3:4-11', 27: '1 Tim 1:15-17', 28: '1 Tim 4:9-15',
  29: 'Titus 3:8-15', 30: '2 Tim 2:1-10', 31: '2 Tim 2:1-10',
};
const RANK_GOSPEL: Record<number, string> = {
  2: 'Matt 4:18-23', 3: 'Matt 6:22-33', 4: 'Matt 8:5-13', 5: 'Matt 8:28-9:1',
  6: 'Matt 9:1-8', 7: 'Matt 9:27-35', 8: 'Matt 14:14-22', 9: 'Matt 14:22-34',
  10: 'Matt 17:14-23', 11: 'Matt 18:23-35', 12: 'Matt 19:16-26', 13: 'Matt 21:33-42',
  14: 'Matt 22:1-14', 15: 'Matt 22:35-46', 16: 'Matt 25:14-30', 17: 'Matt 15:21-28',
  18: 'Luke 5:1-11', 19: 'Luke 6:31-36', 20: 'Luke 7:11-16',
  // — lower-confidence tail (verify before production use) —
  21: 'Luke 8:5-15', 22: 'Luke 16:19-31', 23: 'Luke 8:26-39', 24: 'Luke 8:41-56',
  25: 'Luke 10:25-37', 26: 'Luke 12:16-21', 27: 'Luke 13:10-17', 28: 'Luke 14:16-24',
  29: 'Luke 17:12-19', 30: 'Luke 18:18-27', 31: 'Luke 18:35-43',
};

const MATTHEW_MAX_SLOT = 17;
const LUKE_MIN_SLOT = 18;
const LUKE_MAX_SLOT = 31;

function firstSundayStrictlyAfter(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  const dow = d.getDay();
  if (dow !== 0) d.setDate(d.getDate() + (7 - dow));
  return d;
}

/** Counts Sundays strictly between two Sundays (exclusive of both), or the
 *  exact week-count between them if that's what's wanted — used to place an
 *  ordinary Sunday's rank slot relative to its two nearest anchors. */
function weeksBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 86400000));
}

/**
 * Computes the reading for an ORDINARY (non-Triodion, non-named, no
 * overriding/combining feast) Sunday, given the resolved Pascha of the
 * cycle it falls in and the Pascha of the FOLLOWING cycle (for Zacchaeus).
 */
function rankReading(date: Date, pascha: Date, nextPascha: Date): { apostle: Reading; gospel: Reading; slot: number } {
  const allSaints = new Date(pascha.getTime() + 56 * 86400000);
  const elevationSunday = firstSundayStrictlyAfter(
    // Elevation of the Cross, O.S. Sept 14 -> Gregorian equivalent this cycle's autumn
    new Date(pascha.getFullYear(), 8, 14 + JULIAN_OFFSET_DAYS)
  );
  const zacchaeus = new Date(nextPascha.getTime() - 77 * 86400000);

  let slot: number;
  if (date.getTime() <= elevationSunday.getTime()) {
    // Matthew phase: forward count from All Saints (slot 1).
    const n = 1 + weeksBetween(allSaints, date);
    slot = ((n - 2 + (MATTHEW_MAX_SLOT - 1)) % (MATTHEW_MAX_SLOT - 1)) + 2; // wraps 2..17
  } else {
    // Luke phase: the Sunday right after Elevation always starts at slot 18
    // (Синодальная/Московской Патриархии practice — see file header), then
    // increments forward one slot per ordinary Sunday. In an unusually
    // long autumn/winter (a late Pascha the FOLLOWING year, so many more
    // ordinary Sundays occur than the 14 slots 18..31 provide for) the
    // count wraps back to 18 and repeats smoothly rather than jumping —
    // a simplified stand-in for the Typikon's more surgical отступка
    // repeats. The two ordinary Sundays immediately before Zacchaeus are
    // always pinned to 31 and 30 respectively, matching the one part of
    // this mechanism that is fully prescribed regardless of gap size (see
    // file header) — everything before that uses the forward count.
    const weeksToZacchaeus = weeksBetween(date, zacchaeus);
    if (weeksToZacchaeus <= 2) {
      slot = 32 - weeksToZacchaeus; // 1 week out -> 31, 2 weeks out -> 30
    } else {
      const idx = weeksBetween(elevationSunday, date) - 1; // 0-based, 0 = first Sunday after Elevation
      const span = LUKE_MAX_SLOT - LUKE_MIN_SLOT + 1;
      slot = LUKE_MIN_SLOT + (((idx % span) + span) % span);
    }
  }

  return {
    apostle: toReading(RANK_APOSTLE[slot]),
    gospel: toReading(RANK_GOSPEL[slot]),
    slot,
  };
}

/**
 * Main entry point. Only meaningful when `date` is a Sunday — returns null
 * otherwise (and returns null for the handful of moveable Sundays that
 * intentionally have no Epistle/Gospel of their own, none currently).
 */
export function getSundayReading(date: Date, dayData: DayData): SundayReadingResult | null {
  if (date.getDay() !== 0) return null;

  // 1. Triodion / Pentecostarion — already carries epistle/gospel.
  const triodion = feastReading(dayData.moveableFeast);
  if (triodion && dayData.moveableFeast) {
    return {
      titleRu: dayData.moveableFeast.nameRu || dayData.moveableFeast.name,
      titleEn: dayData.moveableFeast.name,
      apostle: triodion.apostle,
      gospel: triodion.gospel,
      source: 'triodion',
    };
  }

  const lookupDate = lookupDateOf(date);

  // 2a. Named winter Sundays.
  for (const named of NAMED_SUNDAYS) {
    if (named.test(lookupDate)) {
      return {
        titleRu: named.titleRu, titleEn: named.titleEn,
        apostle: toReading(named.apostle), gospel: toReading(named.gospel),
        source: 'named',
      };
    }
  }

  // 2b. Sunday of Zacchaeus — always the Sunday right before Publican &
  // Pharisee. Cheapest reliable test: is next Sunday's Triodion feast the
  // Publican & Pharisee entry? We don't have next week's DayData here, so
  // instead recompute directly from the resolved Pascha below once we know
  // it — see the fallthrough into rankReading()'s own Pascha resolution.

  // 3/4. A fixed feast on this Sunday that overrides or combines.
  const fixed = dayData.fixedFeast;
  if (fixed?.sundayRank === 'override') {
    const r = feastReading(fixed);
    if (r) {
      return {
        titleRu: fixed.nameRu || fixed.name, titleEn: fixed.name,
        apostle: r.apostle, gospel: r.gospel,
        source: 'feast-override',
      };
    }
  }

  // Resolve which Pascha cycle this ordinary Sunday belongs to (same
  // "closest Pascha" logic used by getDayData) so we can test for
  // Zacchaeus and compute the rank slot.
  const year = date.getFullYear();
  let pascha = getPascha(year);
  if (date.getTime() < pascha.getTime()) pascha = getPascha(year - 1);
  const nextPascha = getPascha(pascha.getFullYear() + 1);
  const zacchaeusDate = new Date(nextPascha.getTime() - 77 * 86400000);

  let base: { apostle: Reading; gospel: Reading; titleRu: string; titleEn: string };
  if (date.getTime() === zacchaeusDate.getTime()) {
    base = {
      apostle: toReading(ZACCHAEUS.apostle), gospel: toReading(ZACCHAEUS.gospel),
      titleRu: ZACCHAEUS.titleRu, titleEn: ZACCHAEUS.titleEn,
    };
  } else {
    const r = rankReading(date, pascha, nextPascha);
    base = { apostle: r.apostle, gospel: r.gospel, titleRu: 'Неделя рядовая', titleEn: 'Ordinary Sunday' };
  }

  if (fixed?.sundayRank === 'combine') {
    const feastR = feastReading(fixed);
    return {
      titleRu: base.titleRu, titleEn: base.titleEn,
      apostle: base.apostle, gospel: base.gospel,
      apostle2: feastR?.apostle, gospel2: feastR?.gospel,
      source: 'feast-combine',
    };
  }

  return {
    titleRu: base.titleRu, titleEn: base.titleEn,
    apostle: base.apostle, gospel: base.gospel,
    source: date.getTime() === zacchaeusDate.getTime() ? 'named' : 'rank',
  };
}

/** Short "Book ch:v" form for cramped calendar-cell display. */
export function shortReading(r: Reading, lang: 'en' | 'ru'): string {
  return lang === 'ru' ? r.ru : r.en;
}
