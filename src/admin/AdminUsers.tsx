// src/admin/AdminUsers.tsx
// Superadmin can view, add, and remove admin users here.
// Also assigns which sections each admin can edit.
//
// IMPORTANT: creating a new Firebase Auth user with the client SDK's
// createUserWithEmailAndPassword() automatically signs the app in as that
// new user, which would kick the superadmin out of their own session and
// cause the Firestore admin-record write to fail permission checks.
// To avoid this, we run user creation on a throwaway secondary Firebase
// App/Auth instance, then tear it down — the main `auth` (and the
// superadmin's session) is never touched.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth as mainAuth } from '../lib/firebase';
import { getAdmins, saveAdmin, deleteAdmin, getSections } from '../lib/firestore';
import type { AdminRecord, Section } from '../lib/firestore';

export default function AdminUsers() {
  const [admins, setAdmins]     = useState<AdminRecord[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading]   = useState(true);

  // New user form
  const [newEmail, setNewEmail]       = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole]         = useState<'admin' | 'superadmin'>('admin');
  const [newSections, setNewSections] = useState<string[]>([]);
  const [adding, setAdding]           = useState(false);
  const [addError, setAddError]       = useState('');
  const [addSuccess, setAddSuccess]   = useState('');

  useEffect(() => {
    Promise.all([getAdmins(), getSections()]).then(([a, s]) => {
      setAdmins(a);
      setSections(s);
      setLoading(false);
    });
  }, []);

  const refresh = () => getAdmins().then(setAdmins);

  const handleAddUser = async () => {
    if (!newEmail || !newPassword) { setAddError('Email and password are required.'); return; }
    setAdding(true);
    setAddError('');
    setAddSuccess('');

    // Spin up a throwaway secondary Firebase app + auth instance so that
    // creating the new user doesn't sign the superadmin out of the main
    // `auth` instance (the client SDK auto-signs-in as any newly created user).
    const secondaryApp = initializeApp(mainAuth.app.options, `secondary-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // Create the Firebase Auth account on the secondary instance
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      const uid  = cred.user.uid;

      // Save admin record — this runs while the superadmin is still
      // signed in on the main `auth` instance, so Firestore rules pass.
      await saveAdmin({
        uid,
        email: newEmail,
        role: newRole,
        sections: newRole === 'superadmin' ? 'all' : newSections,
      });

      setAddSuccess(`${newEmail} added successfully.`);
      setNewEmail('');
      setNewPassword('');
      setNewSections([]);
      await refresh();
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      // Clean up the secondary instance regardless of success/failure
      try {
        await secondaryAuth.signOut();
      } catch {
        // ignore
      }
      await deleteApp(secondaryApp);
      setAdding(false);
    }
  };

  // Edit-in-place state
  const [editingUid, setEditingUid]     = useState<string | null>(null);
  const [editRole, setEditRole]         = useState<'admin' | 'superadmin'>('admin');
  const [editSections, setEditSections] = useState<string[]>([]);
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState('');

  const startEdit = (admin: AdminRecord) => {
    setEditingUid(admin.uid);
    setEditRole(admin.role === 'superadmin' ? 'superadmin' : 'admin');
    setEditSections(Array.isArray(admin.sections) ? admin.sections : []);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingUid(null);
    setEditError('');
  };

  const toggleEditSection = (id: string) => {
    setEditSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const saveEdit = async (admin: AdminRecord) => {
    setEditSaving(true);
    setEditError('');
    try {
      await saveAdmin({
        uid: admin.uid,
        email: admin.email,
        role: editRole,
        sections: editRole === 'superadmin' ? 'all' : editSections,
      });
      setEditingUid(null);
      await refresh();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (admin: AdminRecord) => {
    if (!window.confirm(`Remove admin access for ${admin.email}? (Firebase Auth account is kept.)`)) return;
    await deleteAdmin(admin.uid);
    await refresh();
  };

  const toggleSection = (id: string) => {
    setNewSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui' }}>Loading…</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{
        background: '#2c1a3e', color: '#fff', padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Admin Users</span>
        <Link to="/admin" style={{ color: '#d4af37', fontSize: 13, textDecoration: 'none' }}>← Dashboard</Link>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '36px 24px' }}>

        {/* Current admins */}
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 20px' }}>Admin Users</h1>
        <div style={{ background: '#fff', border: '1px solid #e0dbd0', borderRadius: 6, marginBottom: 36, overflow: 'hidden' }}>
          {admins.length === 0 && (
            <p style={{ padding: '20px 24px', color: '#aaa', margin: 0 }}>No admins yet.</p>
          )}
          {admins.map(admin => (
            <div key={admin.uid} style={{ borderBottom: '1px solid #f0ede6' }}>
              <div style={{
                padding: '14px 20px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{admin.email}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    Sections: {
                      admin.sections === 'all'
                        ? 'All sections'
                        : Array.isArray(admin.sections) && admin.sections.length > 0
                          ? admin.sections.join(', ')
                          : 'None assigned'
                    }
                  </div>
                </div>
                <span style={{
                  fontSize: 11, padding: '2px 10px', borderRadius: 999,
                  background: admin.role === 'superadmin' ? '#d4af37' : '#e8e3dc',
                  color: admin.role === 'superadmin' ? '#2c1a3e' : '#666',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {admin.role}
                </span>
                <button
                  onClick={() => editingUid === admin.uid ? cancelEdit() : startEdit(admin)}
                  style={{ padding: '5px 12px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', color: '#2c1a3e', fontSize: 12, cursor: 'pointer' }}
                >
                  {editingUid === admin.uid ? 'Cancel' : 'Edit'}
                </button>
                <button
                  onClick={() => handleDelete(admin)}
                  style={{ padding: '5px 12px', border: '1px solid #e74c3c', borderRadius: 4, background: '#fff', color: '#e74c3c', fontSize: 12, cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>

              {/* Inline edit form */}
              {editingUid === admin.uid && (
                <div style={{ padding: '0 20px 20px', background: '#f9f7f3' }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#444', display: 'block', marginBottom: 6 }}>Role</label>
                    <select
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as 'admin' | 'superadmin')}
                      style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13, fontFamily: 'system-ui', width: 200 }}
                    >
                      <option value="admin">Admin (delegated)</option>
                      <option value="superadmin">Superadmin (full access)</option>
                    </select>
                  </div>

                  {editRole === 'admin' && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#444', display: 'block', marginBottom: 8 }}>
                        Allowed Sections
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {sections.map(sec => (
                          <label key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={editSections.includes(sec.id)}
                              onChange={() => toggleEditSection(sec.id)}
                            />
                            {sec.nameEn}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={() => saveEdit(admin)}
                      disabled={editSaving}
                      style={{
                        padding: '8px 20px', background: '#2c1a3e', color: '#fff',
                        border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13,
                        cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1,
                      }}
                    >
                      {editSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    {editError && <span style={{ fontSize: 13, color: '#e74c3c' }}>{editError}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new admin */}
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 16px' }}>Add New Admin</h2>
        <div style={{ background: '#fff', border: '1px solid #e0dbd0', borderRadius: 6, padding: '24px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <LabeledInput label="Email" value={newEmail} onChange={setNewEmail} type="email" />
            <LabeledInput label="Password" value={newPassword} onChange={setNewPassword} type="password" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#444', display: 'block', marginBottom: 6 }}>Role</label>
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as 'admin' | 'superadmin')}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, fontFamily: 'system-ui', width: 200 }}
            >
              <option value="admin">Admin (delegated)</option>
              <option value="superadmin">Superadmin (full access)</option>
            </select>
          </div>

          {/* Section checkboxes — only for delegated admin role */}
          {newRole === 'admin' && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#444', display: 'block', marginBottom: 8 }}>
                Allowed Sections
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sections.map(sec => (
                  <label key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newSections.includes(sec.id)}
                      onChange={() => toggleSection(sec.id)}
                    />
                    {sec.nameEn}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={handleAddUser}
              disabled={adding}
              style={{
                padding: '10px 24px', background: '#2c1a3e', color: '#fff',
                border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 14,
                cursor: adding ? 'not-allowed' : 'pointer', opacity: adding ? 0.7 : 1,
              }}
            >
              {adding ? 'Adding…' : 'Add Admin'}
            </button>
            {addSuccess && <span style={{ fontSize: 13, color: '#27ae60' }}>✓ {addSuccess}</span>}
            {addError   && <span style={{ fontSize: 13, color: '#e74c3c' }}>{addError}</span>}
          </div>
        </div>

      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '9px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, fontFamily: 'system-ui' }}
      />
    </div>
  );
}
