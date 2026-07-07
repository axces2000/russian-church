// src/admin/PageEditor.tsx
// Full-page editor for a single content page.
// Shows EN and RU panels side by side (tabbed on mobile).
// Saves to Firestore immediately on button click (goes live instantly).

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { savePage } from '../lib/firestore';
import type { Page } from '../lib/firestore';
import RichTextEditor from '../components/RichTextEditor';

type Tab = 'en' | 'ru';

export default function PageEditor() {
  const { pageId } = useParams<{ pageId: string }>();

  const [page, setPage] = useState<Page | null>(null);
  const [titleEn, setTitleEn] = useState('');
  const [titleRu, setTitleRu] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [contentRu, setContentRu] = useState('');
  const [tab, setTab] = useState<Tab>('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Load page from Firestore
  useEffect(() => {
    if (!pageId) return;
    getDoc(doc(db, 'pages', pageId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as Page;
        setPage({ ...data, id: snap.id });
        setTitleEn(data.titleEn);
        setTitleRu(data.titleRu);
        setContentEn(data.contentEn);
        setContentRu(data.contentRu);
      }
      setLoading(false);
    });
  }, [pageId]);

  const handleSave = async () => {
    if (!page) return;
    setSaving(true);
    setError('');
    try {
      await savePage({
        ...page,
        titleEn,
        titleRu,
        contentEn,
        contentRu,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui' }}>Loading…</div>;
  if (!page) return <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui' }}>Page not found.</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Top bar */}
      <div style={{
        background: '#2c1a3e', color: '#fff', padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/admin/content" style={{ color: '#d4af37', fontSize: 13, textDecoration: 'none' }}>← Back</Link>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Edit Page</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {error && <span style={{ fontSize: 13, color: '#e74c3c' }}>{error}</span>}
          {saved && <span style={{ fontSize: 13, color: '#d4af37' }}>✓ Saved & live</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 22px', background: '#d4af37', color: '#2c1a3e',
              border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Page title fields */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 0' }}>
        <div style={{
          background: '#fff', border: '1px solid #e0dbd0', borderRadius: 6,
          padding: '20px 24px', marginBottom: 20,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
        }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#444', display: 'block', marginBottom: 5 }}>
              Page Title (English)
            </label>
            <input
              value={titleEn}
              onChange={e => setTitleEn(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid #ddd',
                borderRadius: 4, fontSize: 14, fontFamily: 'system-ui',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#444', display: 'block', marginBottom: 5 }}>
              Page Title (Russian / Русский)
            </label>
            <input
              value={titleRu}
              onChange={e => setTitleRu(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid #ddd',
                borderRadius: 4, fontSize: 14, fontFamily: 'system-ui',
              }}
            />
          </div>
        </div>

        {/* Language tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
          {(['en', 'ru'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 22px', border: 'none', cursor: 'pointer',
                borderRadius: '6px 6px 0 0', fontSize: 13, fontWeight: tab === t ? 700 : 400,
                background: tab === t ? '#fff' : '#e8e3dc',
                color: tab === t ? '#2c1a3e' : '#888',
                borderBottom: tab === t ? '2px solid #d4af37' : '2px solid transparent',
              }}
            >
              {t === 'en' ? '🇬🇧 English' : '🇷🇺 Russian'}
            </button>
          ))}
        </div>

        {/* Editor panels */}
        <div style={{ background: '#fff', border: '1px solid #e0dbd0', borderRadius: '0 6px 6px 6px', padding: 24, marginBottom: 40 }}>
          {tab === 'en' && (
            <RichTextEditor
              value={contentEn}
              onChange={setContentEn}
              placeholder="English content…"
            />
          )}
          {tab === 'ru' && (
            <RichTextEditor
              value={contentRu}
              onChange={setContentRu}
              placeholder="Russian content / Содержание на русском…"
            />
          )}
        </div>
      </div>
    </div>
  );
}
