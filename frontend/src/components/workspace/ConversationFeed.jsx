import React from 'react';
import { Icon, SourceIcon, parseSeconds } from '../common/Icons';

export function ConversationFeed({
  messages = [],
  setMessages,
  isStreaming,
  streamedText,
  activeSource,
  onOpenChatModal,
  ask,
  onSelectFollowUp,
  jumpToTimestamp,
  onJumpToTimestamp,
  renderMessageContent,
  chatEndRef,
}) {
  const doJump = onJumpToTimestamp || jumpToTimestamp;
  const doAsk = onSelectFollowUp || ask;

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

  return (
    <div className="conversation-section" style={{ marginTop: '24px' }}>
      {/* 02 / TRACE Section (Conversation Header) */}
      <div className="conversation-header">
        <div>
          <div className="section-index">02 / TRACE</div>
          <h2>Conversation</h2>
        </div>
        <div className="trace-header-actions">
          <button
            className="btn-trace-action expand-btn"
            onClick={onOpenChatModal}
            title="Open Dedicated Fullscreen Chat Modal"
          >
            <span>⛶ Open Chat Modal</span>
          </button>
          {messages.length > 0 && setMessages && (
            <button className="btn-trace-action" onClick={() => setMessages([])}>
              Clear room
            </button>
          )}
        </div>
      </div>

      <div className="conversation">
        {messages.length === 0 && !isStreaming && (
          <div className="empty-conversation">
            <Icon name="file" size={24} />
            <p>No queries recorded in this room session yet.</p>
            <small>Ask a question or select a topic above to initiate vector grounding.</small>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.from === 'ai' ? 'ai' : 'user'}`}
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
                  <span className="msg-pipeline-pill" title="Active AI Generation & Synthesis Engine">
                    <Icon name="spark" size={10} />
                    {message.engine?.includes('OpenAI') ? 'OpenAI GPT LLM' : 'Inbuilt RAG / Vector Search'}
                  </span>
                  <span className="msg-pipeline-pill method" title="Underlying Retrieval System">
                    🔍 {message.retrieval_method || 'Semantic Vector Search'}
                  </span>
                </div>
              )}

              {message.from === 'ai' && message.followUps && message.followUps.length > 0 && (
                <div className="follow-up-suggestions">
                  <div className="follow-up-label">
                    <Icon name="spark" size={11} /> Suggested Follow-ups
                  </div>
                  <div className="follow-up-chips">
                    {message.followUps.map((suggestion, sIdx) => (
                      <button
                        key={sIdx}
                        className="follow-up-chip"
                        onClick={() => doAsk && doAsk(suggestion)}
                        disabled={isStreaming}
                        title="Click to query this follow-up"
                      >
                        <span>{suggestion}</span>
                        <span className="chip-arrow">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="message ai streaming">
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
    </div>
  );
}

export default ConversationFeed;
