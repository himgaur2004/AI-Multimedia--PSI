import React, { useState, useEffect } from 'react';
import { Icon } from '../common/Icons';
import api from '../../services/api';

export function SettingsModal({
  isOpen,
  showKeyModal,
  onClose,
  setShowKeyModal,
  searchMode = 'inbuilt',
  setSearchMode,
  gptModel = 'gpt-4o-mini',
  setGptModel,
  apiKeyInput,
  setApiKeyInput,
  showApiKey,
  setShowApiKey,
  onSaveApiKey,
  onClearApiKey,
}) {
  const visible = isOpen !== undefined ? isOpen : showKeyModal;
  const handleClose = onClose || (() => setShowKeyModal && setShowKeyModal(false));

  const [apiKeys, setApiKeys] = useState([]);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadApiKeys();
    }
  }, [visible]);

  const loadApiKeys = async () => {
    try {
      const keys = await api.listApiKeys();
      setApiKeys(keys || []);
    } catch (_) {}
  };

  const handleCreateApiKey = async () => {
    setKeyLoading(true);
    try {
      const res = await api.createApiKey(`Key ${new Date().toLocaleDateString()}`);
      setNewKey(res.api_key);
      await loadApiKeys();
    } catch (err) {
      alert(err.message || 'Failed to generate API key');
    } finally {
      setKeyLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!visible) return null;

  return (
    <div className="chat-modal-overlay" onClick={handleClose}>
      <div className="settings-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="ai-badge">
              <Icon name="spark" size={15} />
            </div>
            <h3 style={{ margin: 0, font: '600 16px var(--font-sans, sans-serif)', color: 'var(--ink)' }}>
              System Engine & Access Settings
            </h3>
          </div>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: '20px', cursor: 'pointer' }}
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        {/* 1. Default Search Mode */}
        <div className="settings-field-group">
          <label className="settings-label">Active Semantic Search Engine</label>
          <p className="settings-desc">
            Choose between FAISS local vector retrieval or OpenAI conversational synthesis:
          </p>
          <div className="settings-mode-grid">
            <button
              type="button"
              className={`settings-mode-card ${searchMode === 'inbuilt' ? 'active inbuilt' : ''}`}
              onClick={() => setSearchMode && setSearchMode('inbuilt')}
            >
              <div className="mode-card-header">
                <span className="mode-icon">⚡</span>
                <strong>FAISS Vector Search & RAG</strong>
              </div>
              <p>Self-contained FAISS IndexFlatIP dense vector retrieval with Redis caching.</p>
            </button>
            <button
              type="button"
              className={`settings-mode-card ${searchMode === 'gpt' ? 'active gpt' : ''}`}
              onClick={() => setSearchMode && setSearchMode('gpt')}
            >
              <div className="mode-card-header">
                <span className="mode-icon">🧠</span>
                <strong>OpenAI GPT LLM</strong>
              </div>
              <p>Conversational reasoning and multi-hop synthesis with streaming SSE tokens.</p>
            </button>
          </div>
        </div>

        {/* 2. GPT Model Selection */}
        {searchMode === 'gpt' && (
          <div className="settings-field-group">
            <label className="settings-label">OpenAI Chat Model</label>
            <div className="model-radio-group">
              <label className={`model-radio-card ${gptModel === 'gpt-4o-mini' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="gptModel"
                  value="gpt-4o-mini"
                  checked={gptModel === 'gpt-4o-mini'}
                  onChange={() => setGptModel && setGptModel('gpt-4o-mini')}
                />
                <div>
                  <strong>GPT-4o Mini</strong>
                  <small>Fast, cost-effective reasoning (Recommended)</small>
                </div>
              </label>
              <label className={`model-radio-card ${gptModel === 'gpt-4o' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="gptModel"
                  value="gpt-4o"
                  checked={gptModel === 'gpt-4o'}
                  onChange={() => setGptModel && setGptModel('gpt-4o')}
                />
                <div>
                  <strong>GPT-4o</strong>
                  <small>Full flagship intelligence & complex synthesis</small>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* 3. OpenAI API Key Input */}
        <div className="settings-field-group">
          <label className="settings-label">OpenAI API Key (For GPT Mode)</label>
          <p className="settings-desc">
            Stored securely in your local browser session for direct SSE queries:
          </p>
          <div className="key-input-row">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput && setApiKeyInput(e.target.value)}
              placeholder="sk-proj-..."
              className="key-input-field"
            />
            <button
              type="button"
              className="key-toggle-btn"
              onClick={() => setShowApiKey && setShowApiKey(!showApiKey)}
              title={showApiKey ? 'Hide key' : 'Show key'}
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* 4. PSI Developer API Keys (Multi-User Auth) */}
        <div className="settings-field-group" style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label className="settings-label" style={{ marginBottom: 2 }}>PSI Developer API Keys</label>
              <p className="settings-desc" style={{ marginBottom: 0 }}>
                Programmatic multi-user access via <code>X-API-Key</code> or <code>Authorization: Api-Key</code>:
              </p>
            </div>
            <button
              type="button"
              className="glass-btn-subtle"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={handleCreateApiKey}
              disabled={keyLoading}
            >
              {keyLoading ? 'Generating...' : '+ Generate Key'}
            </button>
          </div>

          {newKey && (
            <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginBottom: '4px' }}>
                ✓ New API Key Created (Copy it now, it won't be displayed again):
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code style={{ fontSize: '12px', background: 'var(--card-bg, #fff)', padding: '4px 8px', borderRadius: '4px', flex: 1, overflowX: 'auto' }}>
                  {newKey}
                </code>
                <button
                  type="button"
                  className="glass-btn-subtle"
                  style={{ padding: '4px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  onClick={handleCopyKey}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {apiKeys.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {apiKeys.map((k) => (
                <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '6px 10px', background: 'var(--card-bg, rgba(255,255,255,0.03))', borderRadius: '6px', border: '1px solid var(--line)' }}>
                  <div>
                    <strong>{k.name}</strong> <span style={{ color: 'var(--dim)', marginLeft: '6px' }}>{k.key_prefix}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Production Infrastructure Status */}
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '8px', display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--dim)' }}>
          <div>⚡ <strong>FAISS CPU:</strong> 1.15.0 active</div>
          <div>🗄️ <strong>Redis Cache:</strong> Dual-tier active</div>
          <div>🛡️ <strong>Rate Limiter:</strong> 60 req/min</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button
            className="glass-btn-subtle"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className="settings-save-btn"
            onClick={() => {
              if (onSaveApiKey) onSaveApiKey();
              handleClose();
            }}
          >
            Save & Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;

