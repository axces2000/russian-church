// src/components/SundaySchoolCalendar.tsx
// Public-facing Sunday School schedule.
// Default: list/table view with copy-to-clipboard for Word.
// Toggle: simple calendar grid (weekends + NZ holidays only, no church markings).
// Lesson header lines (containing HH:MM) are bolded and act as section headings.
// Sub-item lines (no time) are indented under their lesson header.

import { useEffect, useState } from 'react';
import { useLang } from '../contexts/LangContext';
import { NZ_HOLIDAYS } from '../lib/calendarData';
import { subscribeSSEventsForMonth } from '../lib/firestore';
import type { SSEvent } from '../lib/firestore';

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
function getNZHoliday(date: Date): string | null {
  return NZ_HOLIDAYS[toDateStr(date)]?.name || null;
}
const TIME_RE = /\b\d{1,2}:\d{2}\b/;

// Is this line a lesson header (contains a time)?
function isLessonHeader(line: string): boolean {
  return TIME_RE.test(line);
}

// Bold the time portion within a line — returns React nodes
function parseTimeLine(line: string): React.ReactNode[] {
  const parts = line.split(/(\b\d{1,2}:\d{2}\b)/);
  return parts.map((part, i) =>
    /^\d{1,2}:\d{2}$/.test(part)
      ? <strong key={i}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}

// Render multi-line entry: lesson headers bold + no indent, sub-items indented
function renderSSEntries(text: string): React.ReactNode {
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <>
      {lines.map((line, i) => {
        const isHeader = isLessonHeader(line);
        return (
          <div key={i} style={{
            lineHeight: 1.6,
            paddingLeft: isHeader ? 0 : 18,
            marginTop: isHeader && i > 0 ? 8 : 0,
            fontWeight: isHeader ? 700 : 400,
          }}>
            {parseTimeLine(line)}
          </div>
        );
      })}
    </>
  );
}

// Bold times in a string → HTML (for clipboard)
function timeLineToHtml(line: string): string {
  return line.replace(/(\b\d{1,2}:\d{2}\b)/g, '<strong>$1</strong>');
}

// Build HTML for one entry block (for Word copy)
function ssEntryToHtml(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map((line, i) => {
    const isHeader = isLessonHeader(line);
    if (isHeader) {
      const spacing = i > 0 ? 'margin:6pt 0 2pt 0' : 'margin:0 0 2pt 0';
      return `<p style="${spacing};font-weight:bold;line-height:1.4"><strong>${timeLineToHtml(line)}</strong></p>`;
    }
    return `<p style="margin:0 0 1pt 14pt;line-height:1.4">${timeLineToHtml(line)}</p>`;
  }).join('');
}

// Simple cell style — weekends + holidays only
function getCellStyle(date: Date) {
  const jsDay = date.getDay();
  if (jsDay === 0) return { bg:'#FFF5F5', border:'#D4B0B0', text:'#8B0000', bold:true  };
  if (jsDay === 6) return { bg:'#FFF8F8', border:'#E0C0C0', text:'#8B0000', bold:false };
  return { bg:'var(--color-surface,#fff)', border:'var(--color-accent,#c9a227)', text:'var(--color-text)', bold:false };
}

