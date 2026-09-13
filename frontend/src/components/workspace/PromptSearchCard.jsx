import React from 'react';
import { Icon } from '../common/Icons';

export function PromptSearchCard({
  query,
  setQuery,
  ask,
  isStreaming,
  activeSource,
  sourcesCount = 0,
  searchMode = 'inbuilt',
  setSearchMode,
  gptModel = 'gpt-4o-mini',
  onOpenSettings,
  onOpenUpload,
  onDeleteSource,
  jumpNotice,
  setJumpNotice,
}) {
  return (
    <>
      {/* 01 / ASK Section Heading */}
      <div className="section-heading">
        <div>
          <div className="section-index">01 / ASK</div>
          <h2>Conversation, grounded.</h2>
          {activeSource && (
            <p className="current-source-label">
              Current source: <strong>{activeSource.name}</strong>
            </p>
          )}
        </div>
        {activeSource && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {onDeleteSource && (
              <button
                className="btn-trace-action"
                onClick={() => onDeleteSource(activeSource.id)}
                title="Delete source from room"
              >
                <Icon name="trash" size={13} /> Delete Source
              </button>
            )}
            {onOpenUpload && (
              <button
                className="btn-trace-action"
                onClick={onOpenUpload}
                title="Add another source"
              >
                <Icon name="plus" size={13} /> Add source
              </button>
            )}
          </div>
        )}
      </div>

      <div className="prompt-card">
        <div className="prompt-top">
          <div className="prompt-icon">
            <Icon name="spark" size={20} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="signal-readout">
              <span>CONTEXT WINDOW</span>
              <strong>
                {(sourcesCount || 0).toString().padStart(2, '0')} sources / 100% grounded
              </strong>
            </div>
            <div className="pipeline-indicator-pill" title="Toggle Search Architecture">
              <span className="pipeline-dot" />
              <button
                type="button"
                className={`mode-toggle-inline ${searchMode === 'inbuilt' ? 'active' : ''}`}
                onClick={() => setSearchMode && setSearchMode('inbuilt')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: searchMode === 'inbuilt' ? 'var(--mint)' : 'var(--dim)',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontWeight: 600,
                  padding: '0 4px',
                }}
              >
                ⚡ Inbuilt RAG
              </button>
              <span style={{ opacity: 0.3 }}>|</span>
              <button
                type="button"
                className={`mode-toggle-inline ${searchMode === 'gpt' ? 'active' : ''}`}
                onClick={() => setSearchMode && setSearchMode('gpt')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: searchMode === 'gpt' ? 'var(--amber)' : 'var(--dim)',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontWeight: 600,
                  padding: '0 4px',
                }}
              >
                🧠 GPT LLM ({gptModel})
              </button>
            </div>
          </div>
        </div>

        <div className="prompt-copy">
          <h3>What are you trying to understand?</h3>
          <p>Ask for a concept, a decision, or the exact moment something was stated.</p>
        </div>

        {/* Dynamic Suggested Question Pills */}
        {activeSource && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '12px 0 16px' }}>
            <button
              className="prompt-suggestion"
              onClick={() =>
                ask(
                  activeSource.type === 'pdf'
                    ? 'Summarize the main objectives, key takeaways, and conclusions of this source.'
                    : 'Summarize this video with timestamps for specific topics and key takeaways.'
                )
              }
            >
              <span>✦ Summarize</span> {activeSource.type === 'pdf' ? 'Executive overview' : 'Timestamps & Topics'} <span className="arrow">↗</span>
            </button>
            <button
              className="prompt-suggestion"
              onClick={() =>
                ask(
                  activeSource.type === 'pdf'
                    ? 'What are the core topics covered in this document?'
                    : 'Summarize this video with timestamps for specific topics'
                )
              }
            >
              <span>✦ Key topics</span> {activeSource.type === 'pdf' ? 'Concept breakdown' : 'Topic timestamps'} <span className="arrow">↗</span>
            </button>
          </div>
        )}

        <form
          className="question-box"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim() && !isStreaming) ask(query);
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeSource
                ? `Ask anything about "${activeSource.name}"...`
                : 'Select or upload a source to begin...'
            }
            disabled={isStreaming || !activeSource}
          />
          <button
            type="submit"
            disabled={!query.trim() || isStreaming || !activeSource}
            aria-label="Send query"
          >
            <Icon name="send" size={17} />
          </button>
        </form>
      </div>

      {/* Jump Notification Floating Toast */}
      {jumpNotice && (
        <div className="jump-notice-bar">
          <span className="jump-notice-badge">▶ PLAYING</span>
          <span className="jump-notice-text">
            Seeked to <strong>{jumpNotice.time}</strong> — {jumpNotice.label}
          </span>
          <button className="jump-notice-close" onClick={() => setJumpNotice && setJumpNotice(null)}>✕</button>
        </div>
      )}
    </>
  );
}

export default PromptSearchCard;
