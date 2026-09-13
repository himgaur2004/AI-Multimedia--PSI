import React, { useState } from 'react';
import { Icon, SourceIcon, parseSeconds } from '../common/Icons';

export function ChatModal({
  isOpen,
  showChatModal,
  onClose,
  setShowChatModal,
  activeSource,
  searchMode = 'inbuilt',
  setSearchMode,
  gptModel = 'gpt-4o-mini',
  messages = [],
  setMessages,
  isStreaming,
  streamedText,
  renderMessageContent,
  jumpToTimestamp,
  onJumpToTimestamp,
  ask,
  onSendQuery,
  followUpQuery: propFollowUpQuery,
  setFollowUpQuery: propSetFollowUpQuery,
  chatEndRef,
}) {
  const [internalQuery, setInternalQuery] = useState('');
  const visible = isOpen !== undefined ? isOpen : showChatModal;
  const handleClose = onClose || (() => setShowChatModal && setShowChatModal(false));

  if (!visible) return null;

  const currentQuery = propFollowUpQuery !== undefined ? propFollowUpQuery : internalQuery;
  const updateQuery = propSetFollowUpQuery || setInternalQuery;
  const submitQuery = onSendQuery || ask;
  const doJump = onJumpToTimestamp || jumpToTimestamp;

  const defaultRenderMessage = (message) => {
    const isMedia = activeSource && activeSource.type !== 'pdf';
    const text = message.text || '';
    const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    const lines = text.split('\n');

    return (
      <div className="message-content-wrapper">
        {lines.map((line, lIdx) => {
          if (!line.trim()) return <div key={lIdx} style={{ height: '8px' }} />;

          const bulletMatch = line.match(/^([•\-\*]|\d+\.)\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)/);
          if (bulletMatch && isMedia) {
            const ts = bulletMatch[2];
            const content = bulletMatch[3];
            const secs = parseSeconds(ts);
            return (
              <div key={lIdx} className="timestamp-bullet-row">
                <button
                  className="inline-play-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (doJump) doJump(secs, ts);
                  }}
                  title={`Play at ${ts}`}
                >
                  ▶ Play {ts}
                </button>
                <span className="bullet-content-text">{content}</span>
              </div>
            );
          }

          const elements = [];
          let lastIndex = 0;
          let match;
          const regex = new RegExp(timestampRegex);
          while ((match = regex.exec(line)) !== null) {
            if (match.index > lastIndex) {
              elements.push(line.substring(lastIndex, match.index));
            }
            const ts = match[1];
            const secs = parseSeconds(ts);
            if (isMedia) {
              elements.push(
                <button
                  key={`${lIdx}-${match.index}`}
                  className="inline-play-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (doJump) doJump(secs, ts);
                  }}
                  title={`Play at ${ts}`}
                >
                  ▶ Play {ts}
                </button>
              );
            } else {
              elements.push(<span key={`${lIdx}-${match.index}`} className="timestamp-badge">[{ts}]</span>);
            }
            lastIndex = match.index + match[0].length;
          }
          if (lastIndex < line.length) {
            elements.push(line.substring(lastIndex));
          }

          return (
            <p key={lIdx} style={{ margin: '0 0 6px', lineHeight: 1.55 }}>
              {elements.length > 0 ? elements : line}
            </p>
          );
        })}
      </div>
    );
  };

  const renderContent = renderMessageContent || defaultRenderMessage;

  const handleSend = () => {
    if (currentQuery.trim() && !isStreaming && submitQuery) {
      const q = currentQuery.trim();
      updateQuery('');
      submitQuery(q, searchMode);
    }
  };

  return (
    <div className="chat-modal-overlay" onClick={handleClose}>
      <div className="chat-modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <div className="chat-modal-title-wrap">
            <div className="ai-badge">
              <Icon name="spark" size={15} />
            </div>
            <div>
              <h3>Signal Room Reasoning Modal</h3>
              <p>
                {activeSource ? `Active: ${activeSource.name}` : 'Grounding & Multi-Turn Chat'} • {searchMode === 'inbuilt' ? '⚡ Inbuilt RAG' : `🧠 GPT LLM (${gptModel})`}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {setMessages && messages.length > 0 && (
              <button
                className="btn-trace-action"
                onClick={() => setMessages([])}
                title="Clear current room session messages"
              >
                Clear
              </button>
            )}
            <button
              className="chat-modal-close"
              onClick={handleClose}
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="chat-modal-body">
          {messages.length === 0 && !isStreaming && (
            <div className="empty-conversation" style={{ margin: 'auto' }}>
              <Icon name="spark" size={28} />
              <p>No queries recorded in this session yet.</p>
              <small>Type your question below to reason over the active source.</small>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.from === 'ai' ? 'assistant' : 'user'}`}
            >
              {message.from === 'ai' && (
                <div className="ai-badge">
                  <Icon name="spark" size={14} />
                </div>
              )}
              <div className="message-body">
                <div className="message-meta">
                  {message.from === 'ai' ? 'LUMEN / SYNTHESIS' : 'YOU'}{' '}
                  <span>{message.time || (message.from === 'ai' ? 'GROUNDED' : 'NOW')}</span>
                </div>
                {renderContent(message)}
                {message.citations && message.citations.length > 0 && (
                  <div className="citations">
                    {message.citations.map((citation, ci) => {
                      const hasTime = citation.timestamp !== null && citation.timestamp !== undefined;
                      const isAudio = hasTime || (citation.page && String(citation.page).includes(':'));
                      return (
                        <button
                          key={ci}
                          className={isAudio ? 'citation-play-btn' : 'citation-pill'}
                          onClick={() => {
                            if (hasTime && doJump) {
                              doJump(citation.timestamp, citation.label);
                            } else if (citation.page && String(citation.page).includes(':') && doJump) {
                              doJump(parseSeconds(citation.page), citation.label);
                            }
                          }}
                          title={isAudio ? `Play video from ${citation.label}` : 'Page citation'}
                        >
                          {isAudio ? (
                            <>
                              <span className="play-badge-icon">▶ Play</span>
                              <span className="play-badge-time">{citation.label}</span>
                            </>
                          ) : (
                            <>
                              <SourceIcon type="pdf" />
                              <span>{citation.label}</span>
                              <small>{citation.page}</small>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {message.from === 'ai' && (
                  <div className="message-pipeline-row">
                    <span className="msg-pipeline-pill" title="Active AI Engine">
                      <Icon name="spark" size={10} />
                      {message.engine?.includes('OpenAI') ? 'OpenAI GPT LLM' : 'Inbuilt RAG / Vector Search'}
                    </span>
                    <span className="msg-pipeline-pill method">
                      🔍 {message.retrieval_method || 'Semantic Vector Search'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="message assistant streaming">
              <div className="ai-badge">
                <Icon name="spark" size={14} />
              </div>
              <div className="message-body">
                <div className="message-meta">
                  LUMEN / SYNTHESIS <span className="pulse-tag">REASONING & STREAMING...</span>
                </div>
                <p style={{ whiteSpace: 'pre-line' }}>
                  {streamedText}
                  <span className="streaming-cursor" />
                </p>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-modal-dock">
          <div className="followup-dock-inner">
            <div className="dock-mode-pill" title="Active Search Mode">
              <button
                type="button"
                className={`dock-mode-btn ${searchMode === 'inbuilt' ? 'active inbuilt' : ''}`}
                onClick={() => setSearchMode && setSearchMode('inbuilt')}
              >
                ⚡ Inbuilt
              </button>
              <button
                type="button"
                className={`dock-mode-btn ${searchMode === 'gpt' ? 'active gpt' : ''}`}
                onClick={() => setSearchMode && setSearchMode('gpt')}
              >
                🧠 GPT
              </button>
            </div>
            <input
              type="text"
              value={currentQuery}
              onChange={(e) => updateQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Ask follow-up in modal...`}
              disabled={isStreaming || !activeSource}
              className="followup-input"
              autoFocus
            />
            <button
              className="followup-send-btn"
              onClick={handleSend}
              disabled={!currentQuery.trim() || isStreaming || !activeSource}
            >
              <Icon name="send" size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatModal;
