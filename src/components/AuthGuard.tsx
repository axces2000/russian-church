// src/components/AuthGuard.tsx

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

export default function AuthGuard({ children, requireSuperAdmin = false }: AuthGuardProps) {
  const { user, role, loading } = useAuth();

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

  return <>{children}</>;
}
