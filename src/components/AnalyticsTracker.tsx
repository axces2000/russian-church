// src/components/AnalyticsTracker.tsx
// Renders nothing — just fires a GA4 page_view event on every route change.
// Must be rendered inside <BrowserRouter> (it uses useLocation internally).

import { useAnalyticsPageViews } from '../hooks/useAnalyticsPageViews';

export default function AnalyticsTracker() {
  useAnalyticsPageViews();
  return null;
}
