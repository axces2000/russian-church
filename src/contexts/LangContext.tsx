// src/contexts/LangContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Lang = 'en' | 'ru';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
});

const STORAGE_KEY = 'rc_lang';

function detectLang(): Lang {
  // 1. Respect saved preference
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'ru') return saved;

  // 2. Detect browser language on first visit
  const browser = navigator.language || '';
  if (browser.toLowerCase().startsWith('ru')) return 'ru';

  return 'en';
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  };

  // Keep <html lang="..."> in sync for accessibility / SEO
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
