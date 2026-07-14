// src/components/ServiceCalendar.tsx
// Public-facing service schedule.
// Default: list/table view with copy-to-clipboard for Word.
// Toggle: full calendar grid with Julian feast highlighting.

import { useEffect, useState } from 'react';
import { useLang } from '../contexts/LangContext';
import { getDayData, getFeastName, getFastLabel, FAST_DISPLAY } from '../lib/calendarData';
import type { DayData, FastType } from '../lib/calendarData';
import { subscribeServiceEventsForMonth } from '../lib/firestore';
import type { ServiceEvent } from '../lib/firestore';

// ── Locale data ───────────────────────────────────────────────────────────────

const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTHS_RU_TITLE = [
  'январь','февраль','март','апрель','май','июнь',
  'июль','август','сентябрь','октябрь','ноябрь','декабрь',
];
const MONTHS_RU_GENITIVE = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря',
];
const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_RU = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const DOW_EN  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DOW_RU  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Bold time patterns like 8:30, 10:00, 18:00 within a line of text — React output
function parseTimeLine(line: string): React.ReactNode[] {
  const parts = line.split(/(\b\d{1,2}:\d{2}\b)/);
  return parts.map((part, i) =>
    /^\d{1,2}:\d{2}$/.test(part)
      ? <strong key={i}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}

// Parse multi-line entry text into rendered lines with bolded times
function renderEntryText(text: string): React.ReactNode {
  return (
    <>
      {text.split('\n').filter(l => l.trim()).map((line, i) => (
        <div key={i} style={{ lineHeight:1.6 }}>{parseTimeLine(line)}</div>
      ))}
    </>
  );
}

// Bold times in a plain string — HTML output (for clipboard)
function timeLineToHtml(line: string): string {
  return line.replace(/(\b\d{1,2}:\d{2}\b)/g, '<strong>$1</strong>');
}

// ── Cell styling (calendar view) ──────────────────────────────────────────────
function getCellStyle(d: DayData) {
  const tier  = d.moveableFeast?.tier  || d.fixedFeast?.tier;
  const color = d.moveableFeast?.color || d.fixedFeast?.color;
  if (d.isPascha)            return { bg:'#FFF0D0', border:'#C4881A', text:'#8B0000', bold:true  };
  if (d.isHolyWeek)          return { bg:'#F5E8E0', border:'#B07060', text:'#6A2010', bold:false };
  if (d.isBrightWeek)        return { bg:'#FFFAE0', border:'#C8A820', text:'#7A5A00', bold:false };
  if (color === 'palm')      return { bg:'#EEF5E8', border:'#6A9050', text:'#2E5820', bold:true  };
  if (color === 'pentecost') return { bg:'#EEF5E8', border:'#5A8A48', text:'#2A5818', bold:true  };
  if (color === 'nativity')  return { bg:'#EAF0FA', border:'#5A78B8', text:'#1E3870', bold:true  };
  if (tier  === 'great')     return { bg:'#FDE8E8', border:'#C07070', text:'#7A1010', bold:true  };
  if (d.isSunday)            return { bg:'var(--color-surface,#fff)', border:'var(--color-accent)', text:'var(--color-primary)', bold:true };
  return { bg:'var(--color-surface,#fff)', border:'var(--color-accent,#c9a227)', text:'var(--color-text,#2b2418)', bold:false };
}

// ── Fast-type icon (small line-art SVG, replaces emoji glyphs) ────────────────
function FastIcon({ type, size = 14 }: { type: Exclude<FastType, null>; size?: number }) {
  const color = FAST_DISPLAY[type].color;
  // Every filled shape gets a thin white outline so the contour reads
  // clearly against light or dark cell backgrounds alike.
  const outline = { fill: color, stroke: '#fff', strokeWidth: 1, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'strict':
      // Bold plus/cross — traditional calendar mark for a strict fasting day
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path {...outline} d="M9 1.5h6v7.5h7.5v6H15v7.5H9V15H1.5V9H9z" />
        </svg>
      );
    case 'oilwine':
      // Oil droplet
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path {...outline} d="M12 2.2 18.5 9.5A8 8 0 1 1 5.5 9.5z" />
        </svg>
      );
    case 'fish':
      // Fish silhouette: rounded body narrowing into a distinct forked tail
      // (the notch at the tail keeps it from reading as a plain oval blob)
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path {...outline} d="M1 12Q4 4 12 6L16 9L23 4L17 12L23 20L16 15Q4 20 1 12Z" />
          <circle cx="7" cy="9.2" r="1.4" fill="#fff" />
        </svg>
      );
    case 'dairy':
      // Cheese wedge with three punched holes
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path {...outline} d="M12 2 22 20.5H2z" />
          <circle cx="12" cy="13.5" r="1.7" fill="#fff" />
          <circle cx="16.8" cy="17" r="1.2" fill="#fff" />
          <circle cx="8" cy="17.3" r="1" fill="#fff" />
        </svg>
      );
    case 'totalfast':
      // Diagonal (St. Andrew's) cross — a silhouette clearly distinct from
      // the upright strict-fast plus, for the rare day of no food at all
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path {...outline} d="M2 4.5 4.5 2 12 9.5 19.5 2 22 4.5 14.5 12 22 19.5 19.5 22 12 14.5 4.5 22 2 19.5 9.5 12Z" />
        </svg>
      );
    default:
      return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
