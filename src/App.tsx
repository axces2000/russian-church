// src/App.tsx

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { LangProvider }  from './contexts/LangContext';
import { ThemeProvider } from './contexts/ThemeContext';

import AnalyticsTracker  from './components/AnalyticsTracker';
import SiteLayout        from './components/SiteLayout';
import SectionPage       from './pages/SectionPage';

// The whole admin area is lazy-loaded as a single unit (see
// src/admin/AdminApp.tsx) — it carries AuthProvider, AuthGuard, and every
// admin page, so a public visitor never downloads firebase/auth,
// firebase/storage, firebase/functions, or any admin screen just to read
// the Service Schedule. Only a route under /admin pulls this chunk in.
const AdminApp = lazy(() => import('./admin/AdminApp'));

const adminLoadingFallback = (
  <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
    Loading…
  </div>
);

export default function App() {
  return (
    <LangProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AnalyticsTracker />
          <Routes>

            {/* ── Public site ── */}
            <Route path="/" element={
              <SiteLayout><Navigate to="/section/home" replace /></SiteLayout>
            } />
            <Route path="/section/:slug" element={
              <SiteLayout><SectionPage /></SiteLayout>
            } />

            {/* ── Admin — auth and every admin page behind one lazy chunk ── */}
            <Route path="/admin/*" element={
              <Suspense fallback={adminLoadingFallback}>
                <AdminApp />
              </Suspense>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </LangProvider>
  );
}
