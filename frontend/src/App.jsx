import React, { useEffect, useRef, useState } from 'react';
import { api } from './services/api';

// Vector Icons from the Lumen Design Template
function Icon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.4 1.4-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L9 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H7v-2h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L8.4 9.1 9.8 7.7l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.4 1.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2h-.2a1.7 1.7 0 0 0-1.6 1Z" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    play: <path d="m9 6 10 6-10 6Z" fill="currentColor" stroke="none" />,
    pause: <><rect x="6" y="4" width="4" height="16" fill="currentColor" /><rect x="14" y="4" width="4" height="16" fill="currentColor" /></>,
    spark: <><path d="m12 3-1.2 4.8L6 9l4.8 1.2L12 15l1.2-4.8L18 9l-4.8-1.2Z" /><path d="m19 15-.6 2.4L16 18l2.4.6L19 21l.6-2.4L22 18l-2.4-.6Z" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
    key: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m21 3-9.5 9.5M15.5 7.5l3 3M18 5l2 2" /></>,
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.file}
    </svg>
  );
}

function SourceIcon({ type }) {
  const norm = (type || 'pdf').toLowerCase();
  return (
    <span className={`source-icon ${norm}`}>
      <Icon name={norm === 'pdf' ? 'file' : norm === 'video' ? 'play' : 'file'} size={15} />
    </span>
  );
}

function parseSeconds(timestampStr) {
  if (!timestampStr) return 0;
  const clean = String(timestampStr).replace(/[\[\]]/g, '').trim();
  const parts = clean.split(':');
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  } else if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return 0;
}

