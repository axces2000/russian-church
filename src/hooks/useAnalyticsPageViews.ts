// src/hooks/useAnalyticsPageViews.ts
// Firebase/GA4's automatic pageview only fires once, on initial script load.
// A single-page app like this one needs to report each client-side route
// change (via react-router) as its own page_view event manually.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAnalyticsInstance } from '../lib/firebase';

export function useAnalyticsPageViews() {
  const location = useLocation();

  useEffect(() => {
    getAnalyticsInstance().then(async analytics => {
      if (!analytics) return; // Analytics disabled/unsupported — no-op
      const { logEvent } = await import('firebase/analytics');
      logEvent(analytics, 'page_view', {
        page_path:     location.pathname + location.search,
        page_location: window.location.href,
        page_title:    document.title,
      });
    });
  }, [location]);
}
