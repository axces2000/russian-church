// COPY TO: src/lib/calendarData.ts
// Orthodox Church Calendar — Julian (Russian/ROCOR) tradition
// Ported from the orthodox-calendar-nz project.
//
// ALL Orthodox churches calculate Holy Pascha using the same Julian Paschalion.
// The Julian calendar reform left Pascha and the entire Paschal cycle unchanged.
//   • Pascha + moveable feasts: same civil date for all Orthodox.
//   • Fixed feasts: Julian (OS) dates, which are 13 days behind Gregorian (NS)
//       in the 21st century.  e.g. Nativity OS Dec 25 = NS Jan 7.

export type FastType = 'strict' | 'oilwine' | 'fish' | 'dairy' | 'fastfree' | null;
export type FeastTier = 'great' | 'pascha' | 'vigil' | 'polyeleos' | 'doxology' | 'sixverse' | 'commemoration';

export interface FeastData {
  name: string;
  tier?: FeastTier;
  color?: string;
  fast?: FastType;
  fastFree?: boolean;
  holyWeek?: boolean;
  saint?: string;
  epistle?: string;
  gospel?: string;
  fastPeriod?: string;
}

export interface NZHoliday {
  name: string;
}

export interface FastingPeriod {
  start: Date;
  end: Date;
  period: string;
  defaultFast: FastType;
  notes?: string;
}

export interface DayData {
  date: Date;
  useJulian: boolean;
  fixedFeast: FeastData | null;
  moveableFeast: FeastData | null;
  nzHoliday: NZHoliday | null;
  fast: FastType;
  fastPeriod: string | null;
  tone: number;
  isHolyWeek: boolean;
  isPascha: boolean;
  isBrightWeek: boolean;
  isSunday: boolean;
  paschaOffset: number;
  julianDateStr: string | null;
}

export const FEAST_TIERS = {
  GREAT:         'great'         as FeastTier,
  PASCHA:        'pascha'        as FeastTier,
  VIGIL:         'vigil'         as FeastTier,
  POLYELEOS:     'polyeleos'     as FeastTier,
  DOXOLOGY:      'doxology'      as FeastTier,
  SIXVERSE:      'sixverse'      as FeastTier,
  COMMEMORATION: 'commemoration' as FeastTier,
};

export const FAST_TYPES = {
  STRICT:    'strict'   as FastType,
  OIL_WINE:  'oilwine'  as FastType,
  FISH:      'fish'     as FastType,
  DAIRY:     'dairy'    as FastType,
  FAST_FREE: 'fastfree' as FastType,
  NONE:      null       as FastType,
};

export const FAST_PERIODS = {
  GREAT_LENT:     "Great Lent",
  APOSTLES:       "Apostles' Fast",
  DORMITION:      "Dormition Fast",
  NATIVITY:       "Nativity Fast",
  WEEKLY_WED_FRI: "Wednesday & Friday Fast",
};

export const JULIAN_OFFSET_DAYS = 13;

// ── Orthodox Pascha ───────────────────────────────────────────────────────────
export function computeOrthodoxPascha(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const f = Math.floor((d + e + 114) / 31);
  const g = ((d + e + 114) % 31) + 1;
  const julianDate = new Date(year, f - 1, g);
  return new Date(julianDate.getTime() + JULIAN_OFFSET_DAYS * 86400000);
}

const _paschaCache: Record<number, Date> = {};
export function getPascha(year: number): Date {
  if (!_paschaCache[year]) _paschaCache[year] = computeOrthodoxPascha(year);
  return _paschaCache[year];
}

