import React, { useState } from 'react';
import { api } from '../services/api';

export function AuthModal({ isOpen, onClose, onAuthSuccess, user }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (isRegister) {
        data = await api.register(username, email, password);
      } else {
        data = await api.login(username || email, password);
      }
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await api.createGuestSession();
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Guest session failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="card-panel"
        style={{ width: '100%', maxWidth: '420px', padding: '28px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-md)', color: 'var(--accent-rose)', fontSize: '0.8rem', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Username
            </label>
            <input
              type="text"
              className="chat-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="e.g. gaurav"
            />
          </div>

          {isRegister && (
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Email Address
              </label>
              <input
                type="email"
                className="chat-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="gaurav@example.com"
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Password
            </label>
            <input
              type="password"
              className="chat-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
            {loading ? 'Processing...' : isRegister ? 'Register' : 'Sign In'}
          </button>
        </form>

        <div style={{ margin: '16px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          ── OR ──
        </div>

        <button className="btn btn-secondary" onClick={handleGuest} disabled={loading} style={{ width: '100%' }}>
          ⚡ Continue as Guest (Instant Access)
        </button>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.8rem' }}>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