function formatSeconds(secs) {
  if (!secs || isNaN(secs)) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function App() {
  const [sources, setSources] = useState([]);
  const [activeSource, setActiveSource] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [uploadedToast, setUploadedToast] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [activeView, setActiveView] = useState('signal'); // 'signal', 'summary', 'settings'
  const [summaryData, setSummaryData] = useState(null);
  const [topics, setTopics] = useState([]);
  const [user, setUser] = useState(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('omnimind_openai_key') || '');
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRef = useRef(null);
  const chatEndRef = useRef(null);

  // Initialize Auth and Source List
  useEffect(() => {
    const init = async () => {
      try {
        let u;
        try {
          u = await api.getMe();
        } catch (_) {
          const guest = await api.createGuestSession();
          u = guest.user;
        }
        setUser(u);
        await refreshSources();
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    init();
  }, []);

  // Sync media time
  const handleMediaTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
    }
  };

  const handleMediaLoaded = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration || activeSource?.duration_seconds || 0);
    }
  };

  const handleMediaEnded = () => {
    setPlaying(false);
  };

  const refreshSources = async () => {
    try {
      const resp = await api.listDocuments();
      if (resp && resp.documents && resp.documents.length > 0) {
        const formatted = resp.documents.map((d, idx) => ({
          id: d.id,
          type: d.file_type,
          name: d.original_name,
          meta: `${d.file_type.toUpperCase()} / ${(d.file_size / (1024 * 1024)).toFixed(1)} MB`,
          accent: d.file_type === 'pdf' ? 'amber' : d.file_type === 'video' ? 'cyan' : 'violet',
          active: idx === 0,
          duration_seconds: d.duration_seconds,
        }));
        setSources(formatted);
        selectSource(formatted[0].id);
      } else {
        // Default initial demonstration sources
        const fallback = [
          { id: 'demo-1', type: 'pdf', name: 'The Future of Remote Work.pdf', meta: 'PDF / 18 pages / 2.4 MB', accent: 'amber', active: true },
          { id: 'demo-2', type: 'audio', name: 'Team All-Hands — May 2024', meta: 'AUDIO / 48 MIN', accent: 'violet', active: false },
          { id: 'demo-3', type: 'video', name: 'Founder interview — Alex Chen', meta: 'VIDEO / 32 MIN', accent: 'cyan', active: false },
        ];
        setSources(fallback);
        setActiveSource(fallback[0]);
        setMessages([
          {
            from: 'user',
            text: 'What are the key arguments for asynchronous work?',
          },
          {
            from: 'ai',
            text: 'Three signals repeat across your sources. Async work protects attention, preserves context, and makes collaboration more inclusive across time zones.',
            bullets: [
              'Deep work survives when meetings become intentional.',
              'Written decisions create a searchable memory for the team.',
              'Visible context makes different working styles easier to include.',
            ],
            citations: [
              { label: 'Future of Remote Work', page: 'p. 06', timestamp: null },
              { label: 'Team All-Hands', page: '12:48', timestamp: 768 },
            ],
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
  };

  const selectSource = async (id) => {
    setSources((prev) => prev.map((s) => ({ ...s, active: s.id === id })));
    try {
      const doc = await api.getDocument(id);
      setActiveSource(doc);
      setSummaryData({
        executive_summary: doc.summary || 'Summary indexed and ready.',
        key_points: [
          'High-precision vector retrieval mapped.',
          'Speech-to-text transcript segments aligned with timestamps.',
          'Grounded for interactive conversational reasoning.',
        ],
        word_count: (doc.full_text || '').split(/\s+/).length,
      });
      setTopics(doc.topics || []);
      
      // Fetch chat history for this document
      const history = await api.getChatHistory(id);
      if (history && history.length > 0) {
        setMessages(
          history.map((h) => ({
            from: h.role === 'user' ? 'user' : 'ai',
            text: h.content,
            bullets: null,
            citations: (h.citations || []).map((c) => ({
              label: c.source === 'pdf' ? `Page ${c.page || 1}` : c.formatted_timestamp || '00:00',
              page: c.source === 'pdf' ? `p. ${c.page || 1}` : c.formatted_timestamp || '00:00',
              timestamp: c.start_time,
            })),
          }))
        );
      }
    } catch (err) {
      console.warn('Using local demo source state:', id);
    }
  };

  // Upload handler for file picker & drag and drop
  const handleUpload = async (file) => {
    if (!file) return;
    try {
      const resp = await api.uploadFile(file);
      setUploadedToast(true);
      setTimeout(() => setUploadedToast(false), 4000);
      await refreshSources();
      if (resp && resp.id) {
        selectSource(resp.id);
      }
    } catch (err) {
      alert(`Upload error: ${err.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  // Chat Ask function with real-time token streaming
  const ask = async (customPrompt) => {
    const promptText = customPrompt || query.trim();
    if (!promptText || isStreaming) return;

    setQuery('');
    setMessages((prev) => [...prev, { from: 'user', text: promptText }]);
    setIsStreaming(true);
    setStreamedText('');

    let accumulated = '';
    const activeDocId = activeSource?.id && !activeSource.id.startsWith('demo-') ? activeSource.id : sources[0]?.id;

    if (activeDocId && !activeDocId.startsWith('demo-')) {
      await api.streamChat(
        activeDocId,
        promptText,
        (chunk) => {
          accumulated += chunk;
          setStreamedText(accumulated);
        },
        (citations) => {
          setIsStreaming(false);
          setStreamedText('');
          
          // Parse potential bullet points from text
          const lines = accumulated.split('\n').map((l) => l.trim());
          const bullets = lines
            .filter((l) => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'))
            .map((l) => l.replace(/^[-•*]\s*/, ''));
          const cleanText = lines.filter((l) => !l.startsWith('•') && !l.startsWith('-') && !l.startsWith('*')).join(' ');

          setMessages((prev) => [
            ...prev,
            {
              from: 'ai',
              text: cleanText || accumulated,
              bullets: bullets.length > 0 ? bullets : null,
              citations: citations.map((c) => ({
                label: c.source === 'pdf' ? `Page ${c.page || 1}` : c.formatted_timestamp || '00:00',
                page: c.source === 'pdf' ? `p. ${c.page || 1}` : c.formatted_timestamp || '00:00',
                timestamp: c.start_time,
              })),
            },
          ]);
        },
        (err) => {
          setIsStreaming(false);
          setStreamedText('');
          setMessages((prev) => [
            ...prev,
            {
              from: 'ai',
              text: `The signal was interrupted: ${err.message}`,
              bullets: null,
              citations: null,
            },
          ]);
        }
      );
    } else {
      // Fallback local simulated reasoning for initial demo sources
      setTimeout(() => {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            from: 'ai',
            text: 'The strongest signal is that clarity improves when context arrives before the conversation. Your sources point to a lighter, more deliberate operating rhythm.',
            bullets: [
              'Write decisions where future teammates can find them.',
              'Use meetings for ambiguity, not information transfer.',
              'Make availability and time zones visible.',
            ],
            citations: [
              { label: 'Remote Work', page: 'p. 11', timestamp: null },
              { label: 'Team All-Hands', page: '12:48', timestamp: 768 },
            ],
          },
        ]);
      }, 600);
    }
  };

  // Seek and play media to specific timestamp when citation or moment is clicked
  const jumpToTimestamp = (seconds, label) => {
    setPlaying(true);
    if (mediaRef.current) {
      mediaRef.current.currentTime = seconds;
      mediaRef.current.play().catch(() => {});
    }
  };

  const togglePlay = () => {
    if (!mediaRef.current) {
      setPlaying(!playing);
      return;
    }
    if (playing) {
      mediaRef.current.pause();
      setPlaying(false);
    } else {
      mediaRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const handleSpeedChange = (speed) => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const saveApiKey = () => {
    api.setApiKeyOverride(apiKeyInput.trim());
    setShowKeyModal(false);
  };

  const visibleSources = sources.filter(
    (s) => filter === 'All' || s.type === filter.toLowerCase()
  );

  const activeMediaUrl = activeSource && !activeSource.id.startsWith('demo-')
    ? api.getMediaStreamUrl(activeSource.id)
    : null;

  return (
    <main className="signal-shell">
      {/* ─── SIDEBAR NAVIGATION ─── */}
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

        <button className="new-space" onClick={() => refreshSources()}>
          <Icon name="plus" size={17} /> New room <kbd>⌘ K</kbd>
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
            onClick={() => setShowKeyModal(true)}
          >
            <Icon name="settings" /> <span>Preferences</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="pulse-key">
            <span className="pulse-dot" />
            <div>
              <strong>System ready</strong>
              <small>All sources indexed</small>
            </div>
          </div>
          <div className="profile" onClick={() => setShowKeyModal(true)}>
            <div className="avatar">
              {user?.username ? user.username.substring(0, 2).toUpperCase() : 'JD'}
            </div>
            <div>
              <strong>{user?.username ? user.username : 'Jordan Davis'}</strong>
              <small>{user?.is_guest ? 'Guest room' : 'Private room'}</small>
            </div>
            <span className="dots">•••</span>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <section className="content-area" id="workspace">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <p className="eyebrow">
              THURSDAY / 09:41 <span className="status-dot" /> LIVE CONTEXT
            </p>
            <h1>Make sense of the signal.</h1>
            <p className="subhead">
              A private room for turning scattered media into clear decisions.
            </p>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="API Key Settings"
              title="Configure API Key"
              onClick={() => setShowKeyModal(true)}
            >
              <Icon name="key" size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Search"
              onClick={() => document.querySelector('.question-box input')?.focus()}
            >
              <Icon name="search" />
            </button>
            <button
              className="help-button"
              title="System Documentation"
              onClick={() => alert('OmniMind Lumen: Grounded RAG with Whisper ASR timestamps and instant playback seeking.')}
            >
              ?
            </button>
            <button className="avatar small" onClick={() => setShowKeyModal(true)}>
              {user?.username ? user.username.substring(0, 2).toUpperCase() : 'JD'}
            </button>
          </div>
        </header>

        {/* 2-Column Grid Workspace */}
        <div className="workspace-grid">
          {/* Left Column: Ask & Conversation Trace */}
          <section className="main-column">
            {/* 01 / ASK Section */}
            <div className="section-heading">
              <div>
                <div className="section-index">01 / ASK</div>
                <h2>Conversation, grounded.</h2>
                <p>Every answer is connected to a source, a page, or a moment.</p>
              </div>
              <button
                className="upload-button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size={16} /> Add source
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".pdf,audio/*,video/*,.mp3,.wav,.m4a,.mp4,.webm"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleUpload(e.target.files[0]);
                }}
              />
            </div>

            {uploadedToast && (
              <div className="upload-toast">
                <span className="pulse-dot" /> Source ingested & indexed. It is ready to explore.
              </div>
            )}

            {/* Prompt Card */}
            <div className="prompt-card">
              <div className="prompt-top">
                <div className="prompt-icon">
                  <Icon name="spark" size={20} />
                </div>
                <div className="signal-readout">
                  <span>CONTEXT WINDOW</span>
                  <strong>{sources.length.toString().padStart(2, '0')} sources / 100% ready</strong>
                </div>
              </div>
              <div className="prompt-copy">
                <h3>What are you trying to understand?</h3>
                <p>Ask for a theme, a decision, or the exact moment something was said.</p>
              </div>
              <button
                className="prompt-suggestion"
                onClick={() => ask('Find the moments where the team discusses focus')}
              >
                <span>Suggested path</span> Find moments about focus <span className="arrow">↗</span>
              </button>
              <div className="question-box">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      ask();
                    }
                  }}
                  placeholder="Ask the room anything..."
                  aria-label="Ask the room anything"
                  disabled={isStreaming}
                />
                <button
                  onClick={() => ask()}
                  aria-label="Send question"
                  disabled={!query.trim() || isStreaming}
                >
                  <Icon name="send" size={17} />
                </button>
              </div>
            </div>

            {/* 02 / TRACE Section (Conversation) */}
            <div className="conversation-header">
              <div>
                <div className="section-index">02 / TRACE</div>
                <h2>Conversation</h2>
              </div>
              <button onClick={() => setMessages([])}>Clear room</button>
            </div>

            <div className="conversation">
              {messages.length === 0 && !isStreaming ? (
                <div className="empty-conversation">
                  The room is quiet. Ask a question above or pick a suggested path to begin.
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    className={`message ${message.from}`}
                    key={`${message.from}-${index}`}
                  >
                    {message.from === 'ai' && (
                      <div className="ai-badge">
                        <Icon name="spark" size={14} />
                      </div>
                    )}
                    <div className="message-body">
                      <div className="message-meta">
                        {message.from === 'ai' ? 'LUMEN / SYNTHESIS' : 'YOU'}{' '}
                        <span>{message.from === 'ai' ? 'GROUNDED' : 'NOW'}</span>
                      </div>
                      <p>{message.text}</p>
                      {message.bullets && (
                        <ul>
                          {message.bullets.map((bullet, bi) => (
                            <li key={bi}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                      {message.citations && message.citations.length > 0 && (
                        <div className="citations">
                          {message.citations.map((citation, ci) => {
                            const isAudio = citation.page.includes(':') || citation.timestamp !== null;
                            return (
                              <button
                                key={ci}
                                onClick={() => {
                                  if (citation.timestamp !== null && citation.timestamp !== undefined) {
                                    jumpToTimestamp(citation.timestamp, citation.label);
                                  } else if (citation.page.includes(':')) {
                                    jumpToTimestamp(parseSeconds(citation.page), citation.label);
                                  }
                                }}
                                title="Click to play relevant moment"
                              >
                                <SourceIcon type={isAudio ? 'audio' : 'pdf'} />
                                <span>{citation.label}</span>
                                <small>{citation.page}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Streaming Assistant Response */}
              {isStreaming && (
                <div className="message ai">
                  <div className="ai-badge">
                    <Icon name="spark" size={14} />
                  </div>
                  <div className="message-body">
                    <div className="message-meta">
                      LUMEN / SYNTHESIS <span>STREAMING</span>
                    </div>
                    <p>
                      {streamedText}
                      <span className="streaming-cursor" />
                    </p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Executive Summary Drawer */}
            {summaryData && (
              <div className="summary-drawer">
                <div className="section-index">EXECUTIVE BRIEF</div>
                <h4>Synthesized Overview</h4>
                <p>{summaryData.executive_summary}</p>
                {summaryData.key_points && (
                  <ul>
                    {summaryData.key_points.map((kp, kpi) => (
                      <li key={kpi}>{kp}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* Right Column: Source Constellation, Orbits & Moments */}
          <aside className="inspector">
            {/* 03 / EVIDENCE Section */}
            <div className="inspector-head">
              <div>
                <div className="section-index">03 / EVIDENCE</div>
                <h2>Source constellation</h2>
              </div>
              <button
                className="add-circle"
                aria-label="Add source"
                onClick={() => fileInputRef.current?.click()}
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

            {/* Filter Tabs */}
            <div className="filter-tabs">
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

            {/* Source List */}
            <div className="source-list">
              {visibleSources.map((source) => (
                <button
                  className={`source-card ${source.active ? 'selected' : ''}`}
                  key={source.id}
                  onClick={() => selectSource(source.id)}
                >
                  <SourceIcon type={source.type} />
                  <span className="source-details">
                    <strong>{source.name}</strong>
                    <small>{source.meta}</small>
                  </span>
                  <span className="source-more">•••</span>
                </button>
              ))}
            </div>

            {/* Drag & Drop Zone */}
            <div
              className={`drop-zone ${dragOver ? 'active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="upload" size={20} />
              <strong>Drop another source</strong>
              <span>PDF / audio / video up to 100 MB</span>
            </div>

            <div className="inspector-divider" />

            {/* 04 / MOMENT Section & Synchronized Media Player */}
            <div className="recent-heading">
              <div>
                <div className="section-index">04 / MOMENT</div>
                <h3>Recent evidence</h3>
              </div>
              <button onClick={() => togglePlay()}>
                {playing ? 'Pause' : 'Play all'}
              </button>
            </div>

            {/* Moment Card */}
            <button
              className="moment-card"
              onClick={() => togglePlay()}
            >
              <div className="moment-thumbnail">
                <span className="waveform">▁▂▅▃▆▇▅▃▂▅▇</span>
                <span className="play-pill">{playing ? 'Ⅱ' : '▶'}</span>
              </div>
              <span>
                <strong>
                  {activeSource?.name ? `“${activeSource.name}”` : '“The async advantage”'}
                </strong>
                <small>
                  {activeSource?.type?.toUpperCase() || 'MEDIA'} / {formatSeconds(currentTime)}
                </small>
              </span>
              <span className="moment-arrow">↗</span>
            </button>

            {/* Integrated Media Player Controls */}
            {activeSource && activeSource.type !== 'pdf' && (
              <div className="player-drawer">
                {activeSource.type === 'video' && activeMediaUrl ? (
                  <video
                    ref={mediaRef}
                    src={activeMediaUrl}
                    onTimeUpdate={handleMediaTimeUpdate}
                    onLoadedMetadata={handleMediaLoaded}
                    onEnded={handleMediaEnded}
                    playsInline
                  />
                ) : activeMediaUrl ? (
                  <audio
                    ref={mediaRef}
                    src={activeMediaUrl}
                    onTimeUpdate={handleMediaTimeUpdate}
                    onLoadedMetadata={handleMediaLoaded}
                    onEnded={handleMediaEnded}
                  />
                ) : null}

                {/* Timeline Scrub Bar */}
                <div className="player-controls-row">
                  <span className="time-readout">{formatSeconds(currentTime)}</span>
                  <input
                    type="range"
                    className="scrub-bar"
                    min="0"
                    max={duration || activeSource.duration_seconds || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                  />
                  <span className="time-readout">
                    {formatSeconds(duration || activeSource.duration_seconds || 0)}
                  </span>
                </div>

                {/* Speed Controls & Rewind */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn-pill"
                      onClick={() => {
                        if (mediaRef.current) mediaRef.current.currentTime = Math.max(0, currentTime - 5);
                      }}
                    >
                      -5s
                    </button>
                    <button
                      className="btn-pill"
                      onClick={() => {
                        if (mediaRef.current) mediaRef.current.currentTime = Math.min(duration, currentTime + 5);
                      }}
                    >
                      +5s
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 1.25, 1.5, 2].map((sp) => (
                      <button
                        key={sp}
                        className="btn-pill"
                        style={{
                          background: playbackSpeed === sp ? 'var(--mint)' : '#243534',
                          color: playbackSpeed === sp ? '#111719' : 'var(--mint)',
                        }}
                        onClick={() => handleSpeedChange(sp)}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extracted Topic Chapters */}
                {topics && topics.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--dim)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      Key Chapters
                    </span>
                    <div style={{ display: 'grid', gap: '4px', marginTop: '6px' }}>
                      {topics.slice(0, 4).map((top) => (
                        <button
                          key={top.id}
                          className="citation-pill"
                          style={{ width: '100%', justifyContent: 'space-between' }}
                          onClick={() => jumpToTimestamp(top.start_time, top.title)}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {top.title}
                          </span>
                          <small>{top.formatted_start}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>

        {/* Footer */}
        <footer className="privacy-note">
          <span className="lock">◌</span> Your room is private by design.{' '}
          <a href="#grounding" onClick={(e) => { e.preventDefault(); alert('Grounding uses cosine vector search and Whisper timestamps to link every claim directly to media segments.'); }}>
            How grounding works
          </a>
          <span className="footer-status">
            <span className="pulse-dot" /> encrypted session
          </span>
        </footer>
      </section>

      {/* ─── API KEY & PREFERENCES MODAL ─── */}
      {showKeyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowKeyModal(false)}
        >
          <div
            className="prompt-card"
            style={{ width: '100%', maxWidth: '440px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, font: '400 18px Georgia, serif', color: 'var(--ink)' }}>
                Room Preferences
              </h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: '18px' }}
                onClick={() => setShowKeyModal(false)}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
              OmniMind operates with a built-in deterministic transcription & embeddings engine. To enable live OpenAI Whisper and GPT-4o-mini reasoning, supply your API key below:
            </p>
            <div className="question-box" style={{ marginBottom: '16px' }}>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-proj-..."
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="upload-button"
                style={{ color: 'var(--muted)', borderColor: 'var(--line)' }}
                onClick={() => {
                  api.setApiKeyOverride('');
                  setApiKeyInput('');
                  setShowKeyModal(false);
                }}
              >
                Clear Key
              </button>
              <button className="upload-button" onClick={saveApiKey}>
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