// ── NZ Public Holidays ────────────────────────────────────────────────────────
export const NZ_HOLIDAYS: Record<string, NZHoliday> = {
  "2024-01-01": { name: "New Year's Day" },
  "2024-01-02": { name: "Day after New Year's Day" },
  "2024-02-06": { name: "Waitangi Day" },
  "2024-03-29": { name: "Good Friday (Western)" },
  "2024-04-01": { name: "Easter Monday (Western)" },
  "2024-04-25": { name: "ANZAC Day" },
  "2024-06-03": { name: "King's Birthday" },
  "2024-06-28": { name: "Matariki" },
  "2024-10-28": { name: "Labour Day" },
  "2024-12-25": { name: "Christmas Day" },
  "2024-12-26": { name: "Boxing Day" },
  "2025-01-01": { name: "New Year's Day" },
  "2025-01-02": { name: "Day after New Year's Day" },
  "2025-02-06": { name: "Waitangi Day" },
  "2025-04-18": { name: "Good Friday (Western)" },
  "2025-04-21": { name: "Easter Monday (Western)" },
  "2025-04-25": { name: "ANZAC Day" },
  "2025-06-02": { name: "King's Birthday" },
  "2025-06-20": { name: "Matariki" },
  "2025-10-27": { name: "Labour Day" },
  "2025-12-25": { name: "Christmas Day" },
  "2025-12-26": { name: "Boxing Day" },
  "2026-01-01": { name: "New Year's Day" },
  "2026-01-02": { name: "Day after New Year's Day" },
  "2026-02-06": { name: "Waitangi Day" },
  "2026-04-03": { name: "Good Friday (Western)" },
  "2026-04-06": { name: "Easter Monday (Western)" },
  "2026-04-25": { name: "ANZAC Day" },
  "2026-06-01": { name: "King's Birthday" },
  "2026-07-17": { name: "Matariki" },
  "2026-10-26": { name: "Labour Day" },
  "2026-12-25": { name: "Christmas Day" },
  "2026-12-26": { name: "Boxing Day" },
  "2027-01-01": { name: "New Year's Day" },
  "2027-01-02": { name: "Day after New Year's Day" },
  "2027-02-06": { name: "Waitangi Day" },
  "2027-04-25": { name: "ANZAC Day" },
  "2027-06-07": { name: "King's Birthday" },
  "2027-07-16": { name: "Matariki" },
  "2027-10-25": { name: "Labour Day" },
  "2027-12-25": { name: "Christmas Day" },
  "2027-12-27": { name: "Boxing Day (observed)" },
  "2028-01-01": { name: "New Year's Day" },
  "2028-02-06": { name: "Waitangi Day" },
  "2028-04-25": { name: "ANZAC Day" },
  "2028-06-05": { name: "King's Birthday" },
  "2028-07-07": { name: "Matariki" },
  "2028-10-23": { name: "Labour Day" },
  "2028-12-25": { name: "Christmas Day" },
  "2028-12-26": { name: "Boxing Day" },
  "2029-01-01": { name: "New Year's Day" },
  "2029-02-06": { name: "Waitangi Day" },
  "2029-04-25": { name: "ANZAC Day" },
  "2029-12-25": { name: "Christmas Day" },
  "2029-12-26": { name: "Boxing Day" },
  "2030-01-01": { name: "New Year's Day" },
  "2030-02-06": { name: "Waitangi Day" },
  "2030-04-25": { name: "ANZAC Day" },
  "2030-12-25": { name: "Christmas Day" },
  "2030-12-26": { name: "Boxing Day" },
};

