import React, { useState } from 'react';

export default function TopicTimeline({
  topics = [],
  onJumpTo,
  activeFile,
  sectionNumber = '04 — topic timestamps',
}) {
  const [filter, setFilter] = useState('');

  const filteredTopics = topics.filter(
    (t) =>
      t.title?.toLowerCase().includes(filter.toLowerCase()) ||
      t.desc?.toLowerCase().includes(filter.toLowerCase()) ||
      t.time?.includes(filter)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[11px] text-sub lowercase">{sectionNumber}</div>
        <span className="font-mono text-[10.5px] text-sub">
          {topics.length} {topics.length === 1 ? 'chapter' : 'chapters'}
        </span>
      </div>

      {topics.length > 4 && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter topics…"
          className="w-full text-xs font-mono bg-panel border border-line px-2.5 py-1 rounded-[2px] mb-2 outline-none placeholder:text-sub"
        />
      )}

      {topics.length === 0 ? (
        <div className="p-3 border border-line rounded-[2px] text-center font-mono text-[11px] text-sub bg-panel">
          {activeFile?.type === 'pdf'
            ? 'PDF pages indexed. Ask questions in chat to retrieve citations.'
            : 'No topic timestamps extracted yet.'}
        </div>
      ) : (
        <ul className="space-y-0 max-h-64 overflow-y-auto pr-1">
          {filteredTopics.map((t, idx) => (
            <li
              key={idx}
              onClick={() => onJumpTo(t.seconds)}
              className="flex items-start gap-2.5 py-2.5 border-b border-line hover:bg-panel transition-colors px-1.5 rounded-[2px] cursor-pointer group"
              title={`Click to jump and play from ${t.time}`}
            >
              <span className="font-mono text-xs font-semibold text-accent w-12 pt-0.5 shrink-0 group-hover:underline">
                {t.time}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-ink truncate">{t.title}</span>
                <span className="block text-[11px] text-sub leading-snug line-clamp-2 mt-0.5">
                  {t.desc}
                </span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpTo(t.seconds);
                }}
                className="w-6 h-6 border border-ink flex items-center justify-center text-[9px] group-hover:bg-ink group-hover:text-paper transition-colors shrink-0 rounded-[1px]"
                aria-label={`Play from ${t.time}`}
                title={`Jump to ${t.time}`}
              >
                ▶
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
