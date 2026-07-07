// src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { LangProvider }  from './contexts/LangContext';
import { AuthProvider }  from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

import AuthGuard         from './components/AuthGuard';
import SiteLayout        from './components/SiteLayout';
import SectionPage       from './pages/SectionPage';
import LoginPage         from './admin/LoginPage';
import AdminDashboard    from './admin/AdminDashboard';
import ContentAdmin      from './admin/ContentAdmin';
import PageEditor        from './admin/PageEditor';
import TemplateSwitcher  from './admin/TemplateSwitcher';
import SiteSettings      from './admin/SiteSettings';
import AdminUsers        from './admin/AdminUsers';

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>

              {/* ── Public site ── */}
              <Route path="/" element={
                <SiteLayout>
                  <Navigate to="/section/home" replace />
                </SiteLayout>
              } />

              <Route path="/section/:slug" element={
                <SiteLayout>
                  <SectionPage />
                </SiteLayout>
              } />

              {/* ── Admin — public ── */}
              <Route path="/admin/login" element={<LoginPage />} />

              {/* ── Admin — protected ── */}
              <Route path="/admin" element={
                <AuthGuard>
                  <AdminDashboard />
                </AuthGuard>
              } />

              <Route path="/admin/content" element={
                <AuthGuard>
                  <ContentAdmin />
                </AuthGuard>
              } />

              <Route path="/admin/content/edit/:pageId" element={
                <AuthGuard>
                  <PageEditor />
                </AuthGuard>
              } />

              {/* Superadmin only */}
              <Route path="/admin/template" element={
                <AuthGuard requireSuperAdmin>
                  <TemplateSwitcher />
                </AuthGuard>
              } />

              <Route path="/admin/settings" element={
                <AuthGuard requireSuperAdmin>
                  <SiteSettings />
                </AuthGuard>
              } />

              <Route path="/admin/users" element={
                <AuthGuard requireSuperAdmin>
                  <AdminUsers />
                </AuthGuard>
              } />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </LangProvider>
  );
}