// ── Moveable Feasts (offsets from Pascha — same for all Orthodox) ─────────────
export const MOVEABLE_OFFSETS: Record<string, FeastData> = {
  "-70": { name: "Sunday of the Publican & Pharisee", tier: FEAST_TIERS.DOXOLOGY, fastFree: true },
  "-63": { name: "Sunday of the Prodigal Son", tier: FEAST_TIERS.DOXOLOGY },
  "-56": { name: "Saturday of the Departed (Meatfare)", tier: FEAST_TIERS.COMMEMORATION },
  "-49": { name: "Meatfare Sunday", tier: FEAST_TIERS.DOXOLOGY },
  "-48": { name: "Clean Monday — Great Lent Begins", fastPeriod: FAST_PERIODS.GREAT_LENT },
  "-42": { name: "Sunday of Orthodoxy (1st Sunday of Lent)", tier: FEAST_TIERS.DOXOLOGY },
  "-35": { name: "Sunday of St Gregory Palamas (2nd Sunday of Lent)", tier: FEAST_TIERS.DOXOLOGY },
  "-28": { name: "Sunday of the Veneration of the Cross (3rd Sunday of Lent)", tier: FEAST_TIERS.DOXOLOGY },
  "-21": { name: "Sunday of St John Climacus (4th Sunday of Lent)", tier: FEAST_TIERS.DOXOLOGY },
  "-14": { name: "Sunday of St Mary of Egypt (5th Sunday of Lent)", tier: FEAST_TIERS.DOXOLOGY },
  "-7":  { name: "Palm Sunday — Entry into Jerusalem", tier: FEAST_TIERS.GREAT, color: "palm",
           epistle: "Phil 4:4-9", gospel: "John 12:1-18" },
  "-6":  { name: "Holy Monday", fast: FAST_TYPES.STRICT, holyWeek: true },
  "-5":  { name: "Holy Tuesday", fast: FAST_TYPES.STRICT, holyWeek: true },
  "-4":  { name: "Holy Wednesday", fast: FAST_TYPES.STRICT, holyWeek: true },
  "-3":  { name: "Holy Thursday — Mystical Supper & Washing of Feet",
           fast: FAST_TYPES.STRICT, holyWeek: true, tier: FEAST_TIERS.GREAT,
           epistle: "1 Cor 11:23-32", gospel: "John 13:1-17" },
  "-2":  { name: "Holy Friday — Veneration of the Holy Shroud",
           fast: FAST_TYPES.STRICT, holyWeek: true, tier: FEAST_TIERS.PASCHA },
  "-1":  { name: "Holy Saturday — Descent into Hades", fast: FAST_TYPES.STRICT, holyWeek: true },
  "0":   { name: "HOLY PASCHA — The Resurrection of Our Lord Jesus Christ",
           tier: FEAST_TIERS.PASCHA, epistle: "Acts 1:1-8", gospel: "John 1:1-17",
           fastFree: true, color: "pascha" },
  "1":   { name: "Bright Monday", tier: FEAST_TIERS.GREAT, fastFree: true, color: "bright" },
  "2":   { name: "Bright Tuesday",   fastFree: true, color: "bright" },
  "3":   { name: "Bright Wednesday", fastFree: true, color: "bright" },
  "4":   { name: "Bright Thursday",  fastFree: true, color: "bright" },
  "5":   { name: "Bright Friday — Icon of the Theotokos of Iver", fastFree: true, color: "bright" },
  "6":   { name: "Bright Saturday",  fastFree: true, color: "bright" },
  "7":   { name: "Thomas Sunday (Antipascha)", tier: FEAST_TIERS.GREAT,
           epistle: "Acts 5:12-20", gospel: "John 20:19-31" },
  "14":  { name: "Sunday of the Myrrh-Bearing Women", tier: FEAST_TIERS.DOXOLOGY },
  "21":  { name: "Sunday of the Paralytic", tier: FEAST_TIERS.DOXOLOGY },
  "25":  { name: "Mid-Pentecost", tier: FEAST_TIERS.VIGIL },
  "28":  { name: "Sunday of the Samaritan Woman", tier: FEAST_TIERS.DOXOLOGY },
  "35":  { name: "Sunday of the Blind Man", tier: FEAST_TIERS.DOXOLOGY },
  "39":  { name: "Ascension of the Lord", tier: FEAST_TIERS.GREAT,
           epistle: "Acts 1:1-12", gospel: "Luke 24:36-53" },
  "42":  { name: "Saturday of the Departed (before Pentecost)", tier: FEAST_TIERS.COMMEMORATION },
  "49":  { name: "Pentecost — Holy Trinity Sunday", tier: FEAST_TIERS.GREAT,
           epistle: "Acts 2:1-11", gospel: "John 7:37-52", fastFree: true, color: "pentecost" },
  "50":  { name: "Monday of the Holy Spirit", fastFree: true },
  "56":  { name: "Sunday of All Saints" },
  "57":  { name: "Apostles' Fast Begins" },
};

