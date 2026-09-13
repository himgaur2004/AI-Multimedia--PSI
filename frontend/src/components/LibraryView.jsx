import React, { useState } from 'react';

function fileIcon(type) {
  if (type === 'pdf') return '▤';
  if (type === 'audio') return '♪';
  return '▶';
}

export default function LibraryView({
  sources = [],
  activeFileId,
  onSelectFile,
  onDeleteFile,
  onSwitchToWorkspace,
  onTriggerUpload,
  isUploading,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All'); // 'All' | 'pdf' | 'audio' | 'video'

  const filtered = sources.filter((s) => {
    const matchesFilter = filter === 'All' || s.type === filter;
    const matchesSearch =
      !search.trim() ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.meta?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full">
      {/* Header and Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="font-mono text-xs text-sub lowercase mb-1">archive &amp; threads</div>
          <h1 className="font-display font-semibold text-2xl text-ink">
            Knowledge Library &amp; Threads
          </h1>
          <p className="text-xs text-sub mt-1">
            Browse indexed documents, speech transcripts, and active conversational threads.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onTriggerUpload}
            disabled={isUploading}
            className="px-4 py-2 bg-ink text-paper text-xs font-bold rounded-[2px] hover:bg-ink/90 transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            <span>+</span> Upload New Source
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-line mb-6">
        <div className="flex border border-ink rounded-[2px] overflow-hidden text-xs font-semibold">
          {[
            { id: 'All', label: `All (${sources.length})` },
            { id: 'pdf', label: 'PDFs' },
            { id: 'audio', label: 'Audio' },
            { id: 'video', label: 'Video' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 transition-colors border-r last:border-r-0 border-ink ${
                filter === tab.id
                  ? 'bg-ink text-paper'
                  : 'bg-paper text-ink hover:bg-line/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter files by name or meta…"
            className="w-full text-xs font-mono bg-panel border border-line px-3 py-1.5 rounded-[2px] outline-none placeholder:text-sub focus:border-ink"
          />
        </div>
      </div>

      {/* Grid of Files & Threads */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-line rounded-[2px] bg-panel/50">
          <div className="font-mono text-xl text-sub mb-2">∅</div>
          <h3 className="font-display font-medium text-base text-ink mb-1">
            {sources.length === 0 ? 'Your library is empty' : 'No matching files found'}
          </h3>
          <p className="text-xs text-sub max-w-sm mx-auto mb-4">
            {sources.length === 0
              ? 'Upload PDF documents, podcast audio, or video clips to start asking grounded questions.'
              : 'Try searching with a different term or selecting another filter.'}
          </p>
          {sources.length === 0 && (
            <button
              onClick={onTriggerUpload}
              className="px-4 py-2 bg-ink text-paper text-xs font-bold rounded-[2px] hover:bg-ink/90"
            >
              Upload Your First File
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((file) => {
            const isActive = activeFileId === file.id;
            return (
              <div
                key={file.id}
                className={`border rounded-[2px] p-4 flex flex-col justify-between transition-all bg-panel shadow-xs ${
                  isActive ? 'border-accent ring-1 ring-accent/30' : 'border-line hover:border-ink/60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="w-7 h-7 rounded-[2px] bg-paper border border-line flex items-center justify-center text-xs font-mono shrink-0">
                      {fileIcon(file.type)}
                    </span>
                    <span className="font-mono text-[10.5px] text-accent bg-accent-soft px-2 py-0.5 rounded-[2px]">
                      {file.type.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="font-medium text-sm text-ink truncate mb-1" title={file.name}>
                    {file.name}
                  </h3>

                  <div className="font-mono text-[11px] text-sub mb-3">
                    {file.duration ? `Duration: ${file.duration}` : file.meta}
                  </div>

                  <p className="text-xs text-sub line-clamp-2 leading-relaxed mb-4">
                    {file.type === 'pdf'
                      ? 'Structured text vectorized with semantic chunks for grounded citation.'
                      : 'Whisper ASR timestamp alignment synchronized with RFC 7233 partial streaming.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-line/60">
                  <button
                    onClick={() => {
                      onSelectFile(file.id);
                      onSwitchToWorkspace();
                    }}
                    className="text-xs font-bold text-ink hover:text-accent flex items-center gap-1 font-mono transition-colors"
                  >
                    Open Workspace →
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete "${file.name}"?`)) onDeleteFile(file.id);
                    }}
                    className="text-[11px] font-mono text-sub hover:text-accent transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
