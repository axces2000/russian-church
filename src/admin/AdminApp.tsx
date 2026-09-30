// src/admin/AdminApp.tsx
// The entire admin area — AuthProvider, AuthGuard, and every admin page —
// lives behind this single component, which App.tsx only ever reaches via
// React.lazy(). That's what actually keeps firebase/auth, firebase/storage,
// and firebase/functions out of a public visitor's bundle: those SDKs are
// pulled in transitively through AuthContext and the admin pages below,
// and a shared ES module runs its whole top level the moment anything
// imports from it — so as long as nothing on the public path imports this
// file (or firebaseAdmin.ts), the auth/storage/functions SDKs only load
// once someone actually navigates under /admin.

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import AuthGuard from '../components/AuthGuard';

const LoginPage         = lazy(() => import('./LoginPage'));
const AdminDashboard    = lazy(() => import('./AdminDashboard'));
const ContentAdmin      = lazy(() => import('./ContentAdmin'));
const PageEditor        = lazy(() => import('./PageEditor'));
const TemplateSwitcher  = lazy(() => import('./TemplateSwitcher'));
const SiteSettings      = lazy(() => import('./SiteSettings'));
const AdminUsers        = lazy(() => import('./AdminUsers'));
const CalendarAdmin     = lazy(() => import('./CalendarAdmin'));
const SundaySchoolAdmin = lazy(() => import('./SundaySchoolAdmin'));
const CanonReadingAdmin = lazy(() => import('./CanonReadingAdmin'));

// Same plain style used everywhere else (AuthGuard's own loading state,
// App.tsx's outer Suspense while this whole chunk downloads).
const loadingFallback = (
  <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
    Loading…
  </div>
);

// Mounted at "/admin/*" in App.tsx, so every path below is relative to that
// prefix — path="content" matches /admin/content, and `index` matches
// /admin exactly. A descendant <Routes> like this is the standard React
// Router way to code-split a whole route subtree behind one lazy boundary.
export default function AdminApp() {
  return (
    <AuthProvider>
      <Suspense fallback={loadingFallback}>
        <Routes>
          {/* ── Public ── */}
          <Route path="login" element={<LoginPage />} />

          {/* ── Protected ── */}
          <Route index element={
            <AuthGuard><AdminDashboard /></AuthGuard>
          } />
          <Route path="content" element={
            <AuthGuard><ContentAdmin /></AuthGuard>
          } />
          <Route path="content/edit/:pageId" element={
            <AuthGuard><PageEditor /></AuthGuard>
          } />
          <Route path="calendar" element={
            <AuthGuard requireSection="services"><CalendarAdmin /></AuthGuard>
          } />
          <Route path="sunday-school" element={
            <AuthGuard requireSection="sunday-school"><SundaySchoolAdmin /></AuthGuard>
          } />
          <Route path="canon" element={
            <AuthGuard requireSection="services"><CanonReadingAdmin /></AuthGuard>
          } />

          {/* Superadmin only */}
          <Route path="template" element={
            <AuthGuard requireSuperAdmin><TemplateSwitcher /></AuthGuard>
          } />
          <Route path="settings" element={
            <AuthGuard requireSuperAdmin><SiteSettings /></AuthGuard>
          } />
          <Route path="users" element={
            <AuthGuard requireSuperAdmin><AdminUsers /></AuthGuard>
          } />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
