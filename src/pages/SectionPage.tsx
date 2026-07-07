// src/pages/SectionPage.tsx
// Renders a single section and all its pages.
// If the section has more than one page, shows anchor links at the top.

import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import { subscribeSections, subscribePages } from '../lib/firestore';
import type { Section, Page } from '../lib/firestore';

export default function SectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { lang } = useLang();
  const [sections, setSections] = useState<Section[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  const section = sections.find(s => s.slug === slug);

  useEffect(() => {
    const unsub = subscribeSections(data => {
      setSections(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!section) return;
    const unsub = subscribePages(section.id, setPages);
    return unsub;
  }, [section?.id]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', fontFamily: 'var(--font-body)' }}>Loading…</div>;
  }

  if (!section) {
    return <Navigate to="/" replace />;
  }

  const sectionTitle = lang === 'en' ? section.nameEn : section.nameRu;
  const multiPage = pages.length > 1;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 80px' }}>

      {/* Section heading */}
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 32,
        fontWeight: 600,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        color: 'var(--color-primary)',
        marginBottom: multiPage ? 16 : 32,
        borderBottom: '2px solid var(--color-accent)',
        paddingBottom: 14,
      }}>
        {sectionTitle}
      </h1>

      {/* Anchor links — only when more than one page */}
      {multiPage && (
        <nav aria-label="Section pages" style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {pages.map(page => (
              <a
                key={page.id}
                href={`#page-${page.id}`}
                style={{
                  display: 'inline-block',
                  padding: '7px 16px',
                  background: 'var(--color-surface, #fff)',
                  border: '1px solid var(--color-accent)',
                  color: 'var(--color-primary)',
                  borderRadius: 2,
                  fontSize: 13.5,
                  textDecoration: 'none',
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '0.03em',
                }}
              >
                {lang === 'en' ? page.titleEn : page.titleRu}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* Pages */}
      {pages.map((page, idx) => (
        <article
          key={page.id}
          id={`page-${page.id}`}
          style={{
            marginBottom: 56,
            paddingTop: multiPage && idx > 0 ? 40 : 0,
            borderTop: multiPage && idx > 0 ? '1px solid var(--color-accent)' : 'none',
          }}
        >
          {/* Page heading — only shown when multi-page */}
          {multiPage && (
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              color: 'var(--color-primary)',
              marginBottom: 20,
            }}>
              {lang === 'en' ? page.titleEn : page.titleRu}
            </h2>
          )}

          {/* Rich text content */}
          <div
            className="rich-content"
            dangerouslySetInnerHTML={{
              __html: lang === 'en' ? page.contentEn : page.contentRu,
            }}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 17,
              lineHeight: 1.7,
              color: 'var(--color-text)',
            }}
          />
        </article>
      ))}

      {pages.length === 0 && (
        <p style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>
          {lang === 'en' ? 'No content yet.' : 'Содержимое пока не добавлено.'}
        </p>
      )}
    </div>
  );
}
