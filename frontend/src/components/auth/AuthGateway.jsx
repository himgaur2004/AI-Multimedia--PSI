import React, { useState } from 'react';
import { api, DEFAULT_BACKEND_URL } from '../../services/api.js';
import { PsiMark } from '../TopBar.jsx';

export default function AuthGateway({ onSuccess, onOpenSettings }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register' | 'guest'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both your username/email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.login(username.trim(), password);
      const me = await api.getMe();
      onSuccess(me);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.register(username.trim(), email.trim(), password);
      const me = await api.getMe();
      onSuccess(me);
    } catch (err) {
      setError(err.message || 'Registration failed. Username or email may already be registered.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError('');
    setLoading(true);
    try {
      const guest = await api.createGuestSession();
      onSuccess(guest.user);
    } catch (err) {
      setError(err.message || 'Failed to start guest session. Please verify backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const currentBackend = api.getBackendUrl() || DEFAULT_BACKEND_URL;

  return (
    <div className="min-h-screen w-screen bg-paper text-ink font-body flex flex-col justify-between p-4 sm:p-6 md:p-8 overflow-y-auto">
      {/* Header bar */}
      <header className="flex items-center justify-between max-w-5xl w-full mx-auto pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <PsiMark />
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-ink flex items-center gap-2">
              PSI
              <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded bg-line/60 text-sub">
                v1.0.0
              </span>
            </h1>
            <p className="text-xs text-sub font-mono">Pan Science Innovation</p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="text-xs font-mono text-sub hover:text-ink flex items-center gap-1.5 px-2.5 py-1 rounded border border-line hover:border-ink/40 transition-colors"
          title="Configure backend host & AI keys"
        >
          <span>⚙</span> Server Settings
        </button>
      </header>

      {/* Main Authentication Hero Container */}
      <main className="flex-1 flex flex-col items-center justify-center my-8 max-w-5xl w-full mx-auto">
        <div className="text-center mb-8 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-line/50 border border-line text-xs font-mono text-sub mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Multimedia AI Research &amp; Analysis Engine
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight mb-2">
            Welcome to PSI
          </h2>
          <p className="text-sm text-sub font-body leading-relaxed">
            Please sign in, create a new account, or enter as a guest to access your grounded document and video intelligence workspace.
          </p>
        </div>

        {/* Auth Gateway Card */}
        <div className="w-full max-w-md bg-paper border border-ink shadow-2xl rounded-[4px] p-6 sm:p-8 relative">
          {/* Segmented Mode Selector */}
          <div className="grid grid-cols-3 border border-ink rounded-[2px] overflow-hidden mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError('');
              }}
              className={`py-2 transition-colors cursor-pointer ${
                activeTab === 'login' ? 'bg-ink text-paper' : 'bg-panel text-ink hover:bg-line/30'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setError('');
              }}
              className={`py-2 border-x border-ink transition-colors cursor-pointer ${
                activeTab === 'register' ? 'bg-ink text-paper' : 'bg-panel text-ink hover:bg-line/30'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('guest');
                setError('');
              }}
              className={`py-2 transition-colors cursor-pointer ${
                activeTab === 'guest' ? 'bg-ink text-paper' : 'bg-panel text-ink hover:bg-line/30'
              }`}
            >
              Guest Use
            </button>
          </div>

          {/* Error Message Box */}
          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 text-red-900 text-xs font-mono rounded-[2px] flex items-start gap-2 animate-shake">
              <span className="text-red-600 font-bold shrink-0">✕</span>
              <div className="flex-1 break-words">{error}</div>
            </div>
          )}

          {/* Tab 1: Sign In */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-sub mb-1.5">
                  Username or Email
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. researcher or user@domain.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full text-xs font-mono bg-panel border border-line focus:border-ink p-2.5 rounded-[2px] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-sub mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full text-xs font-mono bg-panel border border-line focus:border-ink p-2.5 rounded-[2px] outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-ink text-paper text-xs font-bold font-mono rounded-[2px] hover:bg-ink/85 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign In to Workspace →'
                )}
              </button>

              <div className="pt-3 border-t border-line text-center flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('guest');
                    setError('');
                  }}
                  className="text-xs font-mono text-sub hover:text-accent transition-colors cursor-pointer"
                >
                  Just exploring? <span className="underline">Continue as Guest Researcher</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Sign Up (Register) */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono text-sub mb-1.5">Choose Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. alex_research"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full text-xs font-mono bg-panel border border-line focus:border-ink p-2.5 rounded-[2px] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-sub mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full text-xs font-mono bg-panel border border-line focus:border-ink p-2.5 rounded-[2px] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-sub mb-1.5">Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full text-xs font-mono bg-panel border border-line focus:border-ink p-2.5 rounded-[2px] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-sub mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full text-xs font-mono bg-panel border border-line focus:border-ink p-2.5 rounded-[2px] outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-ink text-paper text-xs font-bold font-mono rounded-[2px] hover:bg-ink/85 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                    Creating account…
                  </>
                ) : (
                  'Create Account & Enter →'
                )}
              </button>

              <div className="pt-3 border-t border-line text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError('');
                  }}
                  className="text-xs font-mono text-sub hover:text-accent transition-colors cursor-pointer"
                >
                  Already have an account? <span className="underline">Sign In</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 3: Guest Use */}
          {activeTab === 'guest' && (
            <div className="space-y-5">
              <div className="p-4 bg-panel border border-line rounded-[3px]">
                <div className="flex items-center gap-2 text-ink font-semibold text-xs mb-1.5">
                  <span className="text-accent">✦</span> Instant Guest Researcher Access
                </div>
                <p className="text-xs text-sub leading-relaxed">
                  No email or password needed. A private, isolated research session will be generated immediately with full access to PDF intelligence, Whisper transcription, and AI chat.
                </p>
              </div>

              <div className="space-y-2 text-xs font-mono text-sub">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> Instant 1-click workspace entry
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> Full FAISS vector grounding &amp; citations
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> Can convert to registered account anytime
                </div>
              </div>

              <button
                type="button"
                onClick={handleGuest}
                disabled={loading}
                className="w-full py-3 bg-ink text-paper text-xs font-bold font-mono rounded-[2px] hover:bg-ink/85 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                    Initializing Guest Session…
                  </>
                ) : (
                  'Continue as Guest Researcher →'
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError('');
                  }}
                  className="text-xs font-mono text-sub hover:text-accent transition-colors cursor-pointer"
                >
                  Want to save your threads permanently? <span className="underline">Sign In / Register</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Feature badges strip */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full text-center">
          <div className="p-3 bg-panel/70 border border-line rounded-[3px]">
            <div className="text-xs font-bold font-mono text-ink">Multi-Doc PDF Grounding</div>
            <div className="text-[11px] text-sub mt-0.5">Vector retrieval with page-level citations</div>
          </div>
          <div className="p-3 bg-panel/70 border border-line rounded-[3px]">
            <div className="text-xs font-bold font-mono text-ink">Whisper Transcription</div>
            <div className="text-[11px] text-sub mt-0.5">Video &amp; Audio synced to timestamp seek</div>
          </div>
          <div className="p-3 bg-panel/70 border border-line rounded-[3px]">
            <div className="text-xs font-bold font-mono text-ink">Streaming SSE Q&amp;A</div>
            <div className="text-[11px] text-sub mt-0.5">Token-by-token synthesis with follow-ups</div>
          </div>
        </div>
      </main>

      {/* Footer info & server connectivity */}
      <footer className="max-w-5xl w-full mx-auto pt-4 border-t border-line flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-sub gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Backend Server:</span>
          <code className="text-ink bg-line/50 px-1.5 py-0.5 rounded">{currentBackend}</code>
        </div>
        <div>
          <span>Pan Science Innovation · Built for high-throughput research</span>
        </div>
      </footer>
    </div>
  );
}
