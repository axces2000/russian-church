// src/admin/AdminDashboard.tsx

//import React from 'react';
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
      {/* Responsive top bar styles */}
      <style>{`
        .admin-topbar {
          background: #2c1a3e;
          color: #fff;
          padding: 14px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .admin-topbar-title {
          font-weight: 700;
          font-size: 16px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .admin-topbar-right {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-shrink: 0;
        }
        .admin-topbar-email {
          font-size: 13px;
          opacity: 0.7;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
        }

        @media (max-width: 640px) {
          .admin-topbar {
            flex-direction: column;
            align-items: stretch;
            padding: 14px 18px;
            gap: 10px;
          }
          .admin-topbar-title {
            font-size: 15px;
            white-space: normal;
            text-overflow: clip;
          }
          .admin-topbar-right {
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
          }
          .admin-topbar-email {
            max-width: 160px;
          }
        }
      `}</style>

      {/* Top bar */}
      <div className="admin-topbar">
        <span className="admin-topbar-title">
          Church of Christ the Saviour — Admin
        </span>
        <div className="admin-topbar-right">
          <span className="admin-topbar-email">{user?.email}</span>
          <span style={{
            fontSize: 11, background: role === 'superadmin' ? '#d4af37' : '#555',
            color: role === 'superadmin' ? '#2c1a3e' : '#fff',
            padding: '2px 8px', borderRadius: 999, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}>
            {role}
          </span>
          <button
            onClick={handleSignOut}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff', padding: '5px 12px', borderRadius: 4,
              fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
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

          {/* Service Schedule — superadmin or delegated admin with "services" section */}
          {(role === 'superadmin' || (role === 'admin' && Array.isArray(allowedSections) && allowedSections.includes('services'))) && (
            <AdminCard
              title="Service Schedule"
              description="Manage the services calendar"
              to="/admin/calendar"
              icon="🗓️"
            />
          )}

          {/* Sunday School Schedule — superadmin or delegated admin with "sunday-school" section */}
          {(role === 'superadmin' || (role === 'admin' && Array.isArray(allowedSections) && allowedSections.includes('sunday-school'))) && (
            <AdminCard
              title="Sunday School Schedule"
              description="Manage the Sunday School calendar"
              to="/admin/sunday-school"
              icon="📚"
            />
          )}

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
