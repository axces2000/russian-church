// src/components/CanonReadingNotice.tsx
// Renders the nearest upcoming (or, if none, most recent) published Canon
// Reading announcement below the Service Schedule on the public Services
// page. The announcement body itself is Russian-only (it's produced for a
// Russian-speaking Zoom gathering), but the section heading follows the
// site's usual EN/RU toggle for consistency with the surrounding chrome.

import { useEffect, useState } from 'react';
import { useLang } from '../contexts/LangContext';
import { subscribeCanonReadings } from '../lib/firestore';
import type { CanonReading } from '../lib/firestore';

export default function CanonReadingNotice() {
  const { lang } = useLang();
  const [readings, setReadings] = useState<CanonReading[]>([]);

  useEffect(() => subscribeCanonReadings(setReadings), []);

  const published = readings.filter(r => r.status === 'published');
  if (published.length === 0) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  // subscribeCanonReadings orders by date desc — pick the nearest one that
  // hasn't passed yet, falling back to the most recent past one.
  const upcoming = [...published].reverse().find(r => r.date >= todayStr);
  const entry = upcoming ?? published[0];

  return (
    <div style={{ marginTop:48, paddingTop:32, borderTop:'2px solid var(--color-accent)' }}>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:600,
        letterSpacing:'0.03em', textTransform:'uppercase', color:'var(--color-primary)',
        marginBottom:18 }}>
        {lang === 'ru' ? 'Чтение канона' : 'Reading of the Canon'}
      </h2>
      <div className="rich-content" style={{ fontFamily:'var(--font-body)', fontSize:16,
        lineHeight:1.7, color:'var(--color-text)' }}
        dangerouslySetInnerHTML={{ __html: entry.html }} />
    </div>
  );
}
