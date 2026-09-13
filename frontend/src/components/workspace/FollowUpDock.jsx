import React from 'react';
import { Icon } from '../common/Icons';

export function FollowUpDock({
  followUpQuery,
  setFollowUpQuery,
  ask,
  isStreaming,
  activeSource,
  searchMode,
  setSearchMode,
  gptModel,
}) {
  return (
    <div className="followup-dock">
      <div className="followup-dock-inner">
        <div className="dock-mode-pill" title="Active Search Mode for Follow-Up">
          <button
            type="button"
            className={`dock-mode-btn ${searchMode === 'inbuilt' ? 'active inbuilt' : ''}`}
            onClick={() => setSearchMode('inbuilt')}
            title="Mode 1: Inbuilt RAG / Vector Search (Offline, Local)"
          >
            ⚡ Inbuilt
          </button>
          <button
            type="button"
            className={`dock-mode-btn ${searchMode === 'gpt' ? 'active gpt' : ''}`}
            onClick={() => setSearchMode('gpt')}
            title={`Mode 2: GPT LLM (${gptModel})`}
          >
            🧠 GPT
          </button>
        </div>
        <input
          type="text"
          value={followUpQuery}
          onChange={(e) => setFollowUpQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (followUpQuery.trim() && !isStreaming) {
                ask(followUpQuery);
                setFollowUpQuery('');
              }
            }
          }}
          placeholder={
            activeSource
              ? `Ask follow-up about "${activeSource?.original_name || activeSource?.name}"...`
              : 'Select or upload a source to ask questions...'
          }
          disabled={isStreaming || !activeSource}
          aria-label="Ask follow-up question"
          className="followup-input"
        />
        <button
          className="followup-send-btn"
          onClick={() => {
            if (followUpQuery.trim() && !isStreaming) {
              ask(followUpQuery);
              setFollowUpQuery('');
            }
          }}
          disabled={!followUpQuery.trim() || isStreaming || !activeSource}
          aria-label="Send follow-up"
          title="Send follow-up question"
        >
          <Icon name="send" size={15} />
        </button>
      </div>
    </div>
  );
}

export default FollowUpDock;
