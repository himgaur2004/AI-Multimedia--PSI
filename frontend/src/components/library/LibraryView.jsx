import React from 'react';
import { Icon, SourceIcon } from '../common/Icons';

export function LibraryView({
  sources,
  librarySearch,
  setLibrarySearch,
  libraryFilter,
  setLibraryFilter,
  selectSource,
  setActiveView,
  openAssetPreview,
  handleDeleteSource,
  onOpenUpload,
}) {
  const filteredSources = sources.filter((s) => {
    const matchesTab = libraryFilter === 'All' || s.type === libraryFilter.toLowerCase();
    const matchesSearch =
      !librarySearch.trim() ||
      s.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      (s.meta && s.meta.toLowerCase().includes(librarySearch.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  return (
    <section className="library-view">
      <div className="library-header">
        <div>
          <h2>Indexed Knowledge Archive</h2>
          <p>Browse, inspect, and launch grounded Q&A across your multimedia and document library.</p>
        </div>
        <div className="library-search-wrap">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Search documents, audio transcripts & video..."
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            className="library-search-input"
          />
        </div>
      </div>

      <div className="library-filter-bar">
        <div className="filter-tabs">
          {['All', 'PDF', 'Audio', 'Video'].map((tab) => (
            <button
              className={libraryFilter === tab ? 'active' : ''}
              key={tab}
              onClick={() => setLibraryFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="library-count-badge">
          Showing {filteredSources.length} of {sources.length} sources
        </div>
      </div>

      {filteredSources.length === 0 ? (
        <div
          className="empty-conversation"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            background: 'rgba(25, 31, 34, 0.4)',
            borderRadius: '12px',
            border: '1px dashed var(--line)',
            margin: '20px 0',
          }}
        >
          <Icon name="file" size={32} />
          <h3 style={{ margin: '12px 0 6px', color: 'var(--ink)' }}>
            {sources.length === 0 ? 'Your library is empty' : 'No matching sources found'}
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '420px', margin: '0 auto 16px' }}>
            {sources.length === 0
              ? 'Upload a PDF document, audio podcast, or video talk to start indexing.'
              : 'Try changing your search term or filter category.'}
          </p>
          {sources.length === 0 && (
            <button className="btn-pill" onClick={onOpenUpload}>
              <Icon name="upload" size={14} /> Upload First File
            </button>
          )}
        </div>
      ) : (
        <div className="library-grid">
          {filteredSources.map((source) => (
            <div key={source.id} className="library-card">
              <div className="library-card-header">
                <SourceIcon type={source.type} />
                <div className="library-card-info">
                  <h3 title={source.name}>{source.name}</h3>
                  <p>{source.meta}</p>
                </div>
                <span className="library-status-chip">
                  <span className="pulse-dot" /> Grounded
                </span>
              </div>

              <p className="library-summary-snippet">
                {source.type === 'pdf'
                  ? 'Indexed into vector space. Page references mapped for grounded citation.'
                  : 'Transcribed with Whisper timestamps. RFC 7233 partial streaming ready.'}
              </p>

              <div className="library-card-actions">
                <button
                  className="btn-pill"
                  onClick={() => {
                    selectSource(source.id);
                    setActiveView('signal');
                  }}
                  title="Enter Signal Room with this source"
                >
                  Enter Room ↗
                </button>
                <button
                  className="btn-pill"
                  onClick={() => openAssetPreview(source)}
                  title="Inspect full details, transcript & playback"
                >
                  Inspect & Play
                </button>
                <button
                  className="btn-danger-ghost"
                  onClick={() => handleDeleteSource(source.id)}
                  title="Delete source"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                >
                  <Icon name="trash" size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default LibraryView;
