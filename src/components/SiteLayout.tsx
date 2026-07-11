// src/components/SiteLayout.tsx
// The outer shell of the public-facing site.
// Uses CSS variables set by ThemeProvider so it automatically
// re-skins when the active template changes.

import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import LangToggle from './LangToggle';
import { subscribeSections, subscribeSettings } from '../lib/firestore';
import type { Section, SiteSettings } from '../lib/firestore';

// Orthodox cross SVG — matches the mastered design from the templates
function OrthodoxCross({ size = 28, color = 'var(--color-accent)' }: { size?: number; color?: string }) {
  const w = Math.round(size * 0.75);
  return (
    <svg viewBox="0 0 48 64" width={w} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
      <g fill={color}>
        <rect x="21" y="0" width="6" height="62" />
        <rect x="14" y="6" width="20" height="5" />
        <rect x="0" y="19" width="48" height="6" />
        <rect x="12" y="44" width="24" height="6" transform="rotate(-12 24 47)" />
      </g>
    </svg>
  );
}

interface SiteLayoutProps {
  children: React.ReactNode;
}

export default function SiteLayout({ children }: SiteLayoutProps) {
  const { lang } = useLang();
  const [sections, setSections] = useState<Section[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsub1 = subscribeSections(setSections);
    const unsub2 = subscribeSettings(setSettings);
    return () => { unsub1(); unsub2(); };
  }, []);

  const visibleSections = sections.filter(s => s.visible);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>

      {/* ── Header ── */}
      <header style={{ background: 'var(--color-primary)', borderBottom: '2px solid var(--color-accent)' }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          {/* Cross — left */}
          <Link to="/" aria-label="Home" style={{ flexShrink: 0 }}>
            <OrthodoxCross size={32} color="var(--color-accent)" />
          </Link>

          {/* Brand — centre */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 20, color: '#fff',
              fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase',
            }}>
              {lang === 'en' 
  ? (settings?.siteName ?? 'Church of Christ the Saviour')
  : (settings?.siteNameRu ?? 'Храм Христа Спасителя')
}
            </div>
            <div style={{
              fontSize: 11, color: 'var(--color-accent-lt)',
              letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 3,
            }}>
              {lang === 'en' ? 'Russian Orthodox Church · Wellington' : 'Русская православная церковь · Веллингтон'}
            </div>
          </div>

          {/* Language switch + mobile menu toggle — right */}
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <LangToggle />
            <button
              className="mobile-menu-toggle"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              style={{
                display: 'none', // shown via CSS at mobile breakpoint
                background: 'none', border: '1px solid var(--color-accent)',
                borderRadius: 3, width: 38, height: 34, cursor: 'pointer',
                flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 5,
              }}
            >
              <span style={{ width: 18, height: 1.5, background: 'var(--color-accent-lt)', display: 'block' }} />
              <span style={{ width: 18, height: 1.5, background: 'var(--color-accent-lt)', display: 'block' }} />
              <span style={{ width: 18, height: 1.5, background: 'var(--color-accent-lt)', display: 'block' }} />
            </button>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav
          aria-label="Main navigation"
          style={{
            background: 'var(--color-primary-dk)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div className="desktop-nav-links" style={{
            maxWidth: 1180, margin: '0 auto',
            display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
          }}>
            {visibleSections.map(section => (
              <NavLink
                key={section.id}
                to={`/section/${section.slug}`}
                style={({ isActive }) => ({
                  padding: '13px 20px',
                  fontSize: 13.5,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: isActive ? '#fff' : 'var(--color-accent-lt)',
                  textDecoration: 'none',
                  borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                  fontFamily: 'var(--font-body)',
                  fontWeight: isActive ? 700 : 400,
                })}
              >
                {lang === 'en' ? section.nameEn : section.nameRu}
              </NavLink>
            ))}
          </div>

          {/* Mobile dropdown — only ever opened via the mobile-only hamburger button,
              so it never appears alongside the desktop nav row */}
          {menuOpen && (
            <div className="mobile-nav-dropdown" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {visibleSections.map(section => (
                <NavLink
                  key={section.id}
                  to={`/section/${section.slug}`}
                  onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '14px 24px', color: 'var(--color-accent-lt)', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 15 }}
                >
                  {lang === 'en' ? section.nameEn : section.nameRu}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
      </header>

      {/* ── Page content ── */}
      <main>{children}</main>

      {/* ── Footer ── */}
      <footer style={{ background: 'var(--color-primary-dk)', color: 'var(--color-accent-lt)', padding: '40px 24px 24px', marginTop: 28 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              {lang === 'en' ? 'Visit Us' : 'Наш адрес'}
            </div>
            <p style={{ margin: 0, fontSize: 13.5 }}>
              <a
                href="https://maps.app.goo.gl/F9NHkeNPLXyuhbdg6"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                62 Darlington Road, Miramar, Wellington 6022
              </a>
            </p>
          </div>
<div>
  <div style={{ color: '#fff', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
    {lang === 'en' ? 'Contact' : 'Контакты'}
  </div>
  {(settings?.contactNameEn || settings?.contactNameRu || settings?.phone) && (
    <p style={{ margin: 0, fontSize: 13.5 }}>
      {settings?.phone ? (
        <a
          href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`}
          style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          {lang === 'en'
            ? (settings.contactNameEn || settings.contactNameRu || settings.phone)
            : (settings.contactNameRu || settings.contactNameEn || settings.phone)}
        </a>
      ) : (
        lang === 'en'
          ? (settings.contactNameEn || settings.contactNameRu)
          : (settings.contactNameRu || settings.contactNameEn)
      )}
    </p>
  )}
</div>
          <div>
            <div style={{ color: '#fff', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              {lang === 'en' ? 'Diocese' : 'Епархия'}
            </div>
            <p style={{ margin: 0, fontSize: 13.5 }}>
              <a
                href="https://rocor.org.au/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                {lang === 'en' ? 'Australian & New Zealand Diocese, ROCOR' : 'Австралийско-Новозеландская епархия РПЦЗ'}
              </a>
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 28, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          © Church of Christ the Saviour, Wellington
        </div>
      </footer>
    </div>
  );
}
