// src/admin/CanonReadingAdmin.tsx
// Admin page for the weekly online Canon Reading announcement.
//
// The AI (Gemini, via the findCanonReading Cloud Function) is used ONLY to
// locate candidate URLs — one set for the canon's own text, another for an
// English Wikipedia article about that week's saint/feast. Everything else
// — the announcement wording, date/day formatting — is deterministic
// templating (src/lib/canonReadingTemplate.ts). The admin must confirm
// whichever AI-found link they pick (by clicking it) before it can be used,
// and can always type a link in manually instead.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import {
  getCanonSettings,
  updateCanonSettings,
  subscribeCanonReadings,
  saveCanonReading,
  deleteCanonReading,
} from '../lib/firestore';
import type { CanonReadingSettings, CanonReading } from '../lib/firestore';
import { buildCanonReadingHtml } from '../lib/canonReadingTemplate';

// ── Styles (matches CalendarAdmin.tsx conventions) ──────────────────────────
const s = {
  wrap:       { minHeight:'100vh', background:'#f5f5f0', fontFamily:'system-ui, sans-serif' } as React.CSSProperties,
  topBar:     { background:'#2c1a3e', color:'#fff', padding:'14px 32px', display:'flex',
                alignItems:'center', justifyContent:'space-between' } as React.CSSProperties,
  body:       { maxWidth:900, margin:'0 auto', padding:'28px 20px' } as React.CSSProperties,
  card:       { background:'#fff', border:'1px solid #e0dbd0', borderRadius:6 } as React.CSSProperties,
  btn:        { padding:'7px 16px', borderRadius:4, fontSize:13, cursor:'pointer',
                border:'1px solid #ddd', background:'#fff' } as React.CSSProperties,
  btnPrimary: { padding:'9px 22px', borderRadius:4, fontSize:13, fontWeight:600 as const,
                cursor:'pointer', border:'none', background:'#2c1a3e', color:'#fff' } as React.CSSProperties,
  btnDanger:  { padding:'7px 14px', borderRadius:4, fontSize:12, cursor:'pointer',
                border:'1px solid #e74c3c', background:'#fff', color:'#e74c3c' } as React.CSSProperties,
  label:      { fontSize:12, fontWeight:600 as const, color:'#444', display:'block' as const, marginBottom:5 },
  input:      { width:'100%', padding:'9px 10px', border:'1px solid #ddd', borderRadius:4,
                fontSize:13.5, fontFamily:'system-ui' } as React.CSSProperties,
  textarea:   { width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:4,
                fontSize:12.5, fontFamily:'monospace', lineHeight:1.6,
                resize:'vertical' as const, minHeight:180 } as React.CSSProperties,
  candidate:  { display:'flex', gap:8, alignItems:'flex-start', padding:'8px 0' } as React.CSSProperties,
};

const SETTINGS_DEFAULTS: CanonReadingSettings = {
  zoomLink1: '', zoomLink2: '', wikipediaLink: '', reconciliationLink: '',
  defaultPriestName: '', defaultPriestLocation: '', defaultTimeNZ: '21:30',
};

interface FindCandidate {
  title: string;
  url: string;
  verified: boolean;
}
interface CategoryResult {
  found: boolean;
  candidates?: FindCandidate[];
  rawText?: string;
}

type CanonDraft = Omit<CanonReading, 'updatedAt'>;

const EMPTY_DRAFT: CanonDraft = {
  id: '',
  date: '',
  timeNZ: '',
  canonDedication: '',
  canonQuery: '',
  canonUrl: '',
  canonTitle: '',
  wikipediaLink: '',
  priestName: '',
  priestLocation: '',
  html: '',
  status: 'draft',
};

