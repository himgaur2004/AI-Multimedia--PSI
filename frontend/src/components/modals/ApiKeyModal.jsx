import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function ApiKeyModal({ isOpen, onClose, gptModel, setGptModel, onSettingsSaved }) {
  const [keyInput, setKeyInput] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [backendUrl, setBackendUrl] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeyInput(localStorage.getItem('psi_openai_key') || '');
      setGeminiKeyInput(localStorage.getItem('psi_gemini_key') || '');
      setBackendUrl(api.getBackendUrl() || '');
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    api.setApiKeyOverride(keyInput.trim());
    api.setGeminiApiKeyOverride(geminiKeyInput.trim());
    api.setBackendUrl(backendUrl.trim());
    setSavedSuccess(true);
    if (onSettingsSaved) {
      onSettingsSaved({
        gptModel,
        apiKey: keyInput.trim(),
        geminiKey: geminiKeyInput.trim(),
        backendUrl: backendUrl.trim()
      });
    }
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleClear = () => {
    api.setApiKeyOverride('');
    api.setGeminiApiKeyOverride('');
    api.setBackendUrl('');
    setKeyInput('');
    setGeminiKeyInput('');
    setBackendUrl('');
    setSavedSuccess(true);
    if (onSettingsSaved) {
      onSettingsSaved({ gptModel, apiKey: '', geminiKey: '', backendUrl: '' });
    }
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-paper border border-ink shadow-2xl rounded-[3px] p-6 text-ink">
        <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
          <h3 className="font-display font-semibold text-lg text-ink">AI Model & Key Settings</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center font-mono text-xs hover:bg-line/40 rounded-[2px]"
          >
            ✕
          </button>
        </div>

        {/* Model Selection */}
        <div className="mb-4">
          <label className="block font-mono text-xs text-sub mb-1.5">Default Reasoning Model</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
              { id: 'gpt-4o', label: 'GPT-4o (Deep)' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setGptModel(m.id)}
                className={`py-2 px-3 text-xs font-semibold rounded-[2px] border transition-colors ${
                  gptModel === m.id
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-panel text-ink border-line hover:bg-line/40'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Google Gemini API Key */}
        <div className="mb-4">
          <label className="block font-mono text-xs text-sub mb-1.5 flex items-center justify-between">
            <span>Google Gemini API Key</span>
            <span className="text-[10px] text-accent font-semibold">gemini-1.5-flash / pro</span>
          </label>
          <input
            type="password"
            value={geminiKeyInput}
            onChange={(e) => setGeminiKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full text-xs font-mono bg-panel border border-line p-2.5 rounded-[2px] outline-none placeholder:text-sub focus:border-ink"
          />
          <p className="text-[11px] text-sub mt-1 leading-snug">
            Powers Gemini LLM search and LangChain + Gemini streaming. Keys are stored locally in your browser.
          </p>
        </div>

        {/* Custom OpenAI API Key */}
        <div className="mb-4">
          <label className="block font-mono text-xs text-sub mb-1.5">
            Custom OpenAI API Key <span className="text-[10.5px]">(Optional)</span>
          </label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-proj-..."
            className="w-full text-xs font-mono bg-panel border border-line p-2.5 rounded-[2px] outline-none placeholder:text-sub focus:border-ink"
          />
          <p className="text-[11px] text-sub mt-1 leading-snug">
            Powers GPT LLM &amp; LangChain + OpenAI search. Keys are stored locally in your browser.
          </p>
        </div>

        {/* Backend API Server URL (AWS EC2) */}
        <div className="mb-5">
          <label className="block font-mono text-xs text-sub mb-1.5 flex items-center justify-between">
            <span>Backend Server URL (AWS EC2 HTTPS)</span>
            <span className="text-[10.5px] text-accent font-semibold">{backendUrl ? 'Custom' : 'Default (AWS)'}</span>
          </label>
          <input
            type="url"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="https://15.252.181.80.nip.io"
            className="w-full text-xs font-mono bg-panel border border-line p-2.5 rounded-[2px] outline-none placeholder:text-sub focus:border-ink"
          />
          <p className="text-[11px] text-sub mt-1 leading-snug">
            Directs queries to your live AWS EC2 backend. Default: <code className="bg-line px-1 py-0.5 rounded text-[10px]">https://15.252.181.80.nip.io</code>
          </p>
        </div>

        {savedSuccess && (
          <div className="mb-3 text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-[2px] text-center">
            ✓ Settings updated successfully
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs font-mono text-sub hover:text-accent"
          >
            Clear Key
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold bg-ink text-paper rounded-[2px] hover:bg-ink/90"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
