// src/components/LangToggle.tsx

import React from 'react';
import { useLang } from '../contexts/LangContext';

interface LangToggleProps {
  style?: React.CSSProperties;
}

export default function LangToggle({ style }: LangToggleProps) {
  const { lang, setLang } = useLang();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
      aria-label="Switch language"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: 'transparent',
        border: '1px solid var(--color-accent)',
        borderRadius: 2,
        padding: '5px 12px',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        letterSpacing: '0.06em',
        color: 'var(--color-accent-lt)',
        ...style,
      }}
    >
      <span style={{ opacity: lang === 'en' ? 1 : 0.45, fontWeight: lang === 'en' ? 700 : 400 }}>EN</span>
      <span style={{ opacity: 0.45 }}>/</span>
      <span style={{ opacity: lang === 'ru' ? 1 : 0.45, fontWeight: lang === 'ru' ? 700 : 400 }}>RU</span>
    </button>
  );
}
