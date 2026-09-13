import React, { useEffect, useRef } from 'react';

export default function AccountMenu({ user, onClose, onOpenSettings, onOpenAuth, onLogout }) {
  const menuRef = useRef(null);

  // Click-outside listener with cleanup to prevent memory leaks
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-11 w-64 bg-paper border border-ink shadow-lg rounded-[2px] p-3 z-50 text-xs text-ink"
    >
      <div className="pb-2.5 border-b border-line mb-2">
        <div className="font-semibold text-sm truncate">{user?.username || 'Guest Researcher'}</div>
        <div className="text-sub font-mono text-[11px] truncate">
          {user?.is_guest ? 'Temporary Guest Session' : user?.email || 'Active Account'}
        </div>
      </div>

      <div className="space-y-1">
        <button
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-[2px] hover:bg-line/40 transition-colors flex items-center justify-between cursor-pointer"
        >
          <span>OpenAI Key & Models</span>
          <span className="font-mono text-[10px] text-sub">⚙</span>
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenAuth();
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-[2px] hover:bg-line/40 transition-colors flex items-center justify-between cursor-pointer"
        >
          <span>{user?.is_guest ? 'Sign in / Register' : 'Switch Account'}</span>
          <span className="font-mono text-[10px] text-sub">→</span>
        </button>

        {onLogout && (
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-[2px] hover:bg-red-500/10 text-red-700 hover:text-red-900 transition-colors flex items-center justify-between cursor-pointer"
          >
            <span>Sign Out</span>
            <span className="font-mono text-[10px]">⎋</span>
          </button>
        )}

        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="block px-2.5 py-1.5 rounded-[2px] hover:bg-line/40 transition-colors text-sub hover:text-ink font-mono text-[11px]"
        >
          FastAPI Docs (/docs) ↗
        </a>
      </div>

      <div className="pt-2 border-t border-line mt-2 text-[10.5px] font-mono text-sub text-center">
        PSI v1.0.0 · Local RAG + Whisper
      </div>
    </div>
  );
}
