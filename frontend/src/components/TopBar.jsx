import React, { useState } from 'react';
import AccountMenu from './AccountMenu.jsx';

export function PsiMark({ className = '' }) {
  return (
    <div className={`w-9 h-9 rounded-lg bg-[#141413] flex items-center justify-center p-1.5 shadow-sm shrink-0 ${className}`}>
      <img
        src="/psi-icon-white.webp"
        alt="PSI"
        className="w-full h-full object-contain"
      />
    </div>
  );
}

export default function TopBar({
  activeTab = 'workspace',
  onTabChange,
  workspaceMode,
  onWorkspaceModeChange,
  sourcesCount = 0,
  user,
  onOpenSettings,
  onOpenAuth,
  onRefresh,
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-6 md:px-10 py-3 border-b border-line bg-paper sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <PsiMark />
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold tracking-tight text-ink">PSI</span>
          <span className="hidden sm:inline text-xs text-sub font-mono">
            Pan Science Innovation
          </span>
        </div>
      </div>

      {/* Main Navigation: Workspace vs Library (Threads Archive) */}
      <nav className="flex items-center gap-6 text-xs md:text-sm font-medium">
        <button
          onClick={() => onTabChange('workspace')}
          className={`transition-colors py-1 border-b-2 font-mono ${
            activeTab === 'workspace'
              ? 'border-ink text-ink font-semibold'
              : 'border-transparent text-sub hover:text-ink'
          }`}
        >
          Workspace
        </button>
        <button
          onClick={() => onTabChange('library')}
          className={`transition-colors py-1 border-b-2 font-mono flex items-center gap-1.5 ${
            activeTab === 'library'
              ? 'border-ink text-ink font-semibold'
              : 'border-transparent text-sub hover:text-ink'
          }`}
        >
          <span>Library &amp; Threads</span>
          <span className="px-1.5 py-0.2 rounded-full bg-line text-[10px] text-ink font-bold">
            {sourcesCount}
          </span>
        </button>
      </nav>

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="hidden lg:flex hover:text-ink transition-colors items-center gap-1 text-xs font-mono text-sub"
          title="Refresh index from backend"
        >
          <span>↻</span> Sync
        </button>

        {/* Account Button & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-ink text-paper flex items-center justify-center text-xs font-semibold font-mono hover:opacity-90 transition-opacity"
            aria-label="Account and settings"
            title={user ? `${user.username} (${user.is_guest ? 'Guest' : 'Member'})` : 'Account'}
          >
            {user?.username ? user.username.substring(0, 2).toUpperCase() : 'PS'}
          </button>
          {accountOpen && (
            <AccountMenu
              user={user}
              onClose={() => setAccountOpen(false)}
              onOpenSettings={onOpenSettings}
              onOpenAuth={onOpenAuth}
            />
          )}
        </div>
      </div>
    </header>
  );
}