export default function ServiceCalendar() {
  const { lang } = useLang();
  const [view,         setView]         = useState<'list'|'calendar'>('list');
  const [year,         setYear]         = useState(new Date().getFullYear());
  const [month,        setMonth]        = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const [events,       setEvents]       = useState<Record<string, ServiceEvent>>({});
  const [copied,       setCopied]       = useState(false);

  useEffect(() => subscribeServiceEventsForMonth(year, month, setEvents), [year, month]);

  function prevMonth() {
    setSelectedDate(null);
    if (month === 0) { setYear(y => y-1); setMonth(11); }
    else setMonth(m => m-1);
  }
  function nextMonth() {
    setSelectedDate(null);
    if (month === 11) { setYear(y => y+1); setMonth(0); }
    else setMonth(m => m+1);
  }

  const monthNameEn = MONTHS_EN[month];
  const monthNameRu = MONTHS_RU_TITLE[month];

  // Days in current month that have entries, sorted
  const daysWithEntries = Object.entries(events)
    .filter(([dateStr]) => {
      const d = new Date(dateStr + 'T12:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  // ── Copy to clipboard (HTML → Word) ────────────────────────────────────────
  async function copyToClipboard() {
    const title = lang === 'ru'
      ? `Расписание богослужений на ${monthNameRu} ${year}`
      : `Service Schedule for ${monthNameEn} ${year}`;

    const tableRows = daysWithEntries.map(([dateStr, event]) => {
      const d         = new Date(dateStr + 'T12:00:00');
      const jsDay     = d.getDay();
      const dateLabel = lang === 'ru'
        ? `${d.getDate()} ${MONTHS_RU_GENITIVE[month]}`
        : `${d.getDate()} ${monthNameEn}`;
      const dayLabel  = lang === 'ru' ? DAYS_RU[jsDay] : DAYS_EN[jsDay];

      const raw = lang === 'ru'
        ? (event.entriesRu || event.entriesEn)
        : (event.entriesEn || event.entriesRu);

      const entryHtml = raw
        .split('\n')
        .filter(l => l.trim())
        .map(line => `<p style="margin:0 0 2pt 0;line-height:1.5">${timeLineToHtml(line)}</p>`)
        .join('');

      return `
        <tr>
          <td style="padding:7pt 10pt;width:28%;vertical-align:top;border:1pt solid black">
            <strong>${dateLabel}</strong><br/>${dayLabel}
          </td>
          <td style="padding:7pt 10pt;vertical-align:top;border:1pt solid black">
            ${entryHtml}
          </td>
        </tr>`;
    }).join('');

    const html = `
      <html><head><meta charset="utf-8"/></head><body>
        <p style="text-align:center;font-weight:bold;font-size:14pt;
                  font-family:Calibri,Arial,sans-serif;margin:0 0 10pt 0">
          ${title}
        </p>
        <table style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
          <tbody>${tableRows}</tbody>
        </table>
      </body></html>`;

    // Plain-text fallback
    const plain = [
      title,
      '',
      ...daysWithEntries.map(([dateStr, event]) => {
        const d = new Date(dateStr + 'T12:00:00');
        const dateLabel = lang === 'ru'
          ? `${d.getDate()} ${MONTHS_RU_GENITIVE[month]}`
          : `${d.getDate()} ${monthNameEn}`;
        const dayLabel = lang === 'ru' ? DAYS_RU[d.getDay()] : DAYS_EN[d.getDay()];
        const raw = lang === 'ru'
          ? (event.entriesRu || event.entriesEn)
          : (event.entriesEn || event.entriesRu);
        return `${dateLabel} (${dayLabel})\n${raw}`;
      }),
    ].join('\n\n');

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html],  { type: 'text/html'  }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers that don't support ClipboardItem
      try {
        await navigator.clipboard.writeText(plain);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        alert(lang === 'ru' ? 'Не удалось скопировать.' : 'Could not copy to clipboard.');
      }
    }
  }

  // ── Shared header ─────────────────────────────────────────────────────────
  function renderHeader() {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <button onClick={prevMonth}
          aria-label={lang === 'ru' ? 'Предыдущий месяц' : 'Previous month'}
          style={{ background:'none', border:'1px solid var(--color-accent)', borderRadius:2,
            color:'var(--color-accent)', padding:'7px 14px', cursor:'pointer',
            fontSize:16, flexShrink:0 }}>←</button>

        <h2 style={{ flex:1, textAlign:'center', margin:0,
          fontFamily:'var(--font-display)', fontSize:20,
          color:'var(--color-primary)', fontWeight:600,
          letterSpacing:'0.03em', textTransform:'uppercase' }}>
          {lang === 'ru' ? `${monthNameRu} ${year}` : `${monthNameEn} ${year}`}
        </h2>

        <button onClick={nextMonth}
          aria-label={lang === 'ru' ? 'Следующий месяц' : 'Next month'}
          style={{ background:'none', border:'1px solid var(--color-accent)', borderRadius:2,
            color:'var(--color-accent)', padding:'7px 14px', cursor:'pointer',
            fontSize:16, flexShrink:0 }}>→</button>

        {/* View toggle */}
        <div style={{ display:'flex', border:'1px solid var(--color-accent)',
          borderRadius:3, overflow:'hidden', flexShrink:0 }}>
          {(['list','calendar'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:'7px 14px', border:'none', cursor:'pointer', fontSize:12,
              fontWeight: view === v ? 700 : 400,
              letterSpacing:'0.04em', textTransform:'uppercase',
              background: view === v ? 'var(--color-primary)' : 'transparent',
              color: view === v ? 'var(--color-accent)' : 'var(--color-primary)',
              fontFamily:'var(--font-body)', transition:'background 0.15s',
            }}>
              {v === 'list'
                ? (lang === 'ru' ? '☰ Список' : '☰ List')
                : (lang === 'ru' ? '⊞ Календарь' : '⊞ Calendar')}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  function renderListView() {
    const title = lang === 'ru'
      ? `Расписание богослужений на ${monthNameRu} ${year}`
      : `Service Schedule for ${monthNameEn} ${year}`;

    return (
      <div>
        {/* Title row + copy button */}
        <div style={{ display:'flex', alignItems:'center',
          justifyContent:'space-between', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <div style={{ flex:1, textAlign:'center',
            fontFamily:'var(--font-display)', fontSize:18,
            fontWeight:600, color:'var(--color-primary)', letterSpacing:'0.02em' }}>
            {title}
          </div>

          {/* Copy to clipboard button — only shown when there's something to copy */}
          {daysWithEntries.length > 0 && (
            <button
              onClick={copyToClipboard}
              title={lang === 'ru'
                ? 'Скопировать таблицу в буфер обмена (для вставки в Word)'
                : 'Copy table to clipboard (paste into Word)'}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'7px 14px', borderRadius:3, cursor:'pointer',
                border:'1px solid var(--color-accent)',
                background: copied ? 'var(--color-primary)' : 'transparent',
                color: copied ? 'var(--color-accent)' : 'var(--color-primary)',
                fontFamily:'var(--font-body)', fontSize:13,
                fontWeight: copied ? 700 : 400,
                letterSpacing:'0.02em',
                transition:'background 0.2s, color 0.2s',
                flexShrink:0,
              }}
            >
              {copied
                ? (lang === 'ru' ? '✓ Скопировано!' : '✓ Copied!')
                : (lang === 'ru' ? '📋 Копировать' : '📋 Copy')}
            </button>
          )}
        </div>

        {daysWithEntries.length === 0 ? (
          <p style={{ color:'var(--color-muted)', fontStyle:'italic',
            fontFamily:'var(--font-body)', textAlign:'center', padding:'32px 0' }}>
            {lang === 'ru'
              ? 'Расписание богослужений на этот месяц ещё не добавлено.'
              : 'No service schedule posted for this month yet.'}
          </p>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse',
            fontFamily:'var(--font-body)', fontSize:16 }}>
            <tbody>
              {daysWithEntries.map(([dateStr, event]) => {
                const d        = new Date(dateStr + 'T12:00:00');
                const jsDay    = d.getDay();
                const dayData  = getDayData(d, true);
                const isSat    = jsDay === 6;
                const isSun    = jsDay === 0;
                const isWeekend = isSat || isSun;

                const dateLabel = lang === 'ru'
                  ? `${d.getDate()} ${MONTHS_RU_GENITIVE[month]}`
                  : `${d.getDate()} ${monthNameEn}`;
                const dayLabel = lang === 'ru' ? DAYS_RU[jsDay] : DAYS_EN[jsDay];
                const feastName = [
                  getFeastName(dayData.moveableFeast, lang),
                  getFeastName(dayData.fixedFeast, lang),
                ].filter(Boolean).join(' · ');

                const entryText = lang === 'ru'
                  ? (event.entriesRu || event.entriesEn)
                  : (event.entriesEn || event.entriesRu);

                return (
                  <tr key={dateStr} style={{ borderTop:'1px solid var(--color-accent)', verticalAlign:'top' }}>
                    <td style={{ padding:'12px 16px 12px 0', width:'28%', minWidth:110 }}>
                      <div style={{ fontWeight:700, fontSize:17,
                        color: isWeekend ? '#8B0000' : 'var(--color-primary)' }}>
                        {dateLabel}
                      </div>
                      <div style={{ fontSize:14, color:'var(--color-muted)', marginTop:1, lineHeight:1.3 }}>
                        {dayLabel}
                      </div>
                      {feastName && (
                        <div style={{ fontSize:11.5, color:'#8B0000', fontStyle:'italic',
                          marginTop:3, lineHeight:1.3 }}>
                          {feastName}
                        </div>
                      )}
                    </td>
                    <td style={{ padding:'12px 0 12px 16px',
                      borderLeft:'2px solid var(--color-accent)',
                      color:'var(--color-text)', fontSize:16 }}>
                      {renderEntryText(entryText)}
                    </td>
                  </tr>
                );
              })}
              {/* Bottom border */}
              <tr>
                <td colSpan={2} style={{ borderTop:'1px solid var(--color-accent)', padding:0, height:0 }} />
              </tr>
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // ── CALENDAR VIEW ─────────────────────────────────────────────────────────
  function renderCalendarView() {
    const DOW    = lang === 'ru' ? DOW_RU : DOW_EN;
    const firstDay    = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: (Date|null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const selectedEvent   = selectedDate ? events[selectedDate] : null;
    const selectedDayData = selectedDate
      ? getDayData(new Date(selectedDate + 'T00:00:00'), true)
      : null;

    function formatSelectedDate(dateStr: string) {
      const d = new Date(dateStr + 'T12:00:00');
      if (lang === 'ru') {
        return `${DAYS_RU[d.getDay()]}, ${d.getDate()} ${MONTHS_RU_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
      }
      return d.toLocaleDateString('en-NZ', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }

    return (
      <div>
        <div style={{ background:'var(--color-surface,#fff)',
          border:'1px solid var(--color-accent)', borderRadius:3, overflow:'hidden',
          marginBottom: selectedDate ? 16 : 0 }}>

          {/* DOW header */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)',
            borderBottom:'1px solid var(--color-accent)', background:'var(--color-primary)' }}>
            {DOW.map((d, i) => (
              <div key={d} style={{ textAlign:'center', padding:'8px 0', fontSize:11,
                fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                color: i >= 5 ? 'var(--color-accent)' : 'rgba(255,255,255,0.75)' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1,
            background:'var(--color-accent)', padding:1 }}>
            {cells.map((date, idx) => {
              if (!date) return (
                <div key={idx} style={{ background:'var(--color-bg,#f8f5ee)', minHeight:52 }} />
              );
              const dateStr    = toDateStr(date);
              const dayData    = getDayData(date, true);
              const cs         = getCellStyle(dayData);
              const isSelected = selectedDate === dateStr;
              const hasEntries = !!events[dateStr];
              const isSat      = date.getDay() === 6;
              const feastName  = getFeastName(dayData.moveableFeast, lang) || getFeastName(dayData.fixedFeast, lang);
              const short      = feastName.length > 20 ? feastName.substring(0,18)+'…' : feastName;

              return (
                <button key={idx}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  style={{ background:cs.bg, border:'none',
                    outline: isSelected ? '2px solid var(--color-accent)' : 'none',
                    outlineOffset:-2, padding:'6px 3px 5px', minHeight:52,
                    cursor:'pointer', position:'relative',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.95)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
                >
                  <span style={{ fontFamily:'var(--font-display)', fontSize:15, lineHeight:1,
                    fontWeight: cs.bold || isSat ? 700 : 400,
                    color: (isSat && !cs.bold) ? '#8B0000' : cs.text }}>
                    {date.getDate()}
                  </span>
                  {short && (
                    <span style={{ fontSize:7.5, color:cs.text, opacity:0.7,
                      textAlign:'center', lineHeight:1.2, wordBreak:'break-word', padding:'0 2px' }}>
                      {short}
                    </span>
                  )}
                  {dayData.fast && dayData.fast !== 'fastfree' && (
                    <span
                      title={getFastLabel(dayData.fast, lang)}
                      style={{ position:'absolute', top:3, left:3,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        filter:'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }}
                    >
                      <FastIcon type={dayData.fast} size={22} />
                    </span>
                  )}
                  {dayData.nzHoliday && (
                    <span style={{ position:'absolute', top:0, right:0, width:0, height:0,
                      borderStyle:'solid', borderWidth:'0 8px 8px 0',
                      borderColor:'transparent #2A7A6A transparent transparent' }} />
                  )}
                  {hasEntries && (
                    <span style={{ position:'absolute', bottom:3, right:3,
                      width:5, height:5, borderRadius:'50%', background:'var(--color-primary)' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDate && selectedDayData && (
          <div style={{ background:'var(--color-surface,#fff)',
            border:'1px solid var(--color-accent)', borderRadius:3, padding:'20px 24px' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:17,
              fontWeight:600, color:'var(--color-primary)',
              letterSpacing:'0.02em', textTransform:'uppercase' }}>
              {formatSelectedDate(selectedDate)}
            </div>
            {(selectedDayData.moveableFeast || selectedDayData.fixedFeast) && (
              <div style={{ marginTop:4, fontSize:14, fontStyle:'italic',
                color:'#8B0000', fontFamily:'var(--font-body)' }}>
                ✦{' '}
                {selectedDayData.isPascha
                  ? (lang === 'ru' ? 'СВЯТАЯ ПАСХА' : 'HOLY PASCHA')
                  : [
                      getFeastName(selectedDayData.moveableFeast, lang),
                      getFeastName(selectedDayData.fixedFeast, lang),
                    ].filter(Boolean).join(' · ')}
              </div>
            )}
            {selectedDayData.nzHoliday && (
              <div style={{ marginTop:3, fontSize:13, color:'#2A7A6A', fontFamily:'var(--font-body)' }}>
                🇳🇿 {selectedDayData.nzHoliday.name}
              </div>
            )}
            {selectedDayData.fast && (
              <div style={{ marginTop:3, fontSize:13, display:'flex', alignItems:'center', gap:6,
                color: FAST_DISPLAY[selectedDayData.fast].color, fontFamily:'var(--font-body)' }}>
                {selectedDayData.fast !== 'fastfree' && (
                  <span style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <FastIcon type={selectedDayData.fast} size={30} />
                  </span>
                )}
                {getFastLabel(selectedDayData.fast, lang)}
              </div>
            )}
            {selectedDayData.julianDateStr && (
              <div style={{ marginTop:3, fontSize:11, color:'var(--color-muted)', fontFamily:'var(--font-body)' }}>
                {lang === 'ru' ? 'По старому стилю: ' : 'Old Style: '}{selectedDayData.julianDateStr}
              </div>
            )}
            <div style={{ borderTop:'1px solid var(--color-accent)', paddingTop:14, marginTop:12 }}>
              {selectedEvent ? (
                <>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em',
                    textTransform:'uppercase', color:'var(--color-muted)',
                    marginBottom:10, fontFamily:'var(--font-body)' }}>
                    {lang === 'ru' ? 'Расписание богослужений' : 'Service Schedule'}
                  </div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:16,
                    lineHeight:1.8, color:'var(--color-text)' }}>
                    {renderEntryText(
                      lang === 'ru'
                        ? (selectedEvent.entriesRu || selectedEvent.entriesEn)
                        : (selectedEvent.entriesEn || selectedEvent.entriesRu)
                    )}
                  </div>
                </>
              ) : (
                <p style={{ margin:0, fontSize:14, color:'var(--color-muted)',
                  fontStyle:'italic', fontFamily:'var(--font-body)' }}>
                  {lang === 'ru'
                    ? 'Расписание богослужений пока не добавлено.'
                    : 'No service schedule posted for this day yet.'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', gap:'6px 16px',
          fontSize:11, color:'var(--color-muted)', fontFamily:'var(--font-body)' }}>
          {[
            { bg:'#FFF0D0', label: lang === 'ru' ? 'Пасха' : 'Pascha' },
            { bg:'#FDE8E8', label: lang === 'ru' ? 'Великий праздник' : 'Great Feast' },
            { bg:'#EEF5E8', label: lang === 'ru' ? 'Вербное / Пятидесятница' : 'Palm / Pentecost' },
            { bg:'#FFFAE0', label: lang === 'ru' ? 'Светлая неделя' : 'Bright Week' },
            { bg:'#F5E8E0', label: lang === 'ru' ? 'Страстная неделя' : 'Holy Week' },
          ].map(item => (
            <span key={item.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:item.bg,
                border:'1px solid #ccc', display:'inline-block', flexShrink:0 }} />
              {item.label}
            </span>
          ))}
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-primary)',
              display:'inline-block', flexShrink:0 }} />
            {lang === 'ru' ? 'Есть расписание' : 'Schedule posted'}
          </span>
        </div>

        {/* Fasting legend */}
        <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:'6px 16px',
          fontSize:11, color:'var(--color-muted)', fontFamily:'var(--font-body)' }}>
          {(['strict','oilwine','fish','dairy','totalfast'] as const).map(type => (
            <span key={type} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <FastIcon type={type} size={22} />
              </span>
              {getFastLabel(type, lang)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom:48 }}>
      {renderHeader()}
      {view === 'list' ? renderListView() : renderCalendarView()}
    </div>
  );
}