// ── Fixed Feasts (keyed by MM-DD in the tradition's own calendar)
// For Julian: getDayData subtracts 13 days from Gregorian input to get the OS key.
// So Nativity key "12-25" matches Gregorian Jan 7 (Jan 7 − 13 = Dec 25 OS).
export const FIXED_FEASTS: Record<string, FeastData> = {
  "01-01": { name: "Circumcision of the Lord & St Basil the Great", tier: FEAST_TIERS.GREAT,
             saint: "St Basil the Great, Archbishop of Caesarea",
             epistle: "Col 2:8-12", gospel: "Luke 2:20-21,40-52" },
  "01-05": { name: "Eve of Holy Theophany — Royal Hours", fast: FAST_TYPES.STRICT },
  "01-06": { name: "Holy Theophany — Baptism of the Lord", tier: FEAST_TIERS.GREAT,
             saint: "St John the Forerunner & Baptist",
             epistle: "Titus 2:11-14; 3:4-7", gospel: "Matt 3:13-17" },
  "01-07": { name: "Synaxis of St John the Forerunner & Baptist", tier: FEAST_TIERS.POLYELEOS,
             saint: "St John the Forerunner & Baptist of Christ",
             epistle: "Acts 19:1-8", gospel: "John 1:29-34" },
  "01-17": { name: "St Anthony the Great", tier: FEAST_TIERS.POLYELEOS,
             saint: "St Anthony the Great, Father of Monasticism" },
  "01-25": { name: "St Gregory the Theologian", tier: FEAST_TIERS.POLYELEOS,
             saint: "St Gregory the Theologian, Archbishop of Constantinople" },
  "01-30": { name: "Three Holy Hierarchs", tier: FEAST_TIERS.POLYELEOS,
             saint: "Ss Basil the Great, Gregory the Theologian & John Chrysostom",
             epistle: "Heb 13:7-16", gospel: "Matt 5:14-19" },
  "02-02": { name: "Presentation of the Lord in the Temple", tier: FEAST_TIERS.GREAT,
             saint: "Simeon the God-receiver & Anna the Prophetess",
             epistle: "Heb 7:7-17", gospel: "Luke 2:22-40" },
  "02-10": { name: "St Charalambos the Hieromartyr", tier: FEAST_TIERS.POLYELEOS,
             saint: "St Charalambos, Hieromartyr" },
  "03-09": { name: "Forty Holy Martyrs of Sebaste", tier: FEAST_TIERS.POLYELEOS,
             saint: "The Forty Holy Martyrs of Sebaste in Armenia" },
  "03-25": { name: "Annunciation of the Most Holy Theotokos", tier: FEAST_TIERS.GREAT,
             saint: "The Most Holy Theotokos",
             epistle: "Heb 2:11-18", gospel: "Luke 1:24-38", fast: FAST_TYPES.FISH },
  "04-23": { name: "St George the Great Martyr & Trophy-Bearer", tier: FEAST_TIERS.POLYELEOS,
             saint: "St George the Trophy-Bearer, Great Martyr",
             epistle: "2 Tim 2:1-10", gospel: "John 15:17-27" },
  "04-25": { name: "St Mark the Apostle & Evangelist", tier: FEAST_TIERS.POLYELEOS,
             saint: "St Mark the Apostle & Evangelist",
             epistle: "1 Pet 5:6-14", gospel: "Mark 6:7-13" },
  "05-08": { name: "Holy Apostle & Evangelist John the Theologian", tier: FEAST_TIERS.VIGIL,
             saint: "St John the Theologian, Apostle & Evangelist",
             epistle: "1 John 1:1-7", gospel: "John 19:25-27; 21:24-25" },
  "05-09": { name: "Translation of Relics of St Nicholas the Wonderworker",
             tier: FEAST_TIERS.DOXOLOGY, saint: "St Nicholas, Archbishop of Myra in Lycia" },
  "05-21": { name: "Equal-to-the-Apostles Constantine & Helena", tier: FEAST_TIERS.POLYELEOS,
             saint: "Ss Constantine & Helena, Equal-to-the-Apostles" },
  "06-11": { name: "Ss Bartholomew & Barnabas the Apostles", tier: FEAST_TIERS.DOXOLOGY,
             saint: "Holy Apostles Bartholomew & Barnabas" },
  "06-24": { name: "Nativity of St John the Forerunner & Baptist", tier: FEAST_TIERS.GREAT,
             saint: "St John the Forerunner, Baptist of Christ",
             epistle: "Rom 13:11-14:4", gospel: "Luke 1:1-25,57-68,76,80" },
  "06-29": { name: "Holy Glorious Apostles Peter & Paul", tier: FEAST_TIERS.GREAT,
             saint: "Holy Apostles Peter & Paul, Proclaimers of the Faith",
             epistle: "2 Cor 11:21-12:9", gospel: "Matt 16:13-19" },
  "06-30": { name: "Synaxis of the Holy Apostles", tier: FEAST_TIERS.DOXOLOGY,
             saint: "The Twelve Holy Apostles" },
  "07-17": { name: "Holy Royal Martyrs", tier: FEAST_TIERS.POLYELEOS,
             saint: "Tsar Nicholas II, Tsaritsa Alexandra & their children" },
  "07-20": { name: "Holy Prophet Elijah the Tishbite", tier: FEAST_TIERS.VIGIL,
             saint: "Holy Prophet Elijah",
             epistle: "James 5:10-20", gospel: "Luke 4:22-30" },
  "08-01": { name: "Procession of the Precious Wood of the Holy Cross",
             tier: FEAST_TIERS.DOXOLOGY,
             saint: "Holy Maccabean Martyrs; beginning of Dormition Fast",
             fast: FAST_TYPES.STRICT },
  "08-06": { name: "Transfiguration of Our Lord Jesus Christ", tier: FEAST_TIERS.GREAT,
             saint: "Our Lord Jesus Christ on Mount Tabor",
             epistle: "2 Pet 1:10-19", gospel: "Matt 17:1-9", fast: FAST_TYPES.FISH },
  "08-15": { name: "Dormition of the Most Holy Theotokos", tier: FEAST_TIERS.GREAT,
             saint: "The Most Holy Theotokos & Ever-Virgin Mary",
             epistle: "Phil 4:4-9", gospel: "Luke 10:38-42; 11:27-28" },
  "08-16": { name: "Translation of the Holy Mandylion (Image Not Made by Hands)",
             tier: FEAST_TIERS.VIGIL, saint: "The Holy Mandylion" },
  "08-29": { name: "Beheading of St John the Forerunner & Baptist", tier: FEAST_TIERS.GREAT,
             saint: "St John the Forerunner & Baptist",
             epistle: "Acts 13:25-32", gospel: "Mark 6:14-30", fast: FAST_TYPES.STRICT },
  "08-31": { name: "Deposition of the Precious Sash of the Theotokos",
             tier: FEAST_TIERS.DOXOLOGY, saint: "The Most Holy Theotokos" },
  "09-01": { name: "Beginning of the Indiction — Church New Year", tier: FEAST_TIERS.DOXOLOGY,
             saint: "St Symeon Stylites the Elder" },
  "09-08": { name: "Nativity of the Most Holy Theotokos", tier: FEAST_TIERS.GREAT,
             saint: "The Most Holy Theotokos & Ever-Virgin Mary",
             epistle: "Phil 4:4-9", gospel: "Luke 10:38-42; 11:27-28" },
  "09-14": { name: "Universal Exaltation of the Precious & Life-Giving Cross",
             tier: FEAST_TIERS.GREAT,
             saint: "The Life-Giving Cross of the Lord",
             epistle: "1 Cor 1:18-24", gospel: "John 19:6-11,13-20,25-28,30-35",
             fast: FAST_TYPES.STRICT },
  "09-26": { name: "Repose of St John the Theologian", tier: FEAST_TIERS.DOXOLOGY,
             saint: "St John the Theologian, Apostle & Evangelist" },
  "10-01": { name: "Protection of the Most Holy Theotokos (Pokrov)", tier: FEAST_TIERS.VIGIL,
             saint: "The Most Holy Theotokos",
             epistle: "Heb 9:1-7", gospel: "Luke 10:38-42; 11:27-28" },
  "10-18": { name: "St Luke the Apostle & Evangelist", tier: FEAST_TIERS.DOXOLOGY,
             saint: "St Luke the Holy Apostle & Evangelist" },
  "10-26": { name: "St Demetrios the Great Martyr & Myrrh-Streamer",
             tier: FEAST_TIERS.POLYELEOS, saint: "St Demetrios of Thessalonica, Great Martyr" },
  "11-01": { name: "Ss Cosmas & Damian of Asia", tier: FEAST_TIERS.DOXOLOGY,
             saint: "Ss Cosmas & Damian of Asia, Holy Unmercenaries" },
  "11-08": { name: "Synaxis of the Archangel Michael & all the Bodiless Hosts",
             tier: FEAST_TIERS.VIGIL,
             saint: "Archangels Michael, Gabriel, Raphael & all the Bodiless Hosts",
             epistle: "Heb 2:2-10", gospel: "Luke 10:16-21" },
  "11-14": { name: "Holy Apostle Philip; Nativity Fast begins",
             tier: FEAST_TIERS.DOXOLOGY, saint: "Holy Apostle Philip" },
  "11-21": { name: "Entry of the Theotokos into the Temple", tier: FEAST_TIERS.GREAT,
             saint: "The Most Holy Theotokos",
             epistle: "Heb 9:1-7", gospel: "Luke 10:38-42; 11:27-28" },
  "11-25": { name: "St Catherine the Great Martyr", tier: FEAST_TIERS.POLYELEOS,
             saint: "St Catherine of Alexandria, Great Martyr & Bride of Christ" },
  "11-30": { name: "Holy Apostle Andrew the First-Called", tier: FEAST_TIERS.VIGIL,
             saint: "St Andrew the First-Called, Apostle & Patron of Constantinople" },
  "12-04": { name: "Holy Great Martyr Barbara & St John Damascene",
             tier: FEAST_TIERS.DOXOLOGY,
             saint: "St Barbara the Great Martyr & St John of Damascus" },
  "12-06": { name: "St Nicholas the Wonderworker", tier: FEAST_TIERS.VIGIL,
             saint: "St Nicholas Archbishop of Myra in Lycia, Wonderworker",
             epistle: "Heb 13:17-21", gospel: "Luke 6:17-23" },
  "12-09": { name: "Conception of the Theotokos by St Anna", tier: FEAST_TIERS.DOXOLOGY,
             saint: "St Anna, Mother of the Theotokos" },
  "12-12": { name: "St Spyridon of Trimythous", tier: FEAST_TIERS.VIGIL,
             saint: "St Spyridon of Trimythous, Bishop & Wonderworker" },
  "12-24": { name: "Forefeast of the Nativity of Christ — Christmas Eve",
             tier: FEAST_TIERS.VIGIL, fast: FAST_TYPES.STRICT },
  "12-25": { name: "Nativity of Our Lord Jesus Christ", tier: FEAST_TIERS.GREAT,
             saint: "The Lord Jesus Christ, born in the flesh of the Virgin Mary",
             epistle: "Gal 4:4-7", gospel: "Matt 2:1-12", fastFree: true, color: "nativity" },
  "12-26": { name: "Synaxis of the Most Holy Theotokos", tier: FEAST_TIERS.GREAT,
             saint: "The Most Holy Theotokos", fastFree: true },
  "12-27": { name: "Holy Protomartyr & Archdeacon Stephen", tier: FEAST_TIERS.POLYELEOS,
             saint: "St Stephen the First Martyr & Archdeacon", fastFree: true },
  "12-31": { name: "Eve of Holy Theophany — Royal Hours", fast: FAST_TYPES.STRICT },
};

