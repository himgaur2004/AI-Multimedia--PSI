import React, { useState } from 'react';
import { api } from '../../services/api';

export default function AuthModal({ isOpen, onClose, user, onUserChange, onRefreshSources }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(username, password);
      const me = await api.getMe();
      onUserChange(me);
      await onRefreshSources();
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.register(username, email, password);
      const me = await api.getMe();
      onUserChange(me);
      await onRefreshSources();
      onClose();
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      const guest = await api.createGuestSession();
      onUserChange(guest.user);
      await onRefreshSources();
      onClose();
    } catch (err) {
      setError(err.message || 'Guest session failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm bg-paper border border-ink shadow-2xl rounded-[3px] p-6 text-ink">
        <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
          <h3 className="font-display font-semibold text-lg text-ink">
            {tab === 'login' ? 'Sign In to PSI' : 'Create Account'}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center font-mono text-xs hover:bg-line/40 rounded-[2px]"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border border-ink rounded-[2px] overflow-hidden mb-4 text-xs font-semibold">
          <button
            onClick={() => {
              setTab('login');
              setError('');
            }}
            className={`flex-1 py-1.5 transition-colors ${
              tab === 'login' ? 'bg-ink text-paper' : 'bg-panel text-ink hover:bg-line/30'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setTab('register');
              setError('');
            }}
            className={`flex-1 py-1.5 border-l border-ink transition-colors ${
              tab === 'register' ? 'bg-ink text-paper' : 'bg-panel text-ink hover:bg-line/30'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-800 text-xs font-mono rounded-[2px]">
            {error}
          </div>
        )}

        <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-3">
          <div>
            <label className="block text-xs font-mono text-sub mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full text-xs font-mono bg-panel border border-line p-2 rounded-[2px] outline-none"
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-mono text-sub mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs font-mono bg-panel border border-line p-2 rounded-[2px] outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-sub mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-xs font-mono bg-panel border border-line p-2 rounded-[2px] outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-ink text-paper text-xs font-bold rounded-[2px] hover:bg-ink/90 disabled:opacity-50 mt-2"
          >
            {loading ? 'Processing…' : tab === 'login' ? 'Sign In' : 'Register Account'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-line text-center">
          <button
            onClick={handleGuest}
            disabled={loading}
            className="text-xs font-mono text-sub hover:text-accent underline"
          >
            Continue as Guest Researcher
          </button>
        </div>
      </div>
    </div>
  );
}
