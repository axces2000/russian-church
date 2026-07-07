// src/admin/ContentAdmin.tsx
// Lists all sections and their pages.
// Delegated admins only see their allowed sections.
// Superadmin sees everything and can reorder/delete sections too.

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeSections,
  subscribePages,
  saveSection,
  deleteSection,
  reorderSections,
  savePage,
  deletePage,
  reorderPages,
} from '../lib/firestore';
import type { Section, Page } from '../lib/firestore';

// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  wrap:       { minHeight: '100vh', background: '#f5f5f0', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  topBar:     { background: '#2c1a3e', color: '#fff', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  body:       { maxWidth: 960, margin: '0 auto', padding: '36px 24px' } as React.CSSProperties,
  card:       { background: '#fff', border: '1px solid #e0dbd0', borderRadius: 6, marginBottom: 24, overflow: 'hidden' } as React.CSSProperties,
  cardHead:   { padding: '14px 20px', background: '#f9f7f3', borderBottom: '1px solid #e0dbd0', display: 'flex', alignItems: 'center', gap: 12 } as React.CSSProperties,
  cardBody:   { padding: '12px 20px 16px' } as React.CSSProperties,
  btn:        { padding: '6px 14px', borderRadius: 4, fontSize: 13, cursor: 'pointer', border: '1px solid #ddd', background: '#fff' } as React.CSSProperties,
  btnPrimary: { padding: '8px 18px', borderRadius: 4, fontSize: 13, cursor: 'pointer', border: 'none', background: '#2c1a3e', color: '#fff', fontWeight: 600 } as React.CSSProperties,
  btnDanger:  { padding: '6px 14px', borderRadius: 4, fontSize: 13, cursor: 'pointer', border: '1px solid #e74c3c', background: '#fff', color: '#e74c3c' } as React.CSSProperties,
  pageRow:    { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0ede6' } as React.CSSProperties,
  tag:        { fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f0ede6', color: '#666', letterSpacing: '0.04em' } as React.CSSProperties,
};

// ── Component ──────────────────────────────────────────────────────────────
export default function ContentAdmin() {
  const { role, allowedSections } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState<Section[]>([]);
  const [pagesMap, setPagesMap] = useState<Record<string, Page[]>>({});
  const [loading, setLoading] = useState(true);

  // Subscribe to sections
  useEffect(() => {
    const unsub = subscribeSections(data => {
      const visible = role === 'superadmin'
        ? data
        : data.filter(s => allowedSections === 'all' || (Array.isArray(allowedSections) && allowedSections.includes(s.id)));
      setSections(visible);
      setLoading(false);
    });
    return unsub;
  }, [role, allowedSections]);

  // Subscribe to pages for each section
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    sections.forEach(sec => {
      const unsub = subscribePages(sec.id, pages => {
        setPagesMap(prev => ({ ...prev, [sec.id]: pages }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  }, [sections.map(s => s.id).join(',')]);

  // ── Section actions ──────────────────────────────────────────────────────
  const moveSection = async (idx: number, dir: -1 | 1) => {
    const updated = [...sections];
    const swap = idx + dir;
    if (swap < 0 || swap >= updated.length) return;
    [updated[idx], updated[swap]] = [updated[swap], updated[idx]];
    setSections(updated);
    await reorderSections(updated);
  };

  const toggleVisible = async (section: Section) => {
    await saveSection({ ...section, visible: !section.visible });
  };

  const handleDeleteSection = async (section: Section) => {
    if (!window.confirm(`Delete section "${section.nameEn}" and all its pages?`)) return;
    await deleteSection(section.id);
  };

  // ── Page actions ─────────────────────────────────────────────────────────
  const addPage = async (sectionId: string) => {
    const titleEn = window.prompt('New page title (English):');
    if (!titleEn) return;
    const titleRu = window.prompt('New page title (Russian):') ?? titleEn;
    const pages = pagesMap[sectionId] ?? [];
    const newPage: Omit<Page, 'updatedAt'> = {
      id: uuid(),
      sectionId,
      titleEn,
      titleRu,
      order: pages.length,
      contentEn: '',
      contentRu: '',
    };
    await savePage(newPage);
  };

  const movePage = async (sectionId: string, idx: number, dir: -1 | 1) => {
    const pages = [...(pagesMap[sectionId] ?? [])];
    const swap = idx + dir;
    if (swap < 0 || swap >= pages.length) return;
    [pages[idx], pages[swap]] = [pages[swap], pages[idx]];
    setPagesMap(prev => ({ ...prev, [sectionId]: pages }));
    await reorderPages(pages);
  };

  const handleDeletePage = async (page: Page) => {
    if (!window.confirm(`Delete page "${page.titleEn}"?`)) return;
    await deletePage(page.id);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}>Loading…</div>;

  return (
    <div style={s.wrap}>
      {/* Top bar */}
      <div style={s.topBar}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Content Management</span>
        <Link to="/admin" style={{ color: '#d4af37', fontSize: 13, textDecoration: 'none' }}>← Dashboard</Link>
      </div>

      <div style={s.body}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Sections & Pages</h1>
        <p style={{ color: '#888', margin: '0 0 28px', fontSize: 13 }}>
          Click a page title to edit its content. Use arrows to reorder.
        </p>

        {sections.map((section, sIdx) => {
          const pages = pagesMap[section.id] ?? [];
          return (
            <div key={section.id} style={s.card}>
              {/* Section header */}
              <div style={s.cardHead}>
                {/* Reorder arrows — superadmin only */}
                {role === 'superadmin' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button style={{ ...s.btn, padding: '1px 7px', fontSize: 11 }} onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0}>▲</button>
                    <button style={{ ...s.btn, padding: '1px 7px', fontSize: 11 }} onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1}>▼</button>
                  </div>
                )}

                {/* Section name */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#2c1a3e' }}>{section.nameEn}</span>
                  <span style={{ fontSize: 13, color: '#888', marginLeft: 10 }}>{section.nameRu}</span>
                </div>

                {/* Visibility + delete — superadmin only */}
                {role === 'superadmin' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={{ ...s.btn, color: section.visible ? '#27ae60' : '#888' }}
                      onClick={() => toggleVisible(section)}
                      title={section.visible ? 'Hide from public site' : 'Show on public site'}
                    >
                      {section.visible ? '● Visible' : '○ Hidden'}
                    </button>
                    <button style={s.btnDanger} onClick={() => handleDeleteSection(section)}>Delete</button>
                  </div>
                )}
              </div>

              {/* Pages list */}
              <div style={s.cardBody}>
                {pages.length === 0 && (
                  <p style={{ color: '#aaa', fontSize: 13, margin: '8px 0' }}>No pages yet.</p>
                )}
                {pages.map((page, pIdx) => (
                  <div key={page.id} style={s.pageRow}>
                    {/* Reorder arrows */}
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button style={{ ...s.btn, padding: '2px 7px', fontSize: 11 }} onClick={() => movePage(section.id, pIdx, -1)} disabled={pIdx === 0}>▲</button>
                      <button style={{ ...s.btn, padding: '2px 7px', fontSize: 11 }} onClick={() => movePage(section.id, pIdx, 1)} disabled={pIdx === pages.length - 1}>▼</button>
                    </div>

                    {/* Page title — click to edit */}
                    <button
                      style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#2c1a3e', fontWeight: 600, padding: '4px 8px', borderRadius: 4 }}
                      onClick={() => navigate(`/admin/content/edit/${page.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0ede6')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {page.titleEn}
                      <span style={{ fontWeight: 400, color: '#888', marginLeft: 10 }}>{page.titleRu}</span>
                    </button>

                    <span style={s.tag}>#{pIdx + 1}</span>

                    {/* Delete page */}
                    <button style={s.btnDanger} onClick={() => handleDeletePage(page)}>Delete</button>
                  </div>
                ))}

                {/* Add page button */}
                <button
                  style={{ ...s.btnPrimary, marginTop: 14, fontSize: 12 }}
                  onClick={() => addPage(section.id)}
                >
                  + Add Page
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
