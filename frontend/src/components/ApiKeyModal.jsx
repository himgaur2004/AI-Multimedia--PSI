import React, { useState } from 'react';
import { api } from '../services/api';

export function ApiKeyModal({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState(localStorage.getItem('omnimind_openai_key') || '');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    api.setApiKeyOverride(apiKey.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const handleClear = () => {
    api.setApiKeyOverride('');
    setApiKey('');
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
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
        style={{ width: '100%', maxWidth: '460px', padding: '28px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            🔑 Configure OpenAI API Key
          </h2>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
          By default, OmniMind operates in a high-fidelity deterministic mode that works completely offline.
          If you wish to use live OpenAI Whisper and GPT-4o-mini reasoning, provide your API key below:
        </p>

        <div style={{ marginBottom: '16px' }}>
          <input
            type="password"
            className="chat-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-proj-..."
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleClear}>
            Clear Key (Use Offline)
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '✓ Saved!' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
