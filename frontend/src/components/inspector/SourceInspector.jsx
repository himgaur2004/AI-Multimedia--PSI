import React, { useState } from 'react';
import { Icon, SourceIcon, formatSeconds, parseSeconds } from '../common/Icons';
import { MediaPlayerSection } from '../workspace/MediaPlayerSection';

export function SourceInspector({
  sources = [],
  activeSource,
  selectSource,
  handleDeleteSource,
  onOpenUpload,
  dragOver,
  setDragOver,
  handleDrop,
  activeMediaUrl,
  playback,
  topics,
  topicSearch,
  setTopicSearch,
  summaryData,
  onOpenChatModal,
  openAssetPreview,
}) {
  const [filter, setFilter] = useState('All');

  const visibleSources = sources.filter(
    (s) => filter === 'All' || s.type === filter.toLowerCase()
  );

  const isMedia = activeSource && activeSource.type !== 'pdf';

  return (
    <aside className="inspector">
      {/* If active source is video or audio: Render the live synchronized media player first */}
      {isMedia && playback && (
        <div style={{ marginBottom: '20px' }}>
          <div className="section-index" style={{ marginBottom: '8px' }}>
            04 / MEDIA STATION
          </div>
          <MediaPlayerSection
            activeSource={activeSource}
            activeMediaUrl={activeMediaUrl}
            mediaRef={playback.mediaRef}
            playing={playback.playing}
            togglePlay={playback.togglePlay}
            currentTime={playback.currentTime}
            duration={playback.duration}
            handleSeek={playback.handleSeek}
            handleMediaTimeUpdate={playback.onTimeUpdate}
            handleMediaLoaded={playback.onLoadedMetadata}
            handleMediaEnded={playback.onEnded}
            playbackSpeed={playback.playbackSpeed}
            changePlaybackSpeed={playback.handleSpeedChange}
            isMuted={playback.isMuted}
            volume={playback.volume}
            toggleMute={playback.toggleMute}
            handleVolumeChange={playback.handleVolumeChange}
            togglePiP={playback.togglePiP}
            toggleFullscreen={playback.toggleFullscreen}
            topics={topics}
            jumpToTimestamp={playback.jumpToTimestamp}
            topicSearch={topicSearch}
            setTopicSearch={setTopicSearch}
          />
        </div>
      )}

      {/* 03 / EVIDENCE Section */}
      <div className="inspector-head">
        <div>
          <div className="section-index">03 / EVIDENCE</div>
          <h2>Source constellation</h2>
        </div>
        <button
          className="add-circle"
          aria-label="Add source"
          onClick={onOpenUpload}
          title="Add new document or media"
        >
          <Icon name="plus" size={17} />
        </button>
      </div>

      {/* Orbital Signal Radar */}
      <div className="signal-map">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <span className="map-core">
          <Icon name="spark" size={15} />
        </span>
        <span className="map-node node-one" />
        <span className="map-node node-two" />
        <span className="map-node node-three" />
        <div className="map-caption">
          <strong>{sources.length}</strong>
          <span>linked sources</span>
        </div>
      </div>

      {/* Filter Tabs & Sources List */}
      <div className="filter-tabs" style={{ marginBottom: '10px' }}>
        {['All', 'PDF', 'Audio', 'Video'].map((tab) => (
          <button
            className={filter === tab ? 'active' : ''}
            key={tab}
            onClick={() => setFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="source-list" style={{ marginBottom: '14px', maxHeight: '180px', overflowY: 'auto' }}>
        {visibleSources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--dim)', fontSize: '11px' }}>
            No {filter !== 'All' ? filter : ''} sources yet.
          </div>
        ) : (
          visibleSources.map((source) => (
            <div
              className={`source-card ${activeSource?.id === source.id ? 'selected' : ''}`}
              key={source.id}
              onClick={() => selectSource && selectSource(source.id)}
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
            >
              <SourceIcon type={source.type} />
              <span className="source-details">
                <strong title={source.name}>{source.name}</strong>
                <small>{source.meta}</small>
              </span>
              <button
                className="source-delete-btn"
                title={`Delete ${source.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSource && handleDeleteSource(source.id);
                }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* If active source is PDF: Render Document Intel & Passage Navigator */}
      {!isMedia && activeSource && (
        <>
          <div className="active-source-card-wrap" style={{ margin: '14px 0' }}>
            <div className="section-index" style={{ marginBottom: '6px' }}>
              ACTIVE CONTEXT
            </div>
            <div
              style={{
                background: '#131b1e',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <SourceIcon type={activeSource.type} />
                  <strong
                    style={{
                      fontSize: '12px',
                      color: 'var(--ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={activeSource.name}
                  >
                    {activeSource.name}
                  </strong>
                </div>
                <span className="library-status-chip" style={{ fontSize: '9px', padding: '1px 6px' }}>
                  <span className="pulse-dot" /> Live
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10.5px', color: 'var(--muted)' }}>
                <div>
                  <span style={{ color: 'var(--dim)', textTransform: 'uppercase', fontSize: '9px', display: 'block' }}>Type</span>
                  <strong style={{ color: 'var(--ink)' }}>{activeSource.type?.toUpperCase()}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--dim)', textTransform: 'uppercase', fontSize: '9px', display: 'block' }}>Pages</span>
                  <strong style={{ color: 'var(--ink)' }}>{activeSource.page_count || 1} pages</strong>
                </div>
              </div>

              {summaryData?.word_count > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--dim)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                  Extracted: <span style={{ color: 'var(--mint)' }}>{summaryData.word_count.toLocaleString()} words</span> • Embeddings indexed
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <div className="recent-heading" style={{ marginBottom: '8px' }}>
              <div>
                <div className="section-index">04 / MOMENTS</div>
                <h3>Passage Navigator</h3>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--dim)', fontStyle: 'italic', padding: '4px 0 10px' }}>
              Vector passages indexed across all pages.
            </div>
          </div>
        </>
      )}

      {/* Quick Launch Actions */}
      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          className="btn-trace-action"
          style={{ justifyContent: 'center', padding: '8px 12px' }}
          onClick={onOpenChatModal}
          title="Open Fullscreen Chat View"
        >
          <Icon name="spark" size={13} />
          <span>Open Dedicated Chat Modal</span>
        </button>
        {activeSource && (
          <button
            className="btn-trace-action"
            style={{ justifyContent: 'center', padding: '8px 12px' }}
            onClick={() => openAssetPreview && openAssetPreview(activeSource)}
            title="Inspect Full Transcript & Metadata"
          >
            <Icon name="file" size={13} />
            <span>Inspect Full Asset Details</span>
          </button>
        )}
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        className={`drop-zone ${dragOver ? 'active' : ''}`}
        style={{ marginTop: '14px' }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver && setDragOver(true);
        }}
        onDragLeave={() => setDragOver && setDragOver(false)}
        onDrop={handleDrop}
        onClick={onOpenUpload}
      >
        <Icon name="upload" size={18} />
        <strong>Drop another source</strong>
        <span>PDF / audio / video up to 100 MB</span>
      </div>
    </aside>
  );
}

export default SourceInspector;
