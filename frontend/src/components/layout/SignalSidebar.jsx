import React from 'react';
import { Icon } from '../common/Icons';

export function SignalSidebar({
  activeView,
  setActiveView,
  sources = [],
  onOpenUpload,
  onOpenSettings,
  onOpenProfile,
  user,
}) {

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <span />
        </div>
        <span>lumen</span>
      </div>

      <div className="room-label">
        INTELLIGENCE ROOM <span>01</span>
      </div>

      <button
        className="new-space"
        onClick={onOpenUpload}
        title="Upload new document, audio or video"
      >
        <Icon name="plus" size={17} /> Add source <kbd>⌘ U</kbd>
      </button>

      <nav className="primary-nav" aria-label="Primary navigation">
        <button
          className={activeView === 'signal' ? 'nav-active' : ''}
          onClick={() => setActiveView('signal')}
        >
          <Icon name="grid" /> <span>Signal room</span>
        </button>
        <button
          className={activeView === 'library' ? 'nav-active' : ''}
          onClick={() => setActiveView('library')}
        >
          <Icon name="file" /> <span>Library</span>
          <b>{sources.length}</b>
        </button>
        <button
          className={activeView === 'settings' ? 'nav-active' : ''}
          onClick={onOpenSettings}
        >
          <Icon name="settings" /> <span>Preferences</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <div className="pulse-key">
          <span className="pulse-dot" />
          <div>
            <strong>{sources.length > 0 ? 'Room grounded' : 'Awaiting sources'}</strong>
            <small>{sources.length} active in index</small>
          </div>
        </div>
        <div className="profile" onClick={onOpenProfile || onOpenSettings} title="User account & authentication">
          <div className="avatar">
            {user?.username ? user.username.substring(0, 2).toUpperCase() : 'JD'}
          </div>
          <div>
            <strong>{user?.username || 'Guest Engineer'}</strong>
            <small>{user?.is_guest ? 'Guest room' : 'Private room'}</small>
          </div>
          <span className="dots">•••</span>
        </div>
      </div>
    </aside>

  );
}

export default SignalSidebar;
