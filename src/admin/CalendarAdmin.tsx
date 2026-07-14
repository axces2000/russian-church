// src/admin/CalendarAdmin.tsx
// Service Schedule admin — month calendar with Julian feast highlighting,
// per-day bilingual plain-text entry editing, reusable full-day templates,
// and quick-insert individual entry types.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { getDayData } from '../lib/calendarData';
import type { DayData } from '../lib/calendarData';
import {
  subscribeServiceEventsForMonth,
  subscribeServiceTemplates,
  subscribeServiceEntryTypes,
  saveServiceEvent,
  deleteServiceEvent,
  saveServiceTemplate,
  deleteServiceTemplate,
  reorderServiceTemplates,
  saveServiceEntryType,
  deleteServiceEntryType,
  reorderServiceEntryTypes,
} from '../lib/firestore';
import type { ServiceEvent, ServiceTemplate, ServiceEntryType } from '../lib/firestore';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ── Feast cell styling ───────────────────────────────────────────────────────
function getCellStyle(d: DayData): { bg: string; border: string; text: string; bold: boolean } {
  const tier  = d.moveableFeast?.tier  || d.fixedFeast?.tier;
  const color = d.moveableFeast?.color || d.fixedFeast?.color;
  if (d.isPascha)            return { bg:'#FFF0D0', border:'#C4881A', text:'#8B0000', bold:true  };
  if (d.isHolyWeek)          return { bg:'#F5E8E0', border:'#B07060', text:'#6A2010', bold:false };
  if (d.isBrightWeek)        return { bg:'#FFFAE0', border:'#C8A820', text:'#7A5A00', bold:false };
  if (color === 'palm')      return { bg:'#EEF5E8', border:'#6A9050', text:'#2E5820', bold:true  };
  if (color === 'pentecost') return { bg:'#EEF5E8', border:'#5A8A48', text:'#2A5818', bold:true  };
  if (color === 'nativity')  return { bg:'#EAF0FA', border:'#5A78B8', text:'#1E3870', bold:true  };
  if (tier  === 'great')     return { bg:'#FDE8E8', border:'#C07070', text:'#7A1010', bold:true  };
  if (d.isSunday)            return { bg:'#FFF5F5', border:'#D4B0B0', text:'#8B0000', bold:true  };
  return { bg:'#fff', border:'#e0dbd0', text:'#333', bold:false };
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-NZ', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

const s = {
  wrap:       { minHeight:'100vh', background:'#f5f5f0', fontFamily:'system-ui, sans-serif' } as React.CSSProperties,
  topBar:     { background:'#2c1a3e', color:'#fff', padding:'14px 32px', display:'flex',
                alignItems:'center', justifyContent:'space-between' } as React.CSSProperties,
  body:       { maxWidth:1100, margin:'0 auto', padding:'28px 20px' } as React.CSSProperties,
  card:       { background:'#fff', border:'1px solid #e0dbd0', borderRadius:6 } as React.CSSProperties,
  btn:        { padding:'7px 16px', borderRadius:4, fontSize:13, cursor:'pointer',
                border:'1px solid #ddd', background:'#fff' } as React.CSSProperties,
  btnPrimary: { padding:'9px 22px', borderRadius:4, fontSize:13, fontWeight:600 as const,
                cursor:'pointer', border:'none', background:'#2c1a3e', color:'#fff' } as React.CSSProperties,
  btnDanger:  { padding:'7px 14px', borderRadius:4, fontSize:12, cursor:'pointer',
                border:'1px solid #e74c3c', background:'#fff', color:'#e74c3c' } as React.CSSProperties,
  label:      { fontSize:12, fontWeight:600 as const, color:'#444', display:'block' as const, marginBottom:5 },
  textarea:   { width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:4,
                fontSize:13.5, fontFamily:'system-ui, sans-serif', lineHeight:1.7,
                resize:'vertical' as const, minHeight:130 } as React.CSSProperties,
};

// ════════════════════════════════════════════════════════════════════════════
export default function CalendarAdmin() {
  const [tab, setTab] = useState<'schedule'|'templates'|'entries'>('schedule');

  // ── Schedule state ────────────────────────────────────────────────────────
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const [events,  setEvents]  = useState<Record<string, ServiceEvent>>({});
  const [editEn,  setEditEn]  = useState('');
  const [editRu,  setEditRu]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // ── Shared library state ──────────────────────────────────────────────────
  const [templates,   setTemplates]   = useState<ServiceTemplate[]>([]);
  const [entryTypes,  setEntryTypes]  = useState<ServiceEntryType[]>([]);

  // ── Template tab state ────────────────────────────────────────────────────
  const [tplEditingId,  setTplEditingId]  = useState<string|null>(null);
  const [tplEditValue,  setTplEditValue]  = useState<Partial<ServiceTemplate>>({});
  const [tplAddingNew,  setTplAddingNew]  = useState(false);
  const [tplNewValue,   setTplNewValue]   = useState<Partial<ServiceTemplate>>({});
  const [tplSaving,     setTplSaving]     = useState(false);

  // ── Entry types tab state ─────────────────────────────────────────────────
  const [etEditingId,   setEtEditingId]   = useState<string|null>(null);
  const [etEditValue,   setEtEditValue]   = useState<Partial<ServiceEntryType>>({});
  const [etAddingNew,   setEtAddingNew]   = useState(false);
  const [etNewValue,    setEtNewValue]    = useState<Partial<ServiceEntryType>>({});
  const [etSaving,      setEtSaving]      = useState(false);

  // ── Subscriptions ─────────────────────────────────────────────────────────
  useEffect(() => subscribeServiceEventsForMonth(year, month, setEvents), [year, month]);
  useEffect(() => subscribeServiceTemplates(setTemplates), []);
  useEffect(() => subscribeServiceEntryTypes(setEntryTypes), []);

  // Sync edit state when events or selected date changes
  useEffect(() => {
    if (!selectedDate) return;
    const ev = events[selectedDate];
    setEditEn(ev?.entriesEn ?? '');
    setEditRu(ev?.entriesRu ?? '');
  }, [events, selectedDate]);

  // ── Schedule actions ──────────────────────────────────────────────────────
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
  function handleDayClick(dateStr: string) {
    if (selectedDate === dateStr) { setSelectedDate(null); return; }
    setSelectedDate(dateStr);
    setSaved(false);
  }
  function applyTemplate(t: ServiceTemplate) {
    setEditEn(t.entriesEn);
    setEditRu(t.entriesRu);
  }
  // Append a single entry type line to both textareas
  function appendEntry(et: ServiceEntryType) {
    setEditEn(prev => { const t = prev.trimEnd(); return t ? t + '\n' + et.textEn : et.textEn; });
    setEditRu(prev => { const t = prev.trimEnd(); return t ? t + '\n' + et.textRu : et.textRu; });
  }
  async function handleSave() {
    if (!selectedDate) return;
    setSaving(true);
    const ym = selectedDate.substring(0, 7);
    await saveServiceEvent({ date: selectedDate, yearMonth: ym, entriesEn: editEn, entriesRu: editRu });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }
  async function handleClear() {
    if (!selectedDate) return;
    if (!window.confirm('Remove all service entries for this day?')) return;
    await deleteServiceEvent(selectedDate);
    setEditEn(''); setEditRu('');
  }

  // ── Template actions ──────────────────────────────────────────────────────
  async function handleSaveTemplate(tpl: ServiceTemplate) {
    setTplSaving(true);
    await saveServiceTemplate(tpl);
    setTplEditingId(null); setTplEditValue({});
    setTplSaving(false);
  }
  async function handleAddTemplate() {
    if (!tplNewValue.nameEn) return;
    setTplSaving(true);
    await saveServiceTemplate({
      id: uuid(), order: templates.length,
      nameEn: tplNewValue.nameEn || '', nameRu: tplNewValue.nameRu || '',
      entriesEn: tplNewValue.entriesEn || '', entriesRu: tplNewValue.entriesRu || '',
    });
    setTplNewValue({}); setTplAddingNew(false); setTplSaving(false);
  }
  async function handleDeleteTemplate(id: string) {
    if (!window.confirm('Delete this template?')) return;
    await deleteServiceTemplate(id);
  }
  async function moveTpl(idx: number, dir: -1|1) {
    const updated = [...templates];
    const swap = idx + dir;
    if (swap < 0 || swap >= updated.length) return;
    [updated[idx], updated[swap]] = [updated[swap], updated[idx]];
    await reorderServiceTemplates(updated);
  }

  // ── Entry type actions ────────────────────────────────────────────────────
  async function handleSaveEntryType(et: ServiceEntryType) {
    setEtSaving(true);
    await saveServiceEntryType(et);
    setEtEditingId(null); setEtEditValue({});
    setEtSaving(false);
  }
  async function handleAddEntryType() {
    if (!etNewValue.textEn) return;
    setEtSaving(true);
    await saveServiceEntryType({
      id: uuid(), order: entryTypes.length,
      textEn: etNewValue.textEn || '', textRu: etNewValue.textRu || '',
    });
    setEtNewValue({}); setEtAddingNew(false); setEtSaving(false);
  }
  async function handleDeleteEntryType(id: string) {
    if (!window.confirm('Delete this entry type?')) return;
    await deleteServiceEntryType(id);
  }
  async function moveEt(idx: number, dir: -1|1) {
    const updated = [...entryTypes];
    const swap = idx + dir;
    if (swap < 0 || swap >= updated.length) return;
    [updated[idx], updated[swap]] = [updated[swap], updated[idx]];
    await reorderServiceEntryTypes(updated);
  }

  // ── Month grid ────────────────────────────────────────────────────────────
  function renderGrid() {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: (Date|null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
        {DOW.map((d, i) => (
          <div key={d} style={{
            textAlign:'center', fontSize:11, fontWeight:600,
            letterSpacing:'0.05em', textTransform:'uppercase',
            color: i >= 5 ? '#8B0000' : '#666',
            padding:'6px 0', borderBottom:'1px solid #e0dbd0',
          }}>{d}</div>
        ))}
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} style={{ minHeight:60 }} />;
          const dateStr    = toDateStr(date);
          const dayData    = getDayData(date, true);
          const cs         = getCellStyle(dayData);
          const isSelected = selectedDate === dateStr;
          const hasEntries = !!events[dateStr];
          const isSat      = date.getDay() === 6;
          const feastName  = dayData.moveableFeast?.name || dayData.fixedFeast?.name || '';
          const short      = feastName.length > 22 ? feastName.substring(0,20)+'…' : feastName;

          return (
            <div
              key={idx}
              onClick={() => handleDayClick(dateStr)}
              title={[
                feastName,
                dayData.nzHoliday ? `🇳🇿 ${dayData.nzHoliday.name}` : '',
                dayData.julianDateStr ? `O.S. ${dayData.julianDateStr}` : '',
              ].filter(Boolean).join('\n')}
              style={{
                background: cs.bg,
                border: isSelected ? '2px solid #d4af37' : `1px solid ${cs.border}`,
                borderRadius:4, padding:'6px 4px', minHeight:60,
                cursor:'pointer', position:'relative',
                display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                boxShadow: isSelected ? '0 0 0 3px rgba(212,175,55,0.25)' : 'none',
              }}
            >
              <span style={{
                fontSize:14, lineHeight:1,
                fontWeight: cs.bold || isSat ? 700 : 400,
                color: isSat && !cs.bold ? '#8B0000' : cs.text,
              }}>
                {date.getDate()}
              </span>
              {short && (
                <span style={{ fontSize:8, color:cs.text, opacity:0.75,
                  textAlign:'center', lineHeight:1.25, wordBreak:'break-word' }}>
                  {short}
                </span>
              )}
              {dayData.nzHoliday && (
                <span style={{ position:'absolute', top:0, right:0, width:0, height:0,
                  borderStyle:'solid', borderWidth:'0 9px 9px 0',
                  borderColor:'transparent #2A7A6A transparent transparent' }} />
              )}
              {hasEntries && (
                <span style={{ position:'absolute', bottom:3, right:4,
                  width:6, height:6, borderRadius:'50%', background:'#27ae60' }} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Day editor ────────────────────────────────────────────────────────────
  function renderEditor() {
    if (!selectedDate) return null;
    const dayData   = getDayData(new Date(selectedDate + 'T00:00:00'), true);
    const feastName = dayData.isPascha
      ? 'HOLY PASCHA'
      : (dayData.moveableFeast?.name || dayData.fixedFeast?.name || '');

    return (
      <div style={{ ...s.card, marginTop:16, padding:20 }}>
        {/* Date + feast heading */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#2c1a3e' }}>
            {formatDateLabel(selectedDate)}
          </div>
          {feastName && (
            <div style={{ fontSize:13, color:'#8B0000', fontStyle:'italic', marginTop:2 }}>
              ✦ {feastName}
            </div>
          )}
          {dayData.nzHoliday && (
            <div style={{ fontSize:12, color:'#2A7A6A', marginTop:2 }}>
              🇳🇿 {dayData.nzHoliday.name}
            </div>
          )}
          {dayData.julianDateStr && (
            <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
              Old Style: {dayData.julianDateStr}
            </div>
          )}
        </div>

        {/* ── Full-day template selector ── */}
        {templates.length > 0 && (
          <div style={{ marginBottom:14, padding:'10px 14px',
            background:'#f9f7f3', borderRadius:4, border:'1px solid #e8e3dc' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#666',
              letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>
              Apply full-day template (replaces all entries)
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {templates.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)}
                  style={{ ...s.btn, fontSize:12, background:'#fff' }}>
                  {t.nameEn}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick-insert entry types ── */}
        {entryTypes.length > 0 && (
          <div style={{ marginBottom:14, padding:'10px 14px',
            background:'#f0f7f0', borderRadius:4, border:'1px solid #c8e0c8' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#3a6a3a',
              letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>
              + Append individual entry
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {entryTypes.map(et => (
                <button
                  key={et.id}
                  onClick={() => appendEntry(et)}
                  title={et.textRu}
                  style={{
                    padding:'5px 12px', borderRadius:4, fontSize:12,
                    cursor:'pointer', border:'1px solid #7ab87a',
                    background:'#fff', color:'#2a5a2a', fontFamily:'system-ui',
                  }}
                >
                  + {et.textEn}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── EN / RU textareas ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          <div>
            <label style={s.label}>Service Entries — English</label>
            <textarea
              value={editEn}
              onChange={e => setEditEn(e.target.value)}
              placeholder={"8:30 Confession, Hours\n9:30 Hours\n9:45 Divine Liturgy"}
              style={s.textarea}
            />
          </div>
          <div>
            <label style={s.label}>Расписание — Русский</label>
            <textarea
              value={editRu}
              onChange={e => setEditRu(e.target.value)}
              placeholder={"8:30 Исповедь, Часы\n9:30 Часы\n9:45 Божественная литургия"}
              style={s.textarea}
            />
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ ...s.btnPrimary, opacity:saving?0.7:1, cursor:saving?'not-allowed':'pointer' }}>
            {saving ? 'Saving…' : 'Save & Publish'}
          </button>
          <button onClick={handleClear} style={s.btnDanger}>Clear day</button>
          {saved && <span style={{ fontSize:13, color:'#27ae60' }}>✓ Saved & live</span>}
        </div>
      </div>
    );
  }

  // ── Templates tab ─────────────────────────────────────────────────────────
  function renderTemplates() {
    return (
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>Full-Day Templates</h2>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'#888' }}>
              Complete schedules that replace a day's entries in one click.
            </p>
          </div>
          <button onClick={() => { setTplAddingNew(true); setTplNewValue({}); }}
            style={s.btnPrimary} disabled={tplAddingNew}>
            + Add Template
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {templates.map((t, idx) => (
            <div key={t.id} style={{ ...s.card, overflow:'hidden' }}>
              {tplEditingId === t.id ? (
                <div style={{ padding:20 }}>
                  <TemplateForm value={tplEditValue} onChange={setTplEditValue}
                    onSave={() => handleSaveTemplate({ ...t, ...tplEditValue } as ServiceTemplate)}
                    onCancel={() => { setTplEditingId(null); setTplEditValue({}); }}
                    saving={tplSaving} />
                </div>
              ) : (
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
                    <button style={{ ...s.btn, padding:'2px 7px', fontSize:10 }}
                      onClick={() => moveTpl(idx,-1)} disabled={idx===0}>▲</button>
                    <button style={{ ...s.btn, padding:'2px 7px', fontSize:10 }}
                      onClick={() => moveTpl(idx,1)} disabled={idx===templates.length-1}>▼</button>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>
                      {t.nameEn}
                      {t.nameRu && <span style={{ fontWeight:400, color:'#888', marginLeft:10 }}>{t.nameRu}</span>}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {t.entriesEn && (
                        <pre style={{ margin:0, fontSize:11, color:'#555', fontFamily:'system-ui',
                          whiteSpace:'pre-wrap', background:'#f9f7f3', padding:'6px 8px',
                          borderRadius:4, border:'1px solid #e8e3dc' }}>
                          {t.entriesEn}
                        </pre>
                      )}
                      {t.entriesRu && (
                        <pre style={{ margin:0, fontSize:11, color:'#555', fontFamily:'system-ui',
                          whiteSpace:'pre-wrap', background:'#f9f7f3', padding:'6px 8px',
                          borderRadius:4, border:'1px solid #e8e3dc' }}>
                          {t.entriesRu}
                        </pre>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    <button style={s.btn}
                      onClick={() => { setTplEditingId(t.id); setTplEditValue(t); }}>Edit</button>
                    <button style={s.btnDanger} onClick={() => handleDeleteTemplate(t.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {templates.length === 0 && !tplAddingNew && (
            <p style={{ color:'#aaa', fontSize:13, fontStyle:'italic' }}>No templates yet.</p>
          )}

          {tplAddingNew && (
            <div style={{ ...s.card, padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>New Template</div>
              <TemplateForm value={tplNewValue} onChange={setTplNewValue}
                onSave={handleAddTemplate}
                onCancel={() => { setTplAddingNew(false); setTplNewValue({}); }}
                saving={tplSaving} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Entry Types tab ───────────────────────────────────────────────────────
  function renderEntryTypes() {
    return (
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>Service Entry Types</h2>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'#888' }}>
              Individual service lines you can append to any day's schedule.
            </p>
          </div>
          <button onClick={() => { setEtAddingNew(true); setEtNewValue({}); }}
            style={s.btnPrimary} disabled={etAddingNew}>
            + Add Entry Type
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {entryTypes.map((et, idx) => (
            <div key={et.id} style={{ ...s.card, overflow:'hidden' }}>
              {etEditingId === et.id ? (
                <div style={{ padding:16 }}>
                  <EntryTypeForm value={etEditValue} onChange={setEtEditValue}
                    onSave={() => handleSaveEntryType({ ...et, ...etEditValue } as ServiceEntryType)}
                    onCancel={() => { setEtEditingId(null); setEtEditValue({}); }}
                    saving={etSaving} />
                </div>
              ) : (
                <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  {/* Reorder */}
                  <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
                    <button style={{ ...s.btn, padding:'1px 6px', fontSize:10 }}
                      onClick={() => moveEt(idx,-1)} disabled={idx===0}>▲</button>
                    <button style={{ ...s.btn, padding:'1px 6px', fontSize:10 }}
                      onClick={() => moveEt(idx,1)} disabled={idx===entryTypes.length-1}>▼</button>
                  </div>
                  {/* Preview chip */}
                  <span style={{ display:'inline-block', padding:'4px 12px',
                    background:'#f0f7f0', border:'1px solid #7ab87a',
                    borderRadius:4, fontSize:13, color:'#2a5a2a', flexShrink:0 }}>
                    + {et.textEn}
                  </span>
                  {/* RU */}
                  <span style={{ fontSize:13, color:'#888', flex:1, minWidth:0,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {et.textRu}
                  </span>
                  {/* Actions */}
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    <button style={s.btn}
                      onClick={() => { setEtEditingId(et.id); setEtEditValue(et); }}>Edit</button>
                    <button style={s.btnDanger} onClick={() => handleDeleteEntryType(et.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {entryTypes.length === 0 && !etAddingNew && (
            <p style={{ color:'#aaa', fontSize:13, fontStyle:'italic' }}>
              No entry types yet. Add common services like "10:00 Prayer service" or "18:00 Evening Service".
            </p>
          )}

          {etAddingNew && (
            <div style={{ ...s.card, padding:16 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>New Entry Type</div>
              <EntryTypeForm value={etNewValue} onChange={setEtNewValue}
                onSave={handleAddEntryType}
                onCancel={() => { setEtAddingNew(false); setEtNewValue({}); }}
                saving={etSaving} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <span style={{ fontWeight:700, fontSize:16 }}>Service Schedule</span>
        <Link to="/admin" style={{ color:'#d4af37', fontSize:13, textDecoration:'none' }}>← Dashboard</Link>
      </div>

      <div style={s.body}>
        {/* Tab bar */}
        <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid #e0dbd0' }}>
          {([
            { key:'schedule', label:'Schedule' },
            { key:'templates', label:'Full-Day Templates' },
            { key:'entries', label:'Entry Types' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding:'10px 20px', border:'none', cursor:'pointer', fontSize:13,
              fontWeight: tab === key ? 700 : 400,
              color: tab === key ? '#2c1a3e' : '#888',
              background:'none',
              borderBottom: tab === key ? '2px solid #d4af37' : '2px solid transparent',
              marginBottom:-2,
            }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'schedule' && (
          <div>
            {/* Month navigation */}
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
              <button onClick={prevMonth} style={{ ...s.btn, padding:'8px 14px', fontSize:16 }}>←</button>
              <h2 style={{ margin:0, fontSize:20, fontWeight:600, flex:1,
                textAlign:'center', color:'#2c1a3e' }}>
                {MONTH_NAMES[month]} {year}
              </h2>
              <button onClick={nextMonth} style={{ ...s.btn, padding:'8px 14px', fontSize:16 }}>→</button>
            </div>

            {/* Legend */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:12,
              padding:'8px 12px', background:'#f9f7f3', borderRadius:4,
              border:'1px solid #e8e3dc', fontSize:11, color:'#666' }}>
              {[
                { bg:'#FFF0D0', label:'Pascha' },
                { bg:'#FDE8E8', label:'Great Feast' },
                { bg:'#EEF5E8', label:'Palm / Pentecost' },
                { bg:'#EAF0FA', label:'Nativity' },
                { bg:'#FFFAE0', label:'Bright Week' },
                { bg:'#F5E8E0', label:'Holy Week' },
              ].map(item => (
                <span key={item.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:12, height:12, borderRadius:2, background:item.bg,
                    border:'1px solid #ccc', display:'inline-block' }} />
                  {item.label}
                </span>
              ))}
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:8, height:8, borderRadius:'50%',
                  background:'#27ae60', display:'inline-block' }} />
                Has entries
              </span>
            </div>

            <div style={{ ...s.card, padding:'12px 12px 16px' }}>
              {renderGrid()}
            </div>
            {renderEditor()}
          </div>
        )}

        {tab === 'templates' && renderTemplates()}
        {tab === 'entries'   && renderEntryTypes()}
      </div>
    </div>
  );
}

// ── TemplateForm ─────────────────────────────────────────────────────────────
function TemplateForm({ value, onChange, onSave, onCancel, saving }: {
  value: Partial<ServiceTemplate>;
  onChange: (v: Partial<ServiceTemplate>) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const f = (field: keyof ServiceTemplate) =>
    (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
      onChange({ ...value, [field]: e.target.value });

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#444', display:'block', marginBottom:4 }}>
            Template Name (English)
          </label>
          <input value={value.nameEn||''} onChange={f('nameEn')}
            placeholder="e.g. Sunday Liturgy"
            style={{ width:'100%', padding:'8px 10px', border:'1px solid #ddd',
              borderRadius:4, fontSize:13, fontFamily:'system-ui' }} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#444', display:'block', marginBottom:4 }}>
            Название (Русский)
          </label>
          <input value={value.nameRu||''} onChange={f('nameRu')}
            placeholder="напр. Воскресная литургия"
            style={{ width:'100%', padding:'8px 10px', border:'1px solid #ddd',
              borderRadius:4, fontSize:13, fontFamily:'system-ui' }} />
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#444', display:'block', marginBottom:4 }}>
            Entries — English
          </label>
          <textarea value={value.entriesEn||''} onChange={f('entriesEn')}
            placeholder={"8:30 Confession, Hours\n9:30 Hours\n9:45 Divine Liturgy"}
            style={{ width:'100%', padding:'9px 10px', border:'1px solid #ddd',
              borderRadius:4, fontSize:13, fontFamily:'system-ui',
              lineHeight:1.7, resize:'vertical', minHeight:110 }} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#444', display:'block', marginBottom:4 }}>
            Расписание — Русский
          </label>
          <textarea value={value.entriesRu||''} onChange={f('entriesRu')}
            placeholder={"8:30 Исповедь, Часы\n9:30 Часы\n9:45 Литургия"}
            style={{ width:'100%', padding:'9px 10px', border:'1px solid #ddd',
              borderRadius:4, fontSize:13, fontFamily:'system-ui',
              lineHeight:1.7, resize:'vertical', minHeight:110 }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onSave} disabled={saving||!value.nameEn}
          style={{ padding:'9px 22px', background:'#2c1a3e', color:'#fff', border:'none',
            borderRadius:4, fontWeight:600, fontSize:13,
            cursor:(saving||!value.nameEn)?'not-allowed':'pointer',
            opacity:(saving||!value.nameEn)?0.6:1 }}>
          {saving ? 'Saving…' : 'Save Template'}
        </button>
        <button onClick={onCancel}
          style={{ padding:'9px 18px', background:'none', border:'1px solid #ddd',
            borderRadius:4, fontSize:13, cursor:'pointer', color:'#666' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── EntryTypeForm ─────────────────────────────────────────────────────────────
function EntryTypeForm({ value, onChange, onSave, onCancel, saving }: {
  value: Partial<ServiceEntryType>;
  onChange: (v: Partial<ServiceEntryType>) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const f = (field: keyof ServiceEntryType) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [field]: e.target.value });

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#444', display:'block', marginBottom:4 }}>
            Entry text — English
          </label>
          <input value={value.textEn||''} onChange={f('textEn')}
            placeholder="e.g. 10:00 Prayer service (Obednitsa)"
            style={{ width:'100%', padding:'9px 10px', border:'1px solid #ddd',
              borderRadius:4, fontSize:13, fontFamily:'system-ui' }} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#444', display:'block', marginBottom:4 }}>
            Строка — Русский
          </label>
          <input value={value.textRu||''} onChange={f('textRu')}
            placeholder="напр. 10:00 Обедница"
            style={{ width:'100%', padding:'9px 10px', border:'1px solid #ddd',
              borderRadius:4, fontSize:13, fontFamily:'system-ui' }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onSave} disabled={saving||!value.textEn}
          style={{ padding:'8px 20px', background:'#2c1a3e', color:'#fff', border:'none',
            borderRadius:4, fontWeight:600, fontSize:13,
            cursor:(saving||!value.textEn)?'not-allowed':'pointer',
            opacity:(saving||!value.textEn)?0.6:1 }}>
          {saving ? 'Saving…' : 'Save Entry Type'}
        </button>
        <button onClick={onCancel}
          style={{ padding:'8px 16px', background:'none', border:'1px solid #ddd',
            borderRadius:4, fontSize:13, cursor:'pointer', color:'#666' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
