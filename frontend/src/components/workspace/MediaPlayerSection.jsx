import React from 'react';
import { Icon, formatSeconds, parseSeconds } from '../common/Icons';

export function MediaPlayerSection({
  activeSource,
  activeMediaUrl,
  mediaRef,
  playing,
  togglePlay,
  onTogglePlay,
  currentTime,
  duration,
  handleSeek,
  onSeek,
  handleMediaTimeUpdate,
  onTimeUpdate,
  handleMediaLoaded,
  onLoadedMetadata,
  handleMediaEnded,
  onEnded,
  playbackSpeed,
  changePlaybackSpeed,
  onSpeedChange,
  isMuted,
  volume,
  toggleMute,
  onToggleMute,
  handleVolumeChange,
  onVolumeChange,
  togglePiP,
  onTogglePiP,
  toggleFullscreen,
  onToggleFullscreen,
  topics,
  jumpToTimestamp,
  onJumpToTimestamp,
  topicSearch,
  setTopicSearch,
}) {
  if (!activeSource || activeSource.type === 'pdf') {
    return null;
  }

  const doSeek = onSeek || handleSeek;
  const doTimeUpdate = onTimeUpdate || handleMediaTimeUpdate;
  const doLoadedMetadata = onLoadedMetadata || handleMediaLoaded;
  const doEnded = onEnded || handleMediaEnded;
  const doTogglePlay = onTogglePlay || togglePlay;
  const doSpeedChange = onSpeedChange || changePlaybackSpeed;
  const doVolumeChange = onVolumeChange || handleVolumeChange;
  const doToggleMute = onToggleMute || toggleMute;
  const doTogglePiP = onTogglePiP || togglePiP;
  const doToggleFullscreen = onToggleFullscreen || toggleFullscreen;
  const doJumpToTimestamp = onJumpToTimestamp || jumpToTimestamp;

  const filteredTopics = (topics || []).filter((t) =>
    (t.title || '').toLowerCase().includes((topicSearch || '').toLowerCase()) ||
    (t.summary || '').toLowerCase().includes((topicSearch || '').toLowerCase())
  );

  // Sanitizer to guarantee clean, professional topic titles without broken timestamps
  const cleanTopicDisplay = (text, defaultTitle) => {
    if (!text) return defaultTitle;
    let clean = text
      .replace(/^[\s(\d:+-\]]+\)?\s*(with|and|at|to|in|-|:)?\s*/i, '')
      .replace(/\s*\(\d{1,2}:\d{2}.*?\)/g, '')
      .replace(/^[):\-–\s]+/, '')
      .trim();
    if (!clean || clean.length < 2) return defaultTitle;
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  return (
    <div className="player-drawer" style={{ marginBottom: '20px' }}>
      <div className="player-video-container">
        {activeSource.type === 'video' && activeMediaUrl ? (
          <div className="video-viewport-wrap">
            <video
              ref={mediaRef}
              src={activeMediaUrl}
              onTimeUpdate={doTimeUpdate}
              onLoadedMetadata={doLoadedMetadata}
              onEnded={doEnded}
              playsInline
              className="active-video-screen"
              onClick={doTogglePlay}
            />
            <div className="video-floating-actions">
              <button
                className="video-action-icon-btn"
                onClick={doTogglePiP}
                title="Picture-in-Picture"
              >
                <Icon name="pip" size={13} />
              </button>
              <button
                className="video-action-icon-btn"
                onClick={doToggleFullscreen}
                title="Fullscreen"
              >
                <Icon name="maximize" size={13} />
              </button>
            </div>
          </div>
        ) : activeMediaUrl ? (
          <div className="audio-visualizer-card" onClick={doTogglePlay}>
            <div className="audio-anim-bars">
              <span className={playing ? 'bar bar-1 active' : 'bar bar-1'} />
              <span className={playing ? 'bar bar-2 active' : 'bar bar-2'} />
              <span className={playing ? 'bar bar-3 active' : 'bar bar-3'} />
              <span className={playing ? 'bar bar-4 active' : 'bar bar-4'} />
              <span className={playing ? 'bar bar-5 active' : 'bar bar-5'} />
            </div>
            <div className="audio-meta-text">
              <strong>{activeSource.name}</strong>
              <small>{playing ? 'Playing Audio Stream' : 'Paused • Click to Play'}</small>
            </div>
            <audio
              ref={mediaRef}
              src={activeMediaUrl}
              onTimeUpdate={doTimeUpdate}
              onLoadedMetadata={doLoadedMetadata}
              onEnded={doEnded}
            />
          </div>
        ) : null}
      </div>

      {/* Timeline Scrub Bar */}
      <div className="player-controls-row">
        <span className="time-readout">{formatSeconds(currentTime)}</span>
        <div className="scrub-container">
          <input
            type="range"
            className="scrub-bar"
            min="0"
            max={duration || activeSource.duration_seconds || 100}
            step="0.1"
            value={currentTime}
            onChange={(e) => doSeek && doSeek(e)}
          />
        </div>
        <span className="time-readout">
          {formatSeconds(duration || activeSource.duration_seconds || 0)}
        </span>
      </div>

      {/* Playback Controls Row: Skip, Play/Pause, Volume, Speed */}
      <div className="player-actions-row">
        <div className="player-actions-left">
          <button
            className="play-primary-toggle"
            onClick={doTogglePlay}
            title={playing ? 'Pause media' : 'Play media'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={14} />
            <span>{playing ? 'Pause' : 'Play'}</span>
          </button>
          <button
            className="btn-pill"
            onClick={() => {
              if (mediaRef.current) {
                const target = Math.max(0, currentTime - 10);
                mediaRef.current.currentTime = target;
              }
            }}
            title="Rewind 10s"
          >
            -10s
          </button>
          <button
            className="btn-pill"
            onClick={() => {
              if (mediaRef.current) {
                const target = Math.min(duration || 100, currentTime + 10);
                mediaRef.current.currentTime = target;
              }
            }}
            title="Forward 10s"
          >
            +10s
          </button>
        </div>

        {/* Volume & Speed */}
        <div className="player-actions-right">
          <button
            className="volume-toggle-btn"
            onClick={doToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <Icon name={isMuted || volume === 0 ? 'volumeMute' : 'volume'} size={14} />
          </button>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => doVolumeChange && doVolumeChange(e)}
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />

          <select
            className="speed-selector"
            value={playbackSpeed}
            onChange={(e) => doSpeedChange && doSpeedChange(parseFloat(e.target.value))}
            title="Playback Speed"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
          </select>
        </div>
      </div>

      {/* Synchronized Chapter Topic Pills Bar */}
      {topics && topics.length > 0 && (
        <div className="topics-section">
          <div className="topics-header">
            <span className="topics-title">
              <Icon name="spark" size={13} /> Key Topic Timestamps ({filteredTopics.length})
            </span>
            <input
              type="text"
              placeholder="Search topics..."
              value={topicSearch}
              onChange={(e) => setTopicSearch && setTopicSearch(e.target.value)}
              className="topics-search-input"
            />
          </div>
          <div className="topics-scroll-row">
            {filteredTopics.map((topic, index) => {
              const startSec = topic.start_time !== undefined ? topic.start_time : parseSeconds(topic.formatted_start);
              const nextStart = topics[index + 1] ? (topics[index + 1].start_time !== undefined ? topics[index + 1].start_time : parseSeconds(topics[index + 1].formatted_start)) : Infinity;
              const isActive = currentTime >= startSec && currentTime < nextStart;
              const displayTitle = cleanTopicDisplay(topic.title, `Topic Segment ${index + 1}`);
              const displaySummary = cleanTopicDisplay(topic.summary, '');

              return (
                <button
                  key={index}
                  className={`topic-play-card ${isActive ? 'active-topic' : ''}`}
                  onClick={() => doJumpToTimestamp && doJumpToTimestamp(startSec, displayTitle)}
                  title={`Jump to ${topic.formatted_start || '00:00'} — ${displayTitle}`}
                >
                  <div className="topic-play-left">
                    <div className="topic-play-btn-circle">▶</div>
                    <div className="topic-info">
                      <span className="topic-title">{displayTitle}</span>
                      {displaySummary && (
                        <span className="topic-summary-snippet">{displaySummary}</span>
                      )}
                    </div>
                  </div>
                  <span className="topic-time-badge">{topic.formatted_start || '00:00'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaPlayerSection;
