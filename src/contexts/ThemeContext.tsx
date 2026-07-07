// src/contexts/ThemeContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import themes, { DEFAULT_THEME_ID } from '../themes/themes';
import type { Theme } from '../themes/themes';

interface ThemeContextValue {
  theme: Theme;
  themeId: string;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: themes.find(t => t.id === DEFAULT_THEME_ID)!,
  themeId: DEFAULT_THEME_ID,
});

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

function injectGoogleFont(src: string) {
  const id = 'theme-font-link';
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = src;
  document.head.appendChild(link);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);

  const theme = themes.find(t => t.id === themeId) ?? themes[0];

  // Apply CSS variables whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    if (theme.vars['--font-display-src']) {
      injectGoogleFont(theme.vars['--font-display-src']);
    }
  }, [theme]);

  // Listen for active template changes in Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'site'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.activeTemplate) {
          setThemeId(data.activeTemplate);
        }
      }
    });
    return unsub;
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
