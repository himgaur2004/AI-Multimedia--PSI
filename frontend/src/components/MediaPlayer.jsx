import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function MediaPlayer({ document, seekTimestamp, onTimeUpdate }) {
  const mediaRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);

  const isVideo = document.file_type === 'video';
  const mediaUrl = api.getMediaStreamUrl(document.id);

  // Synchronize external timestamp seek triggers (e.g. from chatbot citation clicks)
  useEffect(() => {
    if (seekTimestamp !== null && seekTimestamp !== undefined && mediaRef.current) {
      mediaRef.current.currentTime = seekTimestamp;
      mediaRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [seekTimestamp]);

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
    } else {
      mediaRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      const cur = mediaRef.current.currentTime;
      setCurrentTime(cur);
      if (onTimeUpdate) onTimeUpdate(cur);
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration || document.duration_seconds || 0);
    }
  };

  const handleSeek = (e) => {
    const target = parseFloat(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleSpeedChange = (speed) => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = speed;
      setPlaybackRate(speed);
    }
  };

  return (
    <div className="player-wrapper">
      {/* Media Element */}
      {isVideo ? (
        <video
          ref={mediaRef}
          src={mediaUrl}
          className="video-element"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          controls={false}
          playsInline
        />
      ) : (
        <audio
          ref={mediaRef}
          src={mediaUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Modern Player Controls Bar */}
      <div
        style={{
          background: 'var(--bg-input)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Scrub Bar Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || document.duration_seconds || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            style={{
              flex: 1,
              accentColor: 'var(--primary)',
              cursor: 'pointer',
              height: '5px',
            }}
          />
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {formatTime(duration || document.duration_seconds)}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Play/Pause Button */}
            <button className="btn btn-primary btn-sm" onClick={togglePlay}>
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>

            {/* Skip 5s Back/Forward */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (mediaRef.current) mediaRef.current.currentTime = Math.max(0, currentTime - 5);
              }}
              title="Rewind 5 seconds"
            >
              ⏪ -5s
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (mediaRef.current) mediaRef.current.currentTime = Math.min(duration, currentTime + 5);
              }}
              title="Forward 5 seconds"
            >
              +5s ⏩
            </button>
          </div>

          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Speed:</span>
            {[1, 1.25, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                style={{
                  padding: '3px 7px',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: playbackRate === s ? 'var(--primary)' : 'transparent',
                  color: playbackRate === s ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
