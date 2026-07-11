// src/admin/TemplateSwitcher.tsx
// Superadmin can switch the site's visual template here.
// Writes activeTemplate to settings/site in Firestore.
// ThemeProvider picks up the change in real time via onSnapshot.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import themes from '../themes/themes';
import { getSiteSettings, updateSiteSettings } from '../lib/firestore';

export default function TemplateSwitcher() {
  const [activeId, setActiveId] = useState('hagia-sophia-gold');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    getSiteSettings().then(s => {
      if (s?.activeTemplate) setActiveId(s.activeTemplate);
    });
  }, []);

  const handleSelect = async (id: string) => {
    if (id === activeId) return;
    setSaving(true);
    setSaved('');
    await updateSiteSettings({ activeTemplate: id });
    setActiveId(id);
    setSaving(false);
    setSaved(id);
    setTimeout(() => setSaved(''), 2500);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{
        background: '#2c1a3e', color: '#fff', padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Design Template</span>
        <Link to="/admin" style={{ color: '#d4af37', fontSize: 13, textDecoration: 'none' }}>← Dashboard</Link>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Choose a Design Template</h1>
        <p style={{ color: '#888', margin: '0 0 32px', fontSize: 13 }}>
          The selected template is applied to the entire site instantly. All content is preserved.
          {saving && <span style={{ marginLeft: 12, color: '#d4af37' }}>Applying…</span>}
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {themes.map(theme => {
            const isActive = theme.id === activeId;
            const justSaved = saved === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme.id)}
                disabled={saving}
                style={{
                  textAlign: 'left',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  border: isActive ? '3px solid #d4af37' : '2px solid #e0dbd0',
                  borderRadius: 8,
                  padding: 0,
                  background: 'none',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.15s',
                  boxShadow: isActive ? '0 0 0 2px rgba(212,175,55,0.35)' : 'none',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.boxShadow = 'none'; }}
              >
                {/* Colour preview strip */}
                <div style={{
                  height: 80,
                  background: `linear-gradient(135deg, ${theme.vars['--color-primary']} 0%, ${theme.vars['--color-primary-dk']} 60%, ${theme.vars['--color-accent']} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* Mini cross preview */}
                  <svg viewBox="0 0 48 64" width="20" height="26" aria-hidden="true">
                    <g fill={theme.vars['--color-accent'] ?? '#fff'}>
                      <rect x="21" y="0" width="6" height="62"/>
                      <rect x="14" y="6" width="20" height="5"/>
                      <rect x="0" y="19" width="48" height="6"/>
                      <rect x="12" y="44" width="24" height="6" transform="rotate(12 24 47)"/>
                    </g>
                  </svg>
                  <span style={{
                    marginLeft: 10, color: theme.vars['--color-accent-lt'] ?? '#fff',
                    fontFamily: theme.vars['--font-display'] ?? 'serif',
                    fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    {theme.name}
                  </span>
                </div>

                {/* Card footer */}
                <div style={{
                  padding: '12px 16px',
                  background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#2c1a3e' }}>{theme.name}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                      {theme.vars['--font-body']?.replace(/'/g, '').split(',')[0]}
                    </div>
                  </div>
                  {isActive && (
                    <span style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 999,
                      background: '#d4af37', color: '#2c1a3e', fontWeight: 700,
                    }}>
                      {justSaved ? '✓ Applied' : 'Active'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
