// src/admin/AdminDashboard.tsx

import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function AdminDashboard() {
  const { user, role, allowedSections } = useAuth();

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{
        background: '#2c1a3e', color: '#fff', padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          Church of Christ the Saviour — Admin
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>{user?.email}</span>
          <span style={{
            fontSize: 11, background: role === 'superadmin' ? '#d4af37' : '#555',
            color: role === 'superadmin' ? '#2c1a3e' : '#fff',
            padding: '2px 8px', borderRadius: 999, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {role}
          </span>
          <button
            onClick={handleSignOut}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff', padding: '5px 12px', borderRadius: 4,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Dashboard</h1>
        <p style={{ color: '#666', margin: '0 0 32px' }}>
          Select an area to manage below.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {/* Content management */}
          <AdminCard
            title="Content"
            description="Edit pages and sections"
            to="/admin/content"
            icon="📄"
          />

          {/* Service schedule — all admins */}
          <AdminCard
            title="Service Schedule"
            description="Edit service times and manage templates"
            to="/admin/calendar"
            icon="📅"
          />

          {/* Template switcher — superadmin only */}
          {role === 'superadmin' && (
            <AdminCard
              title="Design Template"
              description="Switch the site's visual theme"
              to="/admin/template"
              icon="🎨"
            />
          )}

          {/* Admin management — superadmin only */}
          {role === 'superadmin' && (
            <AdminCard
              title="Admin Users"
              description="Manage admin accounts and permissions"
              to="/admin/users"
              icon="👤"
            />
          )}

          {/* Site settings — superadmin only */}
          {role === 'superadmin' && (
            <AdminCard
              title="Site Settings"
              description="Phone number, site name, etc."
              to="/admin/settings"
              icon="⚙️"
            />
          )}
        </div>

        {/* Delegate info */}
        {role === 'admin' && Array.isArray(allowedSections) && (
          <div style={{
            marginTop: 32, padding: '16px 20px', background: '#fff',
            borderRadius: 6, border: '1px solid #e0dbd0',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
              You have edit access to:{' '}
              <strong>{allowedSections.length > 0 ? allowedSections.join(', ') : 'no sections assigned yet'}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminCard({
  title, description, to, icon,
}: {
  title: string;
  description: string;
  to: string;
  icon: string;
}) {
  return (
    <Link
      to={to}
      style={{
        display: 'block', textDecoration: 'none', background: '#fff',
        border: '1px solid #e0dbd0', borderRadius: 6, padding: '22px 20px',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.10)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#2c1a3e', marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#888' }}>{description}</div>
    </Link>
  );
}
