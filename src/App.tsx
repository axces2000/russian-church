// src/App.tsx

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { LangProvider }        from './contexts/LangContext';
import { AuthProvider }        from './contexts/AuthContext';
import { ThemeProvider }       from './contexts/ThemeContext';

import AuthGuard               from './components/AuthGuard';
import AnalyticsTracker        from './components/AnalyticsTracker';
import SiteLayout              from './components/SiteLayout';
import SectionPage             from './pages/SectionPage';

// Admin pages are lazy-loaded: a public visitor reading the Service
// Schedule should never have to download the entire admin panel (the rich
// text editor wrapper, six separate admin screens, etc.) just to see the
// homepage. Only a route under /admin pulls this chunk in.
const LoginPage         = lazy(() => import('./admin/LoginPage'));
const AdminDashboard    = lazy(() => import('./admin/AdminDashboard'));
const ContentAdmin      = lazy(() => import('./admin/ContentAdmin'));
const PageEditor        = lazy(() => import('./admin/PageEditor'));
const TemplateSwitcher  = lazy(() => import('./admin/TemplateSwitcher'));
const SiteSettings      = lazy(() => import('./admin/SiteSettings'));
const AdminUsers        = lazy(() => import('./admin/AdminUsers'));
const CalendarAdmin     = lazy(() => import('./admin/CalendarAdmin'));
const SundaySchoolAdmin = lazy(() => import('./admin/SundaySchoolAdmin'));
const CanonReadingAdmin = lazy(() => import('./admin/CanonReadingAdmin'));

// Shared fallback shown for the brief moment an admin chunk is downloading —
// same plain style AuthGuard already uses for its own loading state.
const adminLoadingFallback = (
  <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
    Loading…
  </div>
);

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <AnalyticsTracker />
            <Suspense fallback={adminLoadingFallback}>
            <Routes>

              {/* ── Public site ── */}
              <Route path="/" element={
                <SiteLayout><Navigate to="/section/home" replace /></SiteLayout>
              } />
              <Route path="/section/:slug" element={
                <SiteLayout><SectionPage /></SiteLayout>
              } />

              {/* ── Admin — public ── */}
              <Route path="/admin/login" element={<LoginPage />} />

              {/* ── Admin — protected ── */}
              <Route path="/admin" element={
                <AuthGuard><AdminDashboard /></AuthGuard>
              } />
              <Route path="/admin/content" element={
                <AuthGuard><ContentAdmin /></AuthGuard>
              } />
              <Route path="/admin/content/edit/:pageId" element={
                <AuthGuard><PageEditor /></AuthGuard>
              } />
              <Route path="/admin/calendar" element={
                <AuthGuard requireSection="services"><CalendarAdmin /></AuthGuard>
              } />
              <Route path="/admin/sunday-school" element={
                <AuthGuard requireSection="sunday-school"><SundaySchoolAdmin /></AuthGuard>
              } />
              <Route path="/admin/canon" element={
                <AuthGuard requireSection="services"><CanonReadingAdmin /></AuthGuard>
              } />

              {/* Superadmin only */}
              <Route path="/admin/template" element={
                <AuthGuard requireSuperAdmin><TemplateSwitcher /></AuthGuard>
              } />
              <Route path="/admin/settings" element={
                <AuthGuard requireSuperAdmin><SiteSettings /></AuthGuard>
              } />
              <Route path="/admin/users" element={
                <AuthGuard requireSuperAdmin><AdminUsers /></AuthGuard>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </LangProvider>
  );
}
