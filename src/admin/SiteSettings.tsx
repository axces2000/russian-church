// src/admin/SiteSettings.tsx
// Superadmin can edit site name (EN and RU), contact name (EN and RU),
// and phone number here.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSiteSettings, updateSiteSettings } from '../lib/firestore';

export default function SiteSettings() {
  const [siteName, setSiteName]           = useState('');
  const [siteNameRu, setSiteNameRu]       = useState('');
  const [contactNameEn, setContactNameEn] = useState('');
  const [contactNameRu, setContactNameRu] = useState('');
  const [phone, setPhone]                 = useState('');
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [error, setError]                 = useState('');

  useEffect(() => {
    getSiteSettings().then(s => {
      if (s) {
        setSiteName(s.siteName ?? '');
        setSiteNameRu(s.siteNameRu ?? '');
        setContactNameEn(s.contactNameEn ?? '');
        setContactNameRu(s.contactNameRu ?? '');
        setPhone(s.phone ?? '');
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateSiteSettings({ siteName, siteNameRu, contactNameEn, contactNameRu, phone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui' }}>Loading…</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{
        background: '#2c1a3e', color: '#fff', padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Site Settings</span>
        <Link to="/admin" style={{ color: '#d4af37', fontSize: 13, textDecoration: 'none' }}>← Dashboard</Link>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '36px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 28px' }}>Site Settings</h1>

        <div style={{ background: '#fff', border: '1px solid #e0dbd0', borderRadius: 6, padding: '28px 28px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <Field label="Site Name (English)" value={siteName} onChange={setSiteName} />
            <Field label="Site Name (Russian / Русское название)" value={siteNameRu} onChange={setSiteNameRu} />

            <Divider label="Contact person" />
            <Field
              label="Contact Name (English)"
              value={contactNameEn}
              onChange={setContactNameEn}
              placeholder="e.g. Alexei"
            />
            <Field
              label="Contact Name (Russian / Имя на русском)"
              value={contactNameRu}
              onChange={setContactNameRu}
              placeholder="e.g. Алексей"
            />
            <Field
              label="Phone Number (displayed in footer)"
              value={phone}
              onChange={setPhone}
              placeholder="+64 …"
            />

          </div>

          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '10px 26px', background: '#2c1a3e', color: '#fff',
                border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && <span style={{ fontSize: 13, color: '#27ae60' }}>✓ Saved</span>}
            {error && <span style={{ fontSize: 13, color: '#e74c3c' }}>{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 0' }}>
      <div style={{ flex: 1, height: 1, background: '#e0dbd0' }} />
      <span style={{ fontSize: 11, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#e0dbd0' }} />
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#444', letterSpacing: '0.03em' }}>
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '9px 12px', border: '1px solid #ddd', borderRadius: 4,
          fontSize: 14, fontFamily: 'system-ui', width: '100%', outline: 'none',
        }}
      />
    </div>
  );
}