// ── Fasting Periods ───────────────────────────────────────────────────────────
// useJulian = true for ROCOR
export function getFastingPeriods(year: number, useJulian: boolean): FastingPeriod[] {
  const pascha = getPascha(year);
  const D = (n: number) => new Date(pascha.getTime() + n * 86400000);

  const peterPaul = useJulian ? new Date(year, 6, 12) : new Date(year, 5, 29);
  const apostlesEnd = new Date(peterPaul.getTime() - 86400000);

  const dormStart = useJulian ? new Date(year, 7, 14) : new Date(year, 7, 1);
  const dormEnd   = useJulian ? new Date(year, 7, 27) : new Date(year, 7, 14);

  const natStart = useJulian ? new Date(year, 10, 28)   : new Date(year, 10, 15);
  const natEnd   = useJulian ? new Date(year + 1, 0, 6) : new Date(year, 11, 24);

  return [
    { start: D(-48), end: D(-1),
      period: FAST_PERIODS.GREAT_LENT, defaultFast: FAST_TYPES.STRICT,
      notes: "Strict fast Mon–Fri; oil & wine Sat–Sun" },
    { start: D(57), end: apostlesEnd,
      period: FAST_PERIODS.APOSTLES, defaultFast: FAST_TYPES.FISH,
      notes: "Fish, oil & wine Mon/Tue/Thu; strict Wed & Fri" },
    { start: dormStart, end: dormEnd,
      period: FAST_PERIODS.DORMITION, defaultFast: FAST_TYPES.STRICT,
      notes: useJulian ? "Fish on Transfiguration (Aug 19 NS)" : "Fish on Transfiguration (Aug 6)" },
    { start: natStart, end: natEnd,
      period: FAST_PERIODS.NATIVITY, defaultFast: FAST_TYPES.FISH,
      notes: "Fish Mon/Tue/Thu; stricter from Dec 20" },
    useJulian
      ? { start: new Date(year, 0, 18), end: new Date(year, 0, 18),
          period: "Eve of Theophany", defaultFast: FAST_TYPES.STRICT }
      : { start: new Date(year, 0,  5), end: new Date(year, 0,  5),
          period: "Eve of Theophany", defaultFast: FAST_TYPES.STRICT },
    useJulian
      ? { start: new Date(year, 8, 11), end: new Date(year, 8, 11),
          period: "Beheading of St John the Baptist", defaultFast: FAST_TYPES.STRICT }
      : { start: new Date(year, 7, 29), end: new Date(year, 7, 29),
          period: "Beheading of St John the Baptist", defaultFast: FAST_TYPES.STRICT },
    useJulian
      ? { start: new Date(year, 8, 27), end: new Date(year, 8, 27),
          period: "Exaltation of the Holy Cross", defaultFast: FAST_TYPES.STRICT }
      : { start: new Date(year, 8, 14), end: new Date(year, 8, 14),
          period: "Exaltation of the Holy Cross", defaultFast: FAST_TYPES.STRICT },
  ];
}

