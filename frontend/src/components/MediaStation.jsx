import React, { forwardRef, useEffect, useState, useRef } from 'react';
import { api } from '../services/api';

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const MediaStation = forwardRef(function MediaStation({ activeFile, seekTo }, ref) {
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState(false);
  const progressBarRef = useRef(null);

  const isVideo = activeFile?.type === 'video';
  const isAudio = activeFile?.type === 'audio';
  const isMedia = isVideo || isAudio;
  const streamUrl = isMedia && activeFile?.id ? api.getMediaStreamUrl(activeFile.id) : null;

  // Handle timestamp seeking from chat or chapter list
  useEffect(() => {
    if (seekTo != null && ref?.current) {
      const el = ref.current;
      const targetTime = Math.max(0, Number(seekTo));
      if (isNaN(targetTime)) return;

      const performSeek = () => {
        try {
          el.currentTime = targetTime;
          setCurrent(targetTime);
          el.play()
            .then(() => setPlaying(true))
            .catch((e) => console.warn('[Playback AutoPlay Blocked]', e));
        } catch (e) {
          console.warn('[Seek error]', e);
        }
      };

      if (el.readyState >= 1) {
        performSeek();
      } else {
        const handleLoaded = () => {
          performSeek();
          el.removeEventListener('loadedmetadata', handleLoaded);
        };
        el.addEventListener('loadedmetadata', handleLoaded);
      }
    }
  }, [seekTo, ref]);

  // Reset when active file changes
  useEffect(() => {
    setCurrent(0);
    setPlaying(false);
    setError(false);
  }, [activeFile?.id]);

  const togglePlay = () => {
    if (!ref?.current) return;
    if (playing) {
      ref.current.pause();
      setPlaying(false);
    } else {
      ref.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const handleSeek = (e) => {
    if (!progressBarRef.current || !duration || !ref?.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPercent = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = newPercent * duration;
    ref.current.currentTime = newTime;
    setCurrent(newTime);
  };

  const changeSpeed = (rate) => {
    setPlaybackRate(rate);
    if (ref?.current) {
      ref.current.playbackRate = rate;
    }
  };

  if (!isMedia) {
    return (
      <div className="border border-line rounded-[2px] p-4 text-center bg-panel">
        <div className="font-mono text-xs text-sub mb-1">DOCUMENT PREVIEW</div>
        <div className="text-sm font-semibold text-ink">{activeFile?.name || 'No document'}</div>
        <p className="text-xs text-sub mt-2 leading-relaxed">
          Full PDF text extracted and indexed into semantic vector space. Ask questions in the chat
          to retrieve exact citations.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-ink rounded-[2px] p-3 bg-paper shadow-xs">
      <div className="bg-ink aspect-video rounded-[2px] overflow-hidden relative flex items-center justify-center">
        {isVideo ? (
          <video
            ref={ref}
            src={streamUrl}
            className="w-full h-full object-cover"
            onError={() => setError(true)}
            onTimeUpdate={(e) => setCurrent(e.target.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.target.duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 w-full h-full text-paper">
            <audio
              ref={ref}
              src={streamUrl}
              onError={() => setError(true)}
              onTimeUpdate={(e) => setCurrent(e.target.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.target.duration)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
            <div className="flex items-center gap-1.5 h-12 mb-2">
              {[40, 70, 30, 90, 60, 80, 45, 95, 65, 50, 85, 30].map((h, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 rounded-full transition-all duration-200 ${
                    playing ? 'bg-accent animate-pulse' : 'bg-line/40'
                  }`}
                  style={{ height: `${playing ? h : 20}%` }}
                />
              ))}
            </div>
            <span className="font-mono text-[11px] text-paper/80 truncate max-w-[200px]">
              {activeFile?.name}
            </span>
          </div>
        )}

        {/* Center/Corner Play Overlay Button */}
        <button
          onClick={togglePlay}
          className="absolute bottom-2.5 left-2.5 w-8 h-8 rounded-full bg-paper text-ink flex items-center justify-center text-xs font-bold shadow-md hover:scale-105 transition-transform"
          aria-label={playing ? 'Pause media' : 'Play media'}
        >
          {playing ? '❚❚' : '▶'}
        </button>

        {/* Speed Selector */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-ink/80 text-paper px-1.5 py-0.5 rounded-[2px] font-mono text-[10px]">
          {[1, 1.25, 1.5, 2].map((r) => (
            <button
              key={r}
              onClick={() => changeSpeed(r)}
              className={`px-1 rounded-[1px] hover:text-accent transition-colors ${
                playbackRate === r ? 'text-accent font-bold' : 'text-paper/70'
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-2 text-[11px] font-mono text-accent bg-accent-soft p-1.5 text-center">
          Stream loading or codec formatting… Click play to re-buffer.
        </div>
      )}

      {/* Timecode readout */}
      <div className="flex justify-between text-[11px] font-mono text-sub mt-2">
        <span className="text-ink font-semibold">{formatTime(current)}</span>
        <span>{formatTime(duration || activeFile?.durationSeconds || 0)}</span>
      </div>

      {/* Scrubbable progress track */}
      <div
        ref={progressBarRef}
        onClick={handleSeek}
        className="h-2 bg-line rounded-full relative mt-1 cursor-pointer overflow-hidden group"
      >
        <div
          className="h-full bg-accent transition-all duration-75"
          style={{ width: duration ? `${(current / duration) * 100}%` : '0%' }}
        />
      </div>
    </div>
  );
});

export default MediaStation;
