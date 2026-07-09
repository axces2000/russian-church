// src/components/ServiceCalendar.tsx
// Public-facing service schedule — Julian feast highlighting + per-day entries.
// Embedded in the Services section page.

import { useEffect, useState } from 'react';
import { useLang } from '../contexts/LangContext';
import { getDayData } from '../lib/calendarData';
import type { DayData } from '../lib/calendarData';
import { subscribeServiceEventsForMonth } from '../lib/firestore';
import type { ServiceEvent } from '../lib/firestore';

const MONTH_NAMES_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_NAMES_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];
const DOW_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DOW_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Cell styling (matches admin palette) ────────────────────────────────────
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

export default function ServiceCalendar() {
  const { lang } = useLang();
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const [events, setEvents] = useState<Record<string, ServiceEvent>>({});

  useEffect(() => subscribeServiceEventsForMonth(year, month, setEvents), [year, month]);

  // Jump to today on mount
  useEffect(() => {
    const today = new Date();
    setSelectedDate(toDateStr(today));
  }, []);

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

  const MONTHS = lang === 'ru' ? MONTH_NAMES_RU : MONTH_NAMES_EN;
  const DOW    = lang === 'ru' ? DOW_RU : DOW_EN;

  // ── Grid ──────────────────────────────────────────────────────────────────
  const firstDay    = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells: (Date|null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // ── Selected day detail ───────────────────────────────────────────────────
  const selectedEvent = selectedDate ? events[selectedDate] : null;
  const selectedDayData = selectedDate
    ? getDayData(new Date(selectedDate + 'T12:00:00'), true)
    : null;

  function formatSelectedDate(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00');
    if (lang === 'ru') {
      const ruMonths = ['января','февраля','марта','апреля','мая','июня',
                        'июля','августа','сентября','октября','ноября','декабря'];
      const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
      return `${days[d.getDay()]}, ${d.getDate()} ${ruMonths[d.getMonth()]} ${d.getFullYear()}`;
    }
    return d.toLocaleDateString('en-NZ', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  return (
    <div style={{ marginBottom: 48 }}>

      {/* ── Month nav ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button
          onClick={prevMonth}
          aria-label={lang === 'ru' ? 'Предыдущий месяц' : 'Previous month'}
          style={{
            background:'none', border:'1px solid var(--color-accent)', borderRadius:2,
            color:'var(--color-accent)', padding:'7px 14px', cursor:'pointer', fontSize:16,
          }}
        >←</button>

        <h2 style={{
          flex:1, textAlign:'center', margin:0,
          fontFamily:'var(--font-display)', fontSize:22,
          color:'var(--color-primary)', fontWeight:600,
          letterSpacing:'0.03em', textTransform:'uppercase',
        }}>
          {MONTHS[month]} {year}
        </h2>

        <button
          onClick={nextMonth}
          aria-label={lang === 'ru' ? 'Следующий месяц' : 'Next month'}
          style={{
            background:'none', border:'1px solid var(--color-accent)', borderRadius:2,
            color:'var(--color-accent)', padding:'7px 14px', cursor:'pointer', fontSize:16,
          }}
        >→</button>
      </div>

      {/* ── Calendar grid ── */}
      <div style={{
        background:'var(--color-surface,#fff)',
        border:'1px solid var(--color-accent)',
        borderRadius:3, overflow:'hidden',
        marginBottom: selectedDate ? 16 : 0,
      }}>
        {/* DOW header */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)',
          borderBottom:'1px solid var(--color-accent)', background:'var(--color-primary)' }}>
          {DOW.map((d, i) => (
            <div key={d} style={{
              textAlign:'center', padding:'8px 0', fontSize:11,
              fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
              color: i >= 5 ? 'var(--color-accent)' : 'rgba(255,255,255,0.75)',
            }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1,
          background:'var(--color-accent)', padding:1 }}>
          {cells.map((date, idx) => {
            if (!date) return (
              <div key={idx} style={{ background:'var(--color-bg,#f8f5ee)', minHeight:52 }} />
            );

            const dateStr  = toDateStr(date);
            const dayData  = getDayData(date, true); // Julian calendar
            const cs       = getCellStyle(dayData);
            const isSelected = selectedDate === dateStr;
            const hasEntries = !!events[dateStr];
            const isSat      = date.getDay() === 6;
            const feastName  = dayData.moveableFeast?.name || dayData.fixedFeast?.name || '';
            const short      = feastName.length > 20 ? feastName.substring(0,18)+'…' : feastName;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                aria-label={`${date.getDate()} ${MONTHS[month]}${feastName ? `, ${feastName}` : ''}`}
                aria-pressed={isSelected}
                style={{
                  background: cs.bg,
                  border: 'none',
                  outline: isSelected ? '2px solid var(--color-accent)' : 'none',
                  outlineOffset: -2,
                  padding:'6px 3px 5px', minHeight:52,
                  cursor:'pointer', position:'relative',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  transition:'filter 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.95)')}
                onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              >
                <span style={{
                  fontFamily:'var(--font-display)',
                  fontSize:15, lineHeight:1,
                  fontWeight: cs.bold || isSat ? 700 : 400,
                  color: (isSat && !cs.bold) ? '#8B0000' : cs.text,
                }}>
                  {date.getDate()}
                </span>
                {short && (
                  <span style={{ fontSize:7.5, color:cs.text, opacity:0.7,
                    textAlign:'center', lineHeight:1.2, fontFamily:'var(--font-body)',
                    wordBreak:'break-word', padding:'0 2px' }}>
                    {short}
                  </span>
                )}
                {/* NZ holiday ribbon */}
                {dayData.nzHoliday && (
                  <span style={{ position:'absolute', top:0, right:0, width:0, height:0,
                    borderStyle:'solid', borderWidth:'0 8px 8px 0',
                    borderColor:'transparent #2A7A6A transparent transparent' }} />
                )}
                {/* Entry dot */}
                {hasEntries && (
                  <span style={{ position:'absolute', bottom:3, right:3,
                    width:5, height:5, borderRadius:'50%',
                    background:'var(--color-primary)' }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day detail panel ── */}
      {selectedDate && selectedDayData && (
        <div style={{
          background:'var(--color-surface,#fff)',
          border:'1px solid var(--color-accent)',
          borderRadius:3, padding:'20px 24px',
        }}>
          {/* Date heading */}
          <div style={{ marginBottom: selectedEvent ? 16 : 0 }}>
            <div style={{
              fontFamily:'var(--font-display)', fontSize:17,
              fontWeight:600, color:'var(--color-primary)',
              letterSpacing:'0.02em', textTransform:'uppercase',
            }}>
              {formatSelectedDate(selectedDate)}
            </div>

            {/* Feast name */}
            {(selectedDayData.moveableFeast || selectedDayData.fixedFeast) && (
              <div style={{ marginTop:4, fontSize:14, fontStyle:'italic',
                color:'#8B0000', fontFamily:'var(--font-body)' }}>
                ✦{' '}
                {selectedDayData.isPascha
                  ? (lang === 'ru' ? 'СВЯТАЯ ПАСХА' : 'HOLY PASCHA')
                  : (selectedDayData.moveableFeast?.name || selectedDayData.fixedFeast?.name)}
              </div>
            )}

            {/* NZ holiday */}
            {selectedDayData.nzHoliday && (
              <div style={{ marginTop:3, fontSize:13, color:'#2A7A6A',
                fontFamily:'var(--font-body)' }}>
                🇳🇿 {selectedDayData.nzHoliday.name}
              </div>
            )}

            {/* Julian date info */}
            {selectedDayData.julianDateStr && (
              <div style={{ marginTop:3, fontSize:11, color:'var(--color-muted)',
                fontFamily:'var(--font-body)' }}>
                {lang === 'ru' ? 'По старому стилю: ' : 'Old Style: '}
                {selectedDayData.julianDateStr}
              </div>
            )}
          </div>

          {/* Service entries */}
          {selectedEvent ? (
            <div>
              <div style={{
                borderTop:'1px solid var(--color-accent)', paddingTop:14,
                marginTop:12,
              }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em',
                  textTransform:'uppercase', color:'var(--color-muted)',
                  marginBottom:10 }}>
                  {lang === 'ru' ? 'Расписание богослужений' : 'Service Schedule'}
                </div>
                <pre style={{
                  margin:0,
                  fontFamily:'var(--font-body)', fontSize:15.5,
                  lineHeight:1.8, color:'var(--color-text)',
                  whiteSpace:'pre-wrap',
                }}>
                  {lang === 'ru'
                    ? (selectedEvent.entriesRu || selectedEvent.entriesEn)
                    : (selectedEvent.entriesEn || selectedEvent.entriesRu)}
                </pre>
              </div>
            </div>
          ) : (
            <div style={{
              marginTop:12, paddingTop:12,
              borderTop:'1px solid var(--color-accent)',
              fontSize:14, color:'var(--color-muted)',
              fontStyle:'italic', fontFamily:'var(--font-body)',
            }}>
              {lang === 'ru'
                ? 'Расписание богослужений пока не добавлено.'
                : 'No service schedule posted for this day yet.'}
            </div>
          )}
        </div>
      )}

      {/* ── Legend ── */}
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
          <span style={{ width:6, height:6, borderRadius:'50%',
            background:'var(--color-primary)', display:'inline-block', flexShrink:0 }} />
          {lang === 'ru' ? 'Есть расписание' : 'Schedule posted'}
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:0, height:0, borderStyle:'solid', display:'inline-block',
            borderWidth:'0 8px 8px 0', flexShrink:0,
            borderColor:'transparent #2A7A6A transparent transparent' }} />
          {lang === 'ru' ? 'Праздник НЗ' : 'NZ holiday'}
        </span>
      </div>
    </div>
  );
}