// ── Tone of the Week ──────────────────────────────────────────────────────────
export function getToneForDate(date: Date, pascha: Date): number {
  const daysDiff  = Math.floor((date.getTime() - pascha.getTime()) / 86400000);
  const weeksDiff = Math.floor(daysDiff / 7);
  const tone = ((weeksDiff % 8) + 8) % 8;
  return tone === 0 ? 8 : tone;
}

// ── Main: getDayData ──────────────────────────────────────────────────────────
// Always called with useJulian = true for this ROCOR parish.
export function getDayData(date: Date, useJulian = true): DayData {
  const msPerDay = 86400000;

  const lookupDate = useJulian
    ? new Date(date.getTime() - JULIAN_OFFSET_DAYS * msPerDay)
    : date;

  const lmm = String(lookupDate.getMonth() + 1).padStart(2, '0');
  const ldd = String(lookupDate.getDate()).padStart(2, '0');
  const fixedKey = `${lmm}-${ldd}`;

  const gmm = String(date.getMonth() + 1).padStart(2, '0');
  const gdd = String(date.getDate()).padStart(2, '0');
  const nzHoliday = NZ_HOLIDAYS[`${date.getFullYear()}-${gmm}-${gdd}`] || null;

  const year       = date.getFullYear();
  const pascha     = getPascha(year);
  const prevPascha = getPascha(year - 1);

  let offset     = Math.round((date.getTime() - pascha.getTime()) / msPerDay);
  let usedPascha = pascha;
  if (offset < -100) {
    offset     = Math.round((date.getTime() - prevPascha.getTime()) / msPerDay);
    usedPascha = prevPascha;
  }

  const moveable = MOVEABLE_OFFSETS[String(offset)] || null;
  const fixed    = FIXED_FEASTS[fixedKey]            || null;

  let fast: FastType       = null;
  let fastPeriod: string | null = null;
  const dow = date.getDay();

  const periods = [
    ...getFastingPeriods(year - 1, useJulian),
    ...getFastingPeriods(year,     useJulian),
  ];
  for (const fp of periods) {
    if (date >= fp.start && date <= fp.end) {
      fast       = fp.defaultFast;
      fastPeriod = fp.period;
      break;
    }
  }

  if (!fast && (dow === 3 || dow === 5)) {
    fast       = FAST_TYPES.FISH;
    fastPeriod = FAST_PERIODS.WEEKLY_WED_FRI;
  }

  if (moveable?.fastFree || fixed?.fastFree) fast = FAST_TYPES.FAST_FREE;
  if (moveable?.fast) fast = moveable.fast as FastType;
  if (fixed?.fast)    fast = fixed.fast as FastType;

  if (offset >= 0 && offset <= 6) fast = FAST_TYPES.FAST_FREE;

  const cheeseStart = new Date(usedPascha.getTime() - 49 * msPerDay);
  const cheeseEnd   = new Date(usedPascha.getTime() - 43 * msPerDay);
  if (date >= cheeseStart && date <= cheeseEnd) fast = FAST_TYPES.DAIRY;

  const pfStart = new Date(usedPascha.getTime() - 70 * msPerDay);
  const pfEnd   = new Date(usedPascha.getTime() - 64 * msPerDay);
  if (date >= pfStart && date <= pfEnd) fast = FAST_TYPES.FAST_FREE;

  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return {
    date,
    useJulian,
    fixedFeast:    fixed,
    moveableFeast: moveable,
    nzHoliday,
    fast,
    fastPeriod,
    tone:        getToneForDate(date, usedPascha),
    isHolyWeek:  moveable?.holyWeek  || false,
    isPascha:    offset === 0,
    isBrightWeek:offset >= 1 && offset <= 6,
    isSunday:    dow === 0,
    paschaOffset:offset,
    julianDateStr: useJulian
      ? `${ldd} ${MONTH_SHORT[lookupDate.getMonth()]} O.S.`
      : null,
  };
}