// Defaults to today if today is a Saturday, otherwise the coming Saturday.
function getUpcomingSaturday(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CanonReadingAdmin() {
  const [tab, setTab] = useState<'readings' | 'settings'>('readings');

  // ── Settings tab ─────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<CanonReadingSettings>(SETTINGS_DEFAULTS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    getCanonSettings().then(loaded => {
      if (loaded) setSettings({ ...SETTINGS_DEFAULTS, ...loaded });
      setSettingsLoading(false);
    });
  }, []);

  async function handleSaveSettings() {
    setSettingsSaving(true);
    await updateCanonSettings(settings);
    setSettingsSaving(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  // ── Readings tab ─────────────────────────────────────────────────────────
  const [readings, setReadings] = useState<CanonReading[]>([]);
  useEffect(() => subscribeCanonReadings(setReadings), []);

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [canonSearching, setCanonSearching] = useState(false);
  const [wikiSearching, setWikiSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [saving, setSaving] = useState(false);

  // Canon-text candidate selection
  const [canonResult, setCanonResult] = useState<CategoryResult | null>(null);
  const [canonSelectedIdx, setCanonSelectedIdx] = useState<number | null>(null);
  const [canonConfirmed, setCanonConfirmed] = useState(false);
  const [canonManual, setCanonManual] = useState(false);

  // Wikipedia candidate selection
  const [wikiResult, setWikiResult] = useState<CategoryResult | null>(null);
  const [wikiSelectedIdx, setWikiSelectedIdx] = useState<number | null>(null);
  const [wikiConfirmed, setWikiConfirmed] = useState(false);
  const [wikiManual, setWikiManual] = useState(false);
  const [wikiUseDefault, setWikiUseDefault] = useState(true);

  function resetSearchState() {
    setCanonResult(null); setCanonSelectedIdx(null); setCanonConfirmed(false); setCanonManual(false);
    setWikiResult(null); setWikiSelectedIdx(null); setWikiConfirmed(false); setWikiManual(false);
    setWikiUseDefault(true);
    setSearchError('');
  }

  function startNew() {
    setDraft({
      ...EMPTY_DRAFT,
      date: getUpcomingSaturday(),
      timeNZ: settings.defaultTimeNZ,
      priestName: settings.defaultPriestName,
      priestLocation: settings.defaultPriestLocation,
      wikipediaLink: settings.wikipediaLink,
    });
    resetSearchState();
    setShowForm(true);
  }

  function startEdit(r: CanonReading) {
    setDraft({
      id: r.id, date: r.date, timeNZ: r.timeNZ, canonDedication: r.canonDedication,
      canonQuery: r.canonQuery, canonUrl: r.canonUrl, canonTitle: r.canonTitle,
      wikipediaLink: r.wikipediaLink || settings.wikipediaLink,
      priestName: r.priestName, priestLocation: r.priestLocation, html: r.html,
      status: r.status,
    });
    resetSearchState();
    // Existing entries already have a chosen canon URL — treat it as
    // confirmed so re-editing an old entry doesn't force a fresh search.
    if (r.canonUrl) {
      setCanonResult({ found: true, candidates: [{ title: r.canonTitle, url: r.canonUrl, verified: true }] });
      setCanonSelectedIdx(0);
      setCanonConfirmed(true);
    }
    setWikiUseDefault(!r.wikipediaLink || r.wikipediaLink === settings.wikipediaLink);
    setShowForm(true);
  }

  async function handleSearch() {
    if (!draft.canonQuery.trim()) return;
    resetSearchState();
    setCanonSearching(true);
    setWikiSearching(true);

    const canonFn = httpsCallable<{ query: string }, CategoryResult>(functions, 'findCanonLink');
    canonFn({ query: draft.canonQuery.trim() })
      .then(result => {
        setCanonResult(result.data);
        const first = result.data.found ? result.data.candidates?.[0] : undefined;
        if (first) {
          setCanonSelectedIdx(0);
          setDraft(d => ({ ...d, canonUrl: first.url, canonTitle: first.title }));
        }
      })
      .catch((err: any) => setSearchError(prev => prev || (err.message || 'Canon search failed.')))
      .finally(() => setCanonSearching(false));

    const dedication = draft.canonDedication.trim() || draft.canonQuery.trim();
    const wikiFn = httpsCallable<{ dedication: string }, CategoryResult>(functions, 'findWikiLink');
    wikiFn({ dedication })
      .then(result => setWikiResult(result.data))
      // Wiki intentionally stays on "use default" until the admin picks
      // one of the candidates — a fresh AI-found link always needs an
      // active choice, never applied silently.
      .catch((err: any) => setSearchError(prev => prev || (err.message || 'Wikipedia search failed.')))
      .finally(() => setWikiSearching(false));
  }

  function selectCanonCandidate(i: number, c: FindCandidate) {
    setCanonManual(false);
    setCanonSelectedIdx(i);
    setCanonConfirmed(false);
    setDraft(d => ({ ...d, canonTitle: c.title, canonUrl: c.url }));
  }

  function selectWikiDefault() {
    setWikiUseDefault(true);
    setWikiManual(false);
    setWikiSelectedIdx(null);
    setDraft(d => ({ ...d, wikipediaLink: settings.wikipediaLink }));
  }
  function selectWikiCandidate(i: number, c: FindCandidate) {
    setWikiUseDefault(false);
    setWikiManual(false);
    setWikiSelectedIdx(i);
    setWikiConfirmed(false);
    setDraft(d => ({ ...d, wikipediaLink: c.url }));
  }
  function selectWikiManual() {
    setWikiUseDefault(false);
    setWikiManual(true);
    setWikiSelectedIdx(null);
  }

  function handleGenerate() {
    if (!draft.date || !draft.canonUrl) return;
    const html = buildCanonReadingHtml({
      date: new Date(draft.date + 'T12:00:00'),
      timeNZ: draft.timeNZ,
      canonDedication: draft.canonDedication,
      priestName: draft.priestName,
      priestLocation: draft.priestLocation,
      canonUrl: draft.canonUrl,
      zoomLink1: settings.zoomLink1,
      zoomLink2: settings.zoomLink2,
      wikipediaLink: draft.wikipediaLink || settings.wikipediaLink,
      reconciliationLink: settings.reconciliationLink,
    });
    setDraft(d => ({ ...d, html }));
  }

  async function handleSave(status: 'draft' | 'published') {
    if (!draft.date || !draft.html) return;
    setSaving(true);
    await saveCanonReading({ ...draft, id: draft.date, status });
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(r: CanonReading) {
    if (!window.confirm(`Delete the canon reading entry for ${r.date}?`)) return;
    await deleteCanonReading(r.id);
  }

  const canonReady = canonManual ? !!draft.canonUrl.trim() : (canonSelectedIdx !== null && canonConfirmed);
  const wikiReady = wikiUseDefault
    ? true
    : wikiManual
      ? !!draft.wikipediaLink.trim()
      : (wikiSelectedIdx !== null && wikiConfirmed);
  const canGenerate = !!draft.date && !!draft.canonDedication.trim() && canonReady && wikiReady;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <span style={{ fontWeight:700, fontSize:16 }}>Canon Reading</span>
        <Link to="/admin" style={{ color:'#d4af37', fontSize:13, textDecoration:'none' }}>← Dashboard</Link>
      </div>

      <div style={s.body}>
        <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid #e0dbd0' }}>
          {([
            { key:'readings', label:'Readings' },
            { key:'settings', label:'Settings' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding:'10px 20px', border:'none', cursor:'pointer', fontSize:13,
              fontWeight: tab === key ? 700 : 400,
              color: tab === key ? '#2c1a3e' : '#888',
              background:'none',
              borderBottom: tab === key ? '2px solid #d4af37' : '2px solid transparent',
              marginBottom:-2,
            }}>{label}</button>
          ))}
        </div>

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          settingsLoading ? <p>Loading…</p> : (
            <div style={{ ...s.card, padding:'24px 24px' }}>
              <p style={{ margin:'0 0 20px', fontSize:13, color:'#888' }}>
                These fields rarely change — they're reused as defaults in every weekly announcement.
                The Wikipedia link below is just the fallback; each reading can use its own AI-found link instead.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <Field label="Zoom link (primary)" value={settings.zoomLink1}
                  onChange={v => setSettings(x => ({ ...x, zoomLink1: v }))} placeholder="https://us05web.zoom.us/j/…" />
                <Field label="Zoom link (alternative)" value={settings.zoomLink2}
                  onChange={v => setSettings(x => ({ ...x, zoomLink2: v }))} placeholder="https://us04web.zoom.us/j/…" />
                <Field label="Default Wikipedia link (fallback when no specific saint/feast article is used)" value={settings.wikipediaLink}
                  onChange={v => setSettings(x => ({ ...x, wikipediaLink: v }))} placeholder="https://en.wikipedia.org/wiki/Canon_(hymnography)" />
                <Field label="Reconciliation prayer link" value={settings.reconciliationLink}
                  onChange={v => setSettings(x => ({ ...x, reconciliationLink: v }))} placeholder="https://azbyka.ru/molitvoslov/…" />
                <Field label="Default priest name" value={settings.defaultPriestName}
                  onChange={v => setSettings(x => ({ ...x, defaultPriestName: v }))} placeholder="отец Алексей" />
                <Field label="Default priest location (optional)" value={settings.defaultPriestLocation}
                  onChange={v => setSettings(x => ({ ...x, defaultPriestLocation: v }))} placeholder="из Москвы" />
                <Field label="Default time (NZ)" value={settings.defaultTimeNZ}
                  onChange={v => setSettings(x => ({ ...x, defaultTimeNZ: v }))} placeholder="21:30" />
              </div>
              <div style={{ marginTop:22, display:'flex', alignItems:'center', gap:12 }}>
                <button onClick={handleSaveSettings} disabled={settingsSaving} style={s.btnPrimary}>
                  {settingsSaving ? 'Saving…' : 'Save Settings'}
                </button>
                {settingsSaved && <span style={{ fontSize:13, color:'#27ae60' }}>✓ Saved</span>}
              </div>
            </div>
          )
        )}

        {/* ── READINGS TAB ── */}
        {tab === 'readings' && (
          <div>
            {!showForm && (
              <button onClick={startNew} style={{ ...s.btnPrimary, marginBottom:18 }}>
                + New Canon Reading
              </button>
            )}

            {showForm && (
              <div style={{ ...s.card, padding:'22px 24px', marginBottom:22 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                  <div>
                    <label style={s.label}>Date (defaults to the coming Saturday)</label>
                    <input type="date" value={draft.date}
                      onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} style={s.input} />
                  </div>
                  <div>
                    <label style={s.label}>Time (NZ)</label>
                    <input value={draft.timeNZ}
                      onChange={e => setDraft(d => ({ ...d, timeNZ: e.target.value }))} style={s.input} />
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={s.label}>
                    Canon dedication — <em>in dative case</em> (e.g. "святителю Николаю Чудотворцу", "Господу нашему Иисусу Христу")
                  </label>
                  <input value={draft.canonDedication}
                    onChange={e => setDraft(d => ({ ...d, canonDedication: e.target.value }))}
                    style={s.input} placeholder="святителю Николаю Чудотворцу" />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>
                  <div>
                    <label style={s.label}>Priest name</label>
                    <input value={draft.priestName}
                      onChange={e => setDraft(d => ({ ...d, priestName: e.target.value }))} style={s.input} />
                  </div>
                  <div>
                    <label style={s.label}>Priest location (optional)</label>
                    <input value={draft.priestLocation}
                      onChange={e => setDraft(d => ({ ...d, priestLocation: e.target.value }))} style={s.input} />
                  </div>
                </div>

                {/* ── AI search trigger ── */}
                <div style={{ marginBottom:14 }}>
                  <label style={s.label}>Search phrase (approximate — e.g. "канон Николаю Чудотворцу")</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={draft.canonQuery}
                      onChange={e => setDraft(d => ({ ...d, canonQuery: e.target.value }))}
                      style={{ ...s.input, flex:1 }} placeholder="канон Николаю Чудотворцу" />
                    <button onClick={handleSearch} disabled={canonSearching || wikiSearching || !draft.canonQuery.trim()}
                      style={{ ...s.btn, whiteSpace:'nowrap', opacity: (canonSearching || wikiSearching) ? 0.6 : 1 }}>
                      {(canonSearching || wikiSearching) ? 'Searching…' : '🔍 Search with AI'}
                    </button>
                  </div>
                  {searchError && <p style={{ color:'#e74c3c', fontSize:12.5, marginTop:8 }}>{searchError}</p>}
                </div>

                {/* ── Canon text candidates ── */}
                <div style={{ padding:'14px 16px', background:'#f9f7f3', borderRadius:4,
                  border:'1px solid #e8e3dc', marginBottom:18 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#444', marginBottom:6 }}>
                    Canon text link{canonSearching && <span style={{ color:'#888', fontWeight:400 }}> — searching…</span>}
                  </div>

                  {canonResult && !canonResult.found && (
                    <p style={{ color:'#a9760f', fontSize:12.5, margin:'0 0 8px' }}>
                      No confident match found. {canonResult.rawText ? `(Model said: "${canonResult.rawText}")` : ''}
                      {' '}You can type the link in manually below.
                    </p>
                  )}

                  {canonResult?.candidates?.map((c, i) => (
                    <label key={i} style={{ ...s.candidate, borderTop: i > 0 ? '1px solid #e8e3dc' : 'none', cursor:'pointer' }}>
                      <input type="radio" name="canonCandidate" checked={!canonManual && canonSelectedIdx === i}
                        onChange={() => selectCanonCandidate(i, c)} style={{ marginTop:3 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{c.title}</div>
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize:12, color:'#2c1a3e', wordBreak:'break-all' }}>{c.url}</a>
                        {!c.verified && (
                          <div style={{ fontSize:11.5, color:'#e74c3c', fontWeight:600, marginTop:3 }}>
                            ⚠ Not backed by a real search citation. It can be subtly wrong (e.g. a
                            one-letter transliteration difference) in a way that's easy to miss just
                            by reading the URL — always open it and confirm the page actually loads
                            with the right content.
                          </div>
                        )}
                      </div>
                    </label>
                  ))}

                  {canonSelectedIdx !== null && !canonManual && (
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5,
                      cursor:'pointer', marginTop:10 }}>
                      <input type="checkbox" checked={canonConfirmed}
                        onChange={e => setCanonConfirmed(e.target.checked)} />
                      I opened the selected link and confirmed it's the right canon
                    </label>
                  )}

                  <div style={{ marginTop:10 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, cursor:'pointer' }}>
                      <input type="checkbox" checked={canonManual}
                        onChange={e => { setCanonManual(e.target.checked); if (e.target.checked) setCanonSelectedIdx(null); }} />
                      I'll type the link in myself instead
                    </label>
                    {canonManual && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:8 }}>
                        <input value={draft.canonTitle}
                          onChange={e => setDraft(d => ({ ...d, canonTitle: e.target.value }))}
                          style={s.input} placeholder="Canon title" />
                        <input value={draft.canonUrl}
                          onChange={e => setDraft(d => ({ ...d, canonUrl: e.target.value }))}
                          style={s.input} placeholder="https://…" />
                      </div>
                    )}
                  </div>
                </div>

                {/* ── English Wikipedia link ── */}
                <div style={{ padding:'14px 16px', background:'#f4f6fa', borderRadius:4,
                  border:'1px solid #dde3ec', marginBottom:18 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#444', marginBottom:6 }}>
                    English Wikipedia link{wikiSearching && <span style={{ color:'#888', fontWeight:400 }}> — searching…</span>}
                  </div>

                  {wikiResult && !wikiResult.found && (
                    <p style={{ color:'#888', fontSize:12, margin:'0 0 8px', fontStyle:'italic' }}>
                      No specific saint/feast article found (or this is a general canon) — the
                      default link below will be used unless you type one in manually.
                    </p>
                  )}

                  <label style={{ ...s.candidate, cursor:'pointer' }}>
                    <input type="radio" name="wikiCandidate" checked={wikiUseDefault}
                      onChange={selectWikiDefault} style={{ marginTop:3 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13 }}>Use default</div>
                      <a href={settings.wikipediaLink} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize:12, color:'#2c1a3e', wordBreak:'break-all' }}>
                        {settings.wikipediaLink}
                      </a>
                    </div>
                  </label>

                  {wikiResult?.candidates?.map((c, i) => (
                    <label key={i} style={{ ...s.candidate, borderTop:'1px solid #dde3ec', cursor:'pointer' }}>
                      <input type="radio" name="wikiCandidate" checked={!wikiUseDefault && !wikiManual && wikiSelectedIdx === i}
                        onChange={() => selectWikiCandidate(i, c)} style={{ marginTop:3 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{c.title}</div>
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize:12, color:'#2c1a3e', wordBreak:'break-all' }}>{c.url}</a>
                        {!c.verified && (
                          <div style={{ fontSize:11.5, color:'#e74c3c', fontWeight:600, marginTop:3 }}>
                            ⚠ Not backed by a real search citation — verify before using.
                          </div>
                        )}
                      </div>
                    </label>
                  ))}

                  {wikiSelectedIdx !== null && !wikiUseDefault && !wikiManual && (
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5,
                      cursor:'pointer', marginTop:10 }}>
                      <input type="checkbox" checked={wikiConfirmed}
                        onChange={e => setWikiConfirmed(e.target.checked)} />
                      I opened the selected link and confirmed it's relevant
                    </label>
                  )}

                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5,
                    cursor:'pointer', marginTop:10 }}>
                    <input type="radio" name="wikiCandidate" checked={wikiManual} onChange={selectWikiManual} />
                    I'll type a link in myself instead
                  </label>
                  {wikiManual && (
                    <input value={draft.wikipediaLink}
                      onChange={e => setDraft(d => ({ ...d, wikipediaLink: e.target.value }))}
                      style={{ ...s.input, marginTop:8 }} placeholder="https://en.wikipedia.org/wiki/…" />
                  )}
                </div>

                <button onClick={handleGenerate} disabled={!canGenerate}
                  style={{ ...s.btn, marginBottom:14, opacity: canGenerate ? 1 : 0.5 }}>
                  ✎ Generate announcement text
                </button>

                {draft.html && (
                  <div style={{ marginBottom:18 }}>
                    <label style={s.label}>Announcement HTML (editable)</label>
                    <textarea value={draft.html}
                      onChange={e => setDraft(d => ({ ...d, html: e.target.value }))} style={s.textarea} />
                    <label style={{ ...s.label, marginTop:12 }}>Preview</label>
                    <div className="rich-content" style={{ border:'1px solid #e0dbd0', borderRadius:4,
                      padding:'14px 16px', background:'#fff', fontSize:14 }}
                      dangerouslySetInnerHTML={{ __html: draft.html }} />
                  </div>
                )}

                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => handleSave('published')} disabled={saving || !draft.html}
                    style={{ ...s.btnPrimary, opacity: (saving || !draft.html) ? 0.6 : 1 }}>
                    {saving ? 'Saving…' : 'Save & Publish'}
                  </button>
                  <button onClick={() => handleSave('draft')} disabled={saving || !draft.html} style={s.btn}>
                    Save as Draft
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ ...s.btn, color:'#888' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── List of existing entries ── */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {readings.map(r => (
                <div key={r.id} style={{ ...s.card, padding:'12px 16px', display:'flex',
                  alignItems:'center', gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontWeight:700, fontSize:13.5 }}>{r.date}</span>
                    <span style={{ marginLeft:10, fontSize:13, color:'#666' }}>{r.canonDedication}</span>
                  </div>
                  <span style={{
                    fontSize:11, padding:'2px 10px', borderRadius:999,
                    background: r.status === 'published' ? '#27ae60' : '#e8e3dc',
                    color: r.status === 'published' ? '#fff' : '#666',
                    fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em',
                  }}>
                    {r.status}
                  </span>
                  <button style={s.btn} onClick={() => startEdit(r)}>Edit</button>
                  <button style={s.btnDanger} onClick={() => handleDelete(r)}>Delete</button>
                </div>
              ))}
              {readings.length === 0 && (
                <p style={{ color:'#aaa', fontSize:13, fontStyle:'italic' }}>No canon readings yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ fontSize:12, fontWeight:600, color:'#444', display:'block', marginBottom:5 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ padding:'9px 12px', border:'1px solid #ddd', borderRadius:4, fontSize:14,
          fontFamily:'system-ui', width:'100%', outline:'none' }} />
    </div>
  );
}
