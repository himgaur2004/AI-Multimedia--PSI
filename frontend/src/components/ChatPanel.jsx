import React, { useState, useRef, useEffect } from 'react';

// Parses MM:SS or HH:MM:SS time string to seconds
function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

// Renders message text with clickable [MM:SS] timestamp chips
function RenderFormattedMessage({ text, onJumpTo }) {
  if (!text) return null;
  const timestampRegex = /(\[(\d{1,2}:\d{2}(?::\d{2})?)\])/g;
  const parts = text.split(timestampRegex);

  return (
    <div className="prose-chat whitespace-pre-wrap leading-relaxed text-[13.5px]">
      {parts.map((part, index) => {
        const match = part.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]$/);
        if (match) {
          const timeStr = match[1];
          const seconds = parseTimeToSeconds(timeStr);
          return (
            <button
              key={index}
              onClick={() => onJumpTo(seconds)}
              className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-[3px] bg-accent-soft text-accent border border-accent/30 font-mono text-[11px] font-semibold hover:bg-accent hover:text-paper transition-colors cursor-pointer"
              title={`Jump media player to ${timeStr}`}
            >
              <span>▶</span> {timeStr}
            </button>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}

export default function ChatPanel({
  activeFile,
  messages = [],
  isStreaming,
  streamedText,
  onSendMessage,
  onJumpTo,
}) {
  const [draft, setDraft] = useState('');
  const [searchMode, setSearchMode] = useState('rag'); // 'rag' | 'llm'
  const scrollRef = useRef(null);

  // Auto scroll on message update or streaming token
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamedText, isStreaming]);

  function handleSend() {
    if (!draft.trim() || isStreaming) return;
    onSendMessage(draft.trim(), searchMode);
    setDraft('');
  }

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full bg-paper overflow-hidden">
      {/* Header bar pinned at top */}
      <div className="shrink-0 px-6 py-3 border-b border-line flex items-center justify-between bg-paper/90 backdrop-blur-xs z-10">
        <div className="font-mono text-[11px] text-sub lowercase flex items-center gap-2">
          <span>02 — ask psi</span>
          <span className="text-line">|</span>
          <span className="text-[10.5px]">
            {searchMode === 'rag' ? 'Local RAG Mode' : 'GPT LLM Mode'}
          </span>
        </div>
        {activeFile ? (
          <span className="text-[11px] font-mono text-ink bg-panel border border-line rounded-full px-2.5 py-0.5 max-w-[220px] truncate shadow-xs">
            {activeFile.name}
          </span>
        ) : (
          <span className="text-[11px] font-mono text-sub">select a file to chat</span>
        )}
      </div>

      {/* Messages Thread (Scrolls independently above input) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="py-16 text-center max-w-md mx-auto">
              <div className="w-11 h-11 mx-auto rounded-full bg-panel border border-line flex items-center justify-center font-mono text-base text-sub mb-3 shadow-xs">
                Ψ
              </div>
              <h3 className="font-display font-medium text-lg text-ink mb-1">
                Ask Your Files with Grounded Accuracy
              </h3>
              <p className="text-xs text-sub leading-relaxed mb-4">
                Query PDF documents, video lectures, or podcasts. Answers cite exact timecodes and
                pages with zero hallucinations.
              </p>
              {activeFile && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-panel border border-line rounded-full text-xs text-sub font-mono">
                  <span>Active context:</span>
                  <span className="text-ink font-semibold">{activeFile.name}</span>
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start w-full'}`}>
                <div className="font-mono text-[10.5px] text-sub mb-1 px-1 flex items-center gap-1.5">
                  <span>{isUser ? 'You' : 'PSI'}</span>
                  {!isUser && msg.engine && <span className="opacity-50">· {msg.engine}</span>}
                </div>

                {/* Message Bubble: Soft warm sand for user (NO BLACK), crisp panel for AI aligned with chat box */}
                <div
                  className={`p-3.5 text-[13.5px] leading-relaxed transition-all ${
                    isUser
                      ? 'bg-[#ebe5d8] text-ink border border-[#ddd5c5] rounded-2xl rounded-tr-xs shadow-xs max-w-[85%]'
                      : msg.error
                      ? 'bg-red-50 text-red-900 border border-red-200 rounded-2xl rounded-tl-xs w-full'
                      : 'bg-panel text-ink border border-line rounded-2xl rounded-tl-xs shadow-xs w-full'
                  }`}
                >
                  <RenderFormattedMessage text={msg.text} onJumpTo={onJumpTo} />

                  {/* Citations list */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-line/60 text-[11px] font-mono text-sub">
                      <span className="block font-semibold mb-1 text-ink/70">Verified Citations:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-[2px] bg-paper border border-line text-[10px]"
                          >
                            {c.timestamp
                              ? `Time: ${c.timestamp}`
                              : c.page
                              ? `Page ${c.page}`
                              : c.text
                              ? c.text.slice(0, 30)
                              : 'Citation'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Follow-up suggestion pills */}
                  {msg.follow_ups && msg.follow_ups.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-line/40 flex flex-wrap gap-1.5">
                      {msg.follow_ups.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => onSendMessage(chip, searchMode)}
                          className="text-[11px] text-accent border border-accent/30 bg-accent-soft/40 px-2.5 py-1 rounded-[3px] hover:bg-accent hover:text-paper transition-colors cursor-pointer"
                        >
                          {chip} →
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Live Token Streaming Bubble */}
          {isStreaming && (
            <div className="flex flex-col items-start w-full">
              <span className="font-mono text-[10.5px] text-sub mb-1 px-1">psi · streaming</span>
              <div className="p-3.5 rounded-2xl rounded-tl-xs bg-panel border border-line shadow-xs text-ink w-full text-[13.5px]">
                <RenderFormattedMessage text={streamedText} onJumpTo={onJumpTo} />
                <span className="inline-block w-1.5 h-3.5 bg-accent ml-1 animate-pulse align-middle" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ChatGPT-Style Pinned Bottom Input Dock */}
      <div className="shrink-0 p-4 bg-paper/95 border-t border-line">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-ink/20 bg-panel shadow-sm hover:border-ink/40 focus-within:border-ink focus-within:shadow-md transition-all p-2.5">
            {/* Text input */}
            <input
              value={draft}
              disabled={!activeFile || isStreaming}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                activeFile
                  ? `Ask PSI anything about "${activeFile.name}"…`
                  : 'Please upload or select a file to ask questions…'
              }
              className="w-full bg-transparent outline-none text-xs md:text-[13.5px] placeholder:text-sub text-ink px-2 py-1 disabled:opacity-50"
            />

            {/* Bottom bar inside card: Mode Selector (Left) & Send Arrow Button (Right) */}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-line/40 px-1">
              <div className="flex border border-line rounded-full overflow-hidden text-[10.5px] font-mono">
                <button
                  type="button"
                  onClick={() => setSearchMode('rag')}
                  className={`px-2.5 py-0.8 transition-colors ${
                    searchMode === 'rag'
                      ? 'bg-ink text-paper font-semibold'
                      : 'bg-paper text-sub hover:text-ink'
                  }`}
                >
                  Local RAG
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode('llm')}
                  className={`px-2.5 py-0.8 transition-colors border-l border-line ${
                    searchMode === 'llm'
                      ? 'bg-ink text-paper font-semibold'
                      : 'bg-paper text-sub hover:text-ink'
                  }`}
                >
                  GPT LLM
                </button>
              </div>

              {/* Circular Send Arrow Button */}
              <button
                onClick={handleSend}
                disabled={!activeFile || !draft.trim() || isStreaming}
                className="w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center text-xs font-bold disabled:opacity-20 hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
                title="Send question"
                aria-label="Send"
              >
                ↑
              </button>
            </div>
          </div>

          <div className="text-center mt-1.5 text-[10px] font-mono text-sub">
            PSI cites verified timestamps and document pages. Always verify original media receipts.
          </div>
        </div>
      </div>
    </div>
  );
}