// Open-book silhouette — marks a day with a posted Sunday School schedule.
// Uses the theme's own accent color so it stays visually integrated with
// whichever template is active.
function BookIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="1.3" fill="#fff" stroke="var(--color-primary)" strokeWidth="1.4" />
      <line x1="12" y1="2" x2="12" y2="22" stroke="var(--color-primary)" strokeWidth="1.4" />
      <rect x="4.3" y="5.5" width="5.4" height="1.1" fill="var(--color-primary)" />
      <rect x="4.3" y="9" width="5.4" height="1.1" fill="var(--color-primary)" />
      <rect x="4.3" y="12.5" width="5.4" height="1.1" fill="var(--color-primary)" />
      <rect x="4.3" y="16" width="5.4" height="1.1" fill="var(--color-primary)" />
      <rect x="14.3" y="5.5" width="5.4" height="1.1" fill="var(--color-primary)" />
      <rect x="14.3" y="9" width="5.4" height="1.1" fill="var(--color-primary)" />
      <rect x="14.3" y="12.5" width="5.4" height="1.1" fill="var(--color-primary)" />
      <rect x="14.3" y="16" width="5.4" height="1.1" fill="var(--color-primary)" />
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function SundaySchoolCalendar() {
  const { lang } = useLang();
  const [view,         setView]         = useState<'list'|'calendar'>('list');
  const [year,         setYear]         = useState(new Date().getFullYear());
  const [month,        setMonth]        = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const [events,       setEvents]       = useState<Record<string, SSEvent>>({});
  const [copied,       setCopied]       = useState(false);

  useEffect(() => subscribeSSEventsForMonth(year, month, setEvents), [year, month]);

  function prevMonth() {
    setSelectedDate(null);
    if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1);
  }
  function nextMonth() {
    setSelectedDate(null);
    if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1);
  }

  const monthNameEn = MONTHS_EN[month];
  const monthNameRu = MONTHS_RU_TITLE[month];

  const daysWithEntries = Object.entries(events)
    .filter(([dateStr]) => {
      const d = new Date(dateStr + 'T12:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  async function copyToClipboard() {
    const title = lang === 'ru'
      ? `Расписание воскресной школы на ${monthNameRu} ${year}`
      : `Sunday School Schedule for ${monthNameEn} ${year}`;

    const tableRows = daysWithEntries.map(([dateStr, event]) => {
      const d         = new Date(dateStr + 'T12:00:00');
      const jsDay     = d.getDay();
      const dateLabel = lang === 'ru'
        ? `${d.getDate()} ${MONTHS_RU_GENITIVE[month]}`
        : `${d.getDate()} ${monthNameEn}`;
      const dayLabel  = lang === 'ru' ? DAYS_RU[jsDay] : DAYS_EN[jsDay];
      const holiday   = getNZHoliday(d);
      const raw = lang === 'ru'
        ? (event.entriesRu || event.entriesEn)
        : (event.entriesEn || event.entriesRu);

      const dateCellContent = holiday
        ? `<strong>${dateLabel}</strong><br/>${dayLabel}<br/><span style="color:#2A7A6A;font-size:9pt">🇳🇿 ${holiday}</span>`
        : `<strong>${dateLabel}</strong><br/>${dayLabel}`;

      return `
        <tr>
          <td style="padding:7pt 10pt;width:26%;vertical-align:top;border:1pt solid black">
            ${dateCellContent}
          </td>
          <td style="padding:7pt 10pt;vertical-align:top;border:1pt solid black">
            ${ssEntryToHtml(raw)}
          </td>
        </tr>`;
    }).join('');

    const html = `
      <html><head><meta charset="utf-8"/></head><body>
        <p style="text-align:center;font-weight:bold;font-size:14pt;
                  font-family:Calibri,Arial,sans-serif;margin:0 0 10pt 0">
          ${title}
        </p>
        <table style="border-collapse:collapse;width:100%;
                      font-family:Calibri,Arial,sans-serif;font-size:11pt">
          <tbody>${tableRows}</tbody>
        </table>
      </body></html>`;

    const plain = [
      title, '',
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
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        await navigator.clipboard.writeText(plain);
        setCopied(true); setTimeout(() => setCopied(false), 2500);
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
          style={{ background:'none', border:'1px solid var(--color-accent)', borderRadius:2,
            color:'var(--color-accent)', padding:'7px 14px', cursor:'pointer', fontSize:16, flexShrink:0 }}>←</button>

        <h2 style={{ flex:1, textAlign:'center', margin:0,
          fontFamily:'var(--font-display)', fontSize:20, fontWeight:600,
          color:'var(--color-primary)', letterSpacing:'0.03em', textTransform:'uppercase' }}>
          {lang === 'ru' ? `${monthNameRu} ${year}` : `${monthNameEn} ${year}`}
        </h2>

        <button onClick={nextMonth}
          style={{ background:'none', border:'1px solid var(--color-accent)', borderRadius:2,
            color:'var(--color-accent)', padding:'7px 14px', cursor:'pointer', fontSize:16, flexShrink:0 }}>→</button>

        <div style={{ display:'flex', border:'1px solid var(--color-accent)',
          borderRadius:3, overflow:'hidden', flexShrink:0 }}>
          {(['list','calendar'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:'7px 14px', border:'none', cursor:'pointer', fontSize:12,
              fontWeight: view === v ? 700 : 400, letterSpacing:'0.04em', textTransform:'uppercase',
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
      ? `Расписание воскресной школы на ${monthNameRu} ${year}`
      : `Sunday School Schedule for ${monthNameEn} ${year}`;

    return (
      <div>
        <div style={{ display:'flex', alignItems:'center',
          justifyContent:'space-between', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <div style={{ flex:1, textAlign:'center', fontFamily:'var(--font-display)',
            fontSize:18, fontWeight:600, color:'var(--color-primary)', letterSpacing:'0.02em' }}>
            {title}
          </div>
          {daysWithEntries.length > 0 && (
            <button onClick={copyToClipboard}
              style={{ display:'flex', alignItems:'center', gap:6,
                padding:'7px 14px', borderRadius:3, cursor:'pointer',
                border:'1px solid var(--color-accent)', flexShrink:0,
                background: copied ? 'var(--color-primary)' : 'transparent',
                color: copied ? 'var(--color-accent)' : 'var(--color-primary)',
                fontFamily:'var(--font-body)', fontSize:13,
                fontWeight: copied ? 700 : 400, letterSpacing:'0.02em',
                transition:'background 0.2s, color 0.2s' }}>
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
              ? 'Расписание воскресной школы на этот месяц ещё не добавлено.'
              : 'No Sunday School schedule posted for this month yet.'}
          </p>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse',
            fontFamily:'var(--font-body)', fontSize:16 }}>
            <tbody>
              {daysWithEntries.map(([dateStr, event]) => {
                const d       = new Date(dateStr + 'T12:00:00');
                const jsDay   = d.getDay();
                const isSun   = jsDay === 0;
                const isSat   = jsDay === 6;
                const holiday = getNZHoliday(d);
                const dateLabel = lang === 'ru'
                  ? `${d.getDate()} ${MONTHS_RU_GENITIVE[month]}`
                  : `${d.getDate()} ${monthNameEn}`;
                const dayLabel = lang === 'ru' ? DAYS_RU[jsDay] : DAYS_EN[jsDay];
                const entryText = lang === 'ru'
                  ? (event.entriesRu || event.entriesEn)
                  : (event.entriesEn || event.entriesRu);

                return (
                  <tr key={dateStr} style={{ borderTop:'1px solid var(--color-accent)', verticalAlign:'top' }}>
                    <td style={{ padding:'12px 16px 12px 0', width:'28%', minWidth:110 }}>
                      <div style={{ fontWeight:700, fontSize:17,
                        color: (isSun||isSat) ? '#8B0000' : 'var(--color-primary)' }}>
                        {dateLabel}
                      </div>
                      <div style={{ fontSize:14, color:'var(--color-muted)', marginTop:1, lineHeight:1.3 }}>
                        {dayLabel}
                      </div>
                      {holiday && (
                        <div style={{ fontSize:11.5, color:'#2A7A6A', marginTop:3, lineHeight:1.3 }}>
                          🇳🇿 {holiday}
                        </div>
                      )}
                    </td>
                    <td style={{ padding:'12px 0 12px 16px',
                      borderLeft:'2px solid var(--color-accent)',
                      color:'var(--color-text)', fontSize:15 }}>
                      {renderSSEntries(entryText)}
                    </td>
                  </tr>
                );
              })}
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
    const DOW     = lang === 'ru' ? DOW_RU : DOW_EN;
    const firstDay    = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: (Date|null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const selectedEvent   = selectedDate ? events[selectedDate] : null;

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
              const cs         = getCellStyle(date);
              const isSelected = selectedDate === dateStr;
              const hasEntries = !!events[dateStr];
              const holiday    = getNZHoliday(date);
              const isSat      = date.getDay() === 6;
              const short      = holiday
                ? (holiday.length > 16 ? holiday.substring(0,14)+'…' : holiday)
                : '';

              return (
                <button key={idx}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  title={holiday || ''}
                  style={{ background:cs.bg, border:'none',
                    outline: isSelected ? '2px solid var(--color-accent)' : 'none',
                    outlineOffset:-2, padding:'6px 3px 5px', minHeight:52,
                    cursor:'pointer', position:'relative',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.95)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
                >
                  <span style={{ fontFamily:'var(--font-display)', fontSize:15, lineHeight:1,
                    fontWeight: cs.bold || isSat ? 700 : 400, color: cs.text }}>
                    {date.getDate()}
                  </span>
                  {short && (
                    <span style={{ fontSize:7.5, color:'#2A7A6A', textAlign:'center',
                      lineHeight:1.2, wordBreak:'break-word', padding:'0 2px' }}>
                      {short}
                    </span>
                  )}
                  {holiday && (
                    <span style={{ position:'absolute', top:0, right:0, width:0, height:0,
                      borderStyle:'solid', borderWidth:'0 8px 8px 0',
                      borderColor:'transparent #2A7A6A transparent transparent' }} />
                  )}
                  {hasEntries && (
                    <span
                      title={lang === 'ru' ? 'Есть расписание' : 'Schedule posted'}
                      style={{ position:'absolute', bottom:2, right:2,
                        filter:'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }}
                    >
                      <BookIcon size={22} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        {selectedDate && (
          <div style={{ background:'var(--color-surface,#fff)',
            border:'1px solid var(--color-accent)', borderRadius:3, padding:'20px 24px' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:17,
              fontWeight:600, color:'var(--color-primary)',
              letterSpacing:'0.02em', textTransform:'uppercase' }}>
              {formatSelectedDate(selectedDate)}
            </div>
            {getNZHoliday(new Date(selectedDate + 'T12:00:00')) && (
              <div style={{ marginTop:4, fontSize:13, color:'#2A7A6A', fontFamily:'var(--font-body)' }}>
                🇳🇿 {getNZHoliday(new Date(selectedDate + 'T12:00:00'))}
              </div>
            )}
            <div style={{ borderTop:'1px solid var(--color-accent)', paddingTop:14, marginTop:12 }}>
              {selectedEvent ? (
                <>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em',
                    textTransform:'uppercase', color:'var(--color-muted)',
                    marginBottom:10, fontFamily:'var(--font-body)' }}>
                    {lang === 'ru' ? 'Расписание занятий' : 'Lesson Schedule'}
                  </div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:15,
                    lineHeight:1.7, color:'var(--color-text)' }}>
                    {renderSSEntries(
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
                    ? 'Расписание занятий пока не добавлено.'
                    : 'No lesson schedule posted for this day yet.'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', gap:'6px 16px',
          fontSize:11, color:'var(--color-muted)', fontFamily:'var(--font-body)' }}>
          {[
            { bg:'#FFF5F5', label: lang === 'ru' ? 'Воскресенье' : 'Sunday' },
            { bg:'#FFF8F8', label: lang === 'ru' ? 'Суббота' : 'Saturday' },
          ].map(item => (
            <span key={item.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:item.bg,
                border:'1px solid #ccc', display:'inline-block', flexShrink:0 }} />
              {item.label}
            </span>
          ))}
          <span style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <BookIcon size={15} />
            </span>
            {lang === 'ru' ? 'Есть расписание' : 'Schedule posted'}
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:0, height:0, display:'inline-block', borderStyle:'solid',
              borderWidth:'0 8px 8px 0', flexShrink:0,
              borderColor:'transparent #2A7A6A transparent transparent' }} />
            {lang === 'ru' ? 'Праздник НЗ' : 'NZ holiday'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom:48 }}>
      {renderHeader()}
      {view === 'list' ? renderListView() : renderCalendarView()}
    </div>
  );
}
