import React, { useState } from 'react';
import { Icon } from '../common/Icons';
import api from '../../services/api';

export function ProfileAuthModal({
  isOpen,
  onClose,
  user,
  onUserChange,
  onRefreshSources,
}) {
  const [tab, setTab] = useState(user?.is_guest ? 'signin' : 'profile');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMsg('Please enter both your username/email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const resp = await api.login(loginIdentifier.trim(), loginPassword);
      if (onUserChange) onUserChange(resp.user);
      if (onRefreshSources) await onRefreshSources();
      setSuccessMsg(`Welcome back, ${resp.user.username}! Documents refreshed.`);
      setTimeout(onClose, 900);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regUsername.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg('Please fill in all registration fields.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const resp = await api.register(regUsername.trim(), regEmail.trim(), regPassword);
      if (onUserChange) onUserChange(resp.user);
      if (onRefreshSources) await onRefreshSources();
      setSuccessMsg(`Account created! Welcome to your private room, ${resp.user.username}.`);
      setTimeout(onClose, 900);
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Username or email taken.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const guest = await api.createGuestSession();
      if (onUserChange) onUserChange(guest.user);
      if (onRefreshSources) await onRefreshSources();
      setSuccessMsg('Signed out cleanly. Switched to a fresh guest room.');
      setTimeout(onClose, 800);
    } catch (err) {
      setErrorMsg('Failed to log out cleanly.');
    } finally {
      setLoading(false);
    }
  };

  const isGuest = !user || user.is_guest;

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div
        className="settings-modal-card auth-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="ai-badge"><Icon name="spark" size={15} /></div>
            <h3 style={{ margin: 0, font: '600 16px var(--font-sans, sans-serif)', color: 'var(--ink, #fff)' }}>
              Profile & Multi-User Auth
            </h3>
          </div>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--dim, #888)', fontSize: '20px', cursor: 'pointer' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Current Active Account Header Card */}
        <div className="auth-user-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              className="avatar"
              style={{
                width: '42px',
                height: '42px',
                fontSize: '13px',
                background: isGuest ? 'rgba(232, 170, 103, 0.2)' : 'rgba(46, 204, 113, 0.2)',
                color: isGuest ? 'var(--amber, #e8aa67)' : 'var(--mint, #2ecc71)',
                border: `1px solid ${isGuest ? 'rgba(232,170,103,0.4)' : 'rgba(46,204,113,0.4)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {user?.username ? user.username.substring(0, 2).toUpperCase() : 'GU'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--ink, #fff)', fontSize: '13px' }}>
                  {user?.username || 'Guest Engineer'}
                </strong>
                <span
                  style={{
                    fontSize: '9.5px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: isGuest ? 'rgba(232,170,103,0.15)' : 'rgba(46,204,113,0.15)',
                    color: isGuest ? 'var(--amber, #e8aa67)' : 'var(--mint, #2ecc71)',
                    fontWeight: 600,
                  }}
                >
                  {isGuest ? 'Guest Session' : 'Private Tenant'}
                </span>
              </div>
              <small style={{ color: 'var(--dim, #798d8c)', fontSize: '11px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email || 'Ephemeral session • Not persisted'}
              </small>
            </div>
          </div>
          {!isGuest && (
            <button
              type="button"
              className="auth-signout-btn"
              onClick={handleLogout}
              disabled={loading}
              title="Sign out of this tenant"
            >
              Sign out
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="auth-alert-error">
            <Icon name="alert" size={13} /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="auth-alert-success">
            <Icon name="check" size={13} /> {successMsg}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="auth-tabs-row">
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'profile' ? 'active' : ''}`}
            onClick={() => { setTab('profile'); setErrorMsg(''); }}
          >
            My Profile
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => { setTab('signin'); setErrorMsg(''); }}
          >
            {isGuest ? 'Sign In' : 'Switch User'}
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setErrorMsg(''); }}
          >
            Create Account
          </button>
        </div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="auth-profile-details-grid">
              <div>
                <span className="auth-profile-label">USER ID</span>
                <strong className="auth-profile-value">{user?.id || 'guest-session'}</strong>
              </div>
              <div>
                <span className="auth-profile-label">TENANT ISOLATION</span>
                <strong style={{ color: 'var(--mint, #2ecc71)' }}>
                  {isGuest ? 'Ephemeral Sandbox' : '100% Scoped & Encrypted'}
                </strong>
              </div>
              <div>
                <span className="auth-profile-label">ACCOUNT STATUS</span>
                <strong style={{ color: isGuest ? 'var(--amber, #e8aa67)' : 'var(--mint, #2ecc71)' }}>
                  {isGuest ? 'Guest Temporary' : 'Verified Member'}
                </strong>
              </div>
              <div>
                <span className="auth-profile-label">MEMBER SINCE</span>
                <strong className="auth-profile-value">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active Now'}
                </strong>
              </div>
            </div>

            {isGuest ? (
              <div className="auth-guest-notice">
                <Icon name="spark" size={14} />
                <div>
                  <strong>Guest Mode Active</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--dim, #798d8c)' }}>
                    Your documents and chats are only preserved during this session. Create a free account or sign in to retain your documents and keep your private knowledge room isolated from other users.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      type="button"
                      className="auth-modal-submit-btn"
                      style={{ padding: '7px 14px', fontSize: '12px' }}
                      onClick={() => setTab('signin')}
                    >
                      Sign In Existing User
                    </button>
                    <button
                      type="button"
                      className="glass-btn-subtle"
                      style={{ padding: '7px 14px', fontSize: '12px' }}
                      onClick={() => setTab('register')}
                    >
                      Create Account
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="glass-btn-subtle"
                  style={{ flex: 1, padding: '10px', fontSize: '12px' }}
                  onClick={() => setTab('signin')}
                >
                  Switch User / Re-login
                </button>
                <button
                  type="button"
                  className="auth-danger-btn"
                  style={{ flex: 1, padding: '10px', fontSize: '12px' }}
                  onClick={handleLogout}
                  disabled={loading}
                >
                  Sign Out of Room
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sign In Tab */}
        {tab === 'signin' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="auth-modal-label">Username or Email</label>
              <input
                type="text"
                className="auth-modal-input"
                placeholder="Enter username or email address"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="auth-modal-label">Password</label>
              <input
                type="password"
                className="auth-modal-input"
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="auth-modal-submit-btn"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In to Private Room'}
            </button>
          </form>
        )}

        {/* Register Tab */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="auth-modal-label">Desired Username</label>
              <input
                type="text"
                className="auth-modal-input"
                placeholder="e.g. alex_engineer"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="auth-modal-label">Email Address</label>
              <input
                type="email"
                className="auth-modal-input"
                placeholder="alex@company.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="auth-modal-label">Password (min. 6 characters)</label>
              <input
                type="password"
                className="auth-modal-input"
                placeholder="Create secure password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="auth-modal-submit-btn"
              disabled={loading}
            >
              {loading ? 'Creating Tenant Room...' : 'Create Account & Launch Room'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ProfileAuthModal;
