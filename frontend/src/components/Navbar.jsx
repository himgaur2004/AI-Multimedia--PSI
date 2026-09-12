import React from 'react';

export function Navbar({
  documents = [],
  activeDocId,
  onSelectDoc,
  onOpenUpload,
  onOpenAuth,
  onOpenApiKey,
  user,
  theme,
  onToggleTheme,
}) {
  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="brand-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h1 className="brand-title">OmniMind</h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            AI Document & Multimedia Q&A
          </span>
        </div>
      </div>

      <div className="nav-actions">
        {/* Document Switcher */}
        {documents.length > 0 && (
          <select
            value={activeDocId || ''}
            onChange={(e) => onSelectDoc(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
              maxWidth: '220px',
              cursor: 'pointer',
            }}
          >
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.file_type === 'pdf' ? '📄' : doc.file_type === 'video' ? '🎬' : '🎙️'} {doc.original_name}
              </option>
            ))}
          </select>
        )}

        {/* Upload Button */}
        <button className="btn btn-primary btn-sm" onClick={onOpenUpload}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
        </button>

        {/* API Key Modal Trigger */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenApiKey}
          title="Configure OpenAI API Key"
        >
          🔑 Key
        </button>

        {/* Theme Toggle */}
        <button
          className="btn-icon"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* User Badge */}
        <button className="btn btn-secondary btn-sm" onClick={onOpenAuth}>
          {user ? (user.is_guest ? '👤 Guest' : `👤 ${user.username}`) : 'Sign In'}
        </button>
      </div>
    </header>
  );
}
