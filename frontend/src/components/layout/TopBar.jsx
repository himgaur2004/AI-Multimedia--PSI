import React from 'react';
import { Icon } from '../common/Icons';

export function TopBar({
  onOpenSettings,
  onOpenUpload,
  onRefresh,
  onOpenProfile,
  user,
}) {
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">
          <span className="status-dot" /> SIGNAL ROOM 01 • LIVE CONTEXT
        </div>
        <h1>Make sense of the signal.</h1>
        <p className="subhead">
          A private room for turning scattered documents and multimedia into clear decisions.
        </p>
      </div>

      <div className="top-actions">
        <button
          className="icon-button"
          onClick={onOpenSettings}
          title="API Key & Model Settings"
        >
          <Icon name="key" size={15} />
        </button>
        <button
          className="icon-button"
          onClick={onRefresh}
          title="Refresh sources"
        >
          <Icon name="refresh" size={15} />
        </button>
        <button
          className="help-button"
          onClick={onOpenUpload}
          title="Upload new source"
        >
          <Icon name="upload" size={14} />
        </button>
        <div
          className="avatar small"
          onClick={onOpenProfile || onOpenSettings}
          title="Profile & Multi-User Authentication"
          style={{ cursor: 'pointer' }}
        >
          {user?.username ? user.username.substring(0, 2).toUpperCase() : 'JD'}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
