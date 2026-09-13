import { useState, useRef } from 'react';

export function useMediaPlayback(activeSource, setActiveView) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [jumpNotice, setJumpNotice] = useState(null);
  const mediaRef = useRef(null);

  const jumpToTimestamp = (seconds, label) => {
    if (setActiveView) setActiveView('signal');
    const s = Math.max(0, parseFloat(seconds) || 0);
    if (mediaRef.current) {
      mediaRef.current.currentTime = s;
      mediaRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
    const fmt = `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    setJumpNotice({ time: fmt, label: label || `Timestamp ${fmt}` });
    setTimeout(() => setJumpNotice(null), 3500);
  };

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (playing) {
      mediaRef.current.pause();
      setPlaying(false);
    } else {
      mediaRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleVolumeChange = (v) => {
    const vol = parseFloat(v);
    setVolume(vol);
    if (mediaRef.current) {
      mediaRef.current.volume = vol;
      if (vol > 0 && isMuted) {
        setIsMuted(false);
        mediaRef.current.muted = false;
      }
    }
  };

  const toggleMute = () => {
    if (mediaRef.current) {
      const next = !isMuted;
      mediaRef.current.muted = next;
      setIsMuted(next);
    }
  };

  const handleSpeedChange = (speed) => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const toggleFullscreen = () => {
    if (mediaRef.current?.requestFullscreen) mediaRef.current.requestFullscreen();
  };

  const togglePiP = async () => {
    try {
      if (mediaRef.current && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else await mediaRef.current.requestPictureInPicture();
      }
    } catch (_) {}
  };

  const onTimeUpdate = () => {
    if (mediaRef.current) setCurrentTime(mediaRef.current.currentTime);
  };

  const onLoadedMetadata = () => {
    if (mediaRef.current) setDuration(mediaRef.current.duration || activeSource?.duration_seconds || 0);
  };

  const onEnded = () => {
    setPlaying(false);
  };

  return {
    mediaRef,
    playing,
    setPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playbackSpeed,
    isMuted,
    volume,
    jumpNotice,
    jumpToTimestamp,
    togglePlay,
    handleSeek,
    handleVolumeChange,
    toggleMute,
    handleSpeedChange,
    toggleFullscreen,
    togglePiP,
    onTimeUpdate,
    onLoadedMetadata,
    onEnded,
  };
}
