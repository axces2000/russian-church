// src/components/AuthGuard.tsx

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  /** Section id (e.g. "services", "sunday-school") a delegated admin must
   *  have in allowedSections to enter this route. Ignored for superadmin. */
  requireSection?: string;
}

export default function AuthGuard({ children, requireSuperAdmin = false, requireSection }: AuthGuardProps) {
  const { user, role, allowedSections, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
        Loading…
      </div>
    );
  }

  if (!user || !role) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireSuperAdmin && role !== 'superadmin') {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access denied</h2>
        <p>This area requires superadmin privileges.</p>
      </div>
    );
  }

  if (requireSection && role !== 'superadmin') {
    const hasAccess = Array.isArray(allowedSections) && allowedSections.includes(requireSection);
    if (!hasAccess) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Access denied</h2>
          <p>You don't have edit access to this section.</p>
        </div>
      );
    }
  }

  return <>{children}</>;
}
