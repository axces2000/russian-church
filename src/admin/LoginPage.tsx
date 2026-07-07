// src/admin/LoginPage.tsx

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err: any) {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f5f5f0',
    }}>
      <div style={{
        background: '#fff', borderRadius: 6, padding: '40px 36px',
        width: 360, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>
          Admin Login
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: '#666' }}>
          Church of Christ the Saviour
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                padding: '9px 12px', border: '1px solid #ddd', borderRadius: 4,
                fontSize: 14, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                padding: '9px 12px', border: '1px solid #ddd', borderRadius: 4,
                fontSize: 14, outline: 'none',
              }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: '#c0392b' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6, padding: '11px', background: '#2c1a3e',
              color: '#fff', border: 'none', borderRadius: 4,
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
