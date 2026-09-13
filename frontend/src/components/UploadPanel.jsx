import React, { useRef, useState } from 'react';

function fileIcon(type) {
  if (type === 'pdf') return '▤';
  if (type === 'audio') return '♪';
  return '▶';
}

export default function UploadPanel({
  sources = [],
  activeFileId,
  onSelectFile,
  onUpload,
  onDelete,
  isUploading,
  uploadProgress,
  uploadStatusText,
  workspaceMode,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [panelFilter, setPanelFilter] = useState('auto'); // 'auto' | 'all' | 'pdf' | 'media'
  const fileInputRef = useRef(null);

  const pdfCount = sources.filter((s) => s.type === 'pdf').length;
  const mediaCount = sources.filter((s) => s.type === 'video' || s.type === 'audio').length;

  const filteredSources = sources.filter((s) => {
    if (panelFilter === 'all') return true;
    if (panelFilter === 'pdf') return s.type === 'pdf';
    if (panelFilter === 'media') return s.type === 'video' || s.type === 'audio';
    // Auto: follows workspaceMode if there are items, otherwise falls back to showing all
    if (workspaceMode === 'documents') {
      return pdfCount > 0 ? s.type === 'pdf' : true;
    }
    if (workspaceMode === 'media') {
      return mediaCount > 0 ? s.type === 'video' || s.type === 'audio' : true;
    }
    return true;
  });

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach((file) => onUpload(file));
    }
  };

  return (
    <div className="border-r border-line p-4 md:p-5 flex flex-col h-full min-h-0 max-h-full overflow-hidden bg-paper">
      <div className="font-mono text-[11px] text-sub mb-3 lowercase flex items-center justify-between shrink-0">
        <span>01 — upload sources</span>
        <span className="text-[10.5px] font-mono">
          {filteredSources.length} of {sources.length} active
        </span>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,audio/*,video/*,.mp3,.wav,.m4a,.mp4,.webm,.mov"
        onChange={(e) => {
          if (e.target.files) {
            Array.from(e.target.files).forEach((file) => onUpload(file));
            e.target.value = '';
          }
        }}
      />

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border border-ink rounded-[3px] p-4 text-center bg-panel cursor-pointer transition-all duration-150 shrink-0 ${
          dragOver ? 'bg-accent-soft/60 border-accent scale-[1.01]' : 'hover:bg-accent-soft/30'
        } ${isUploading ? 'opacity-80 cursor-wait bg-accent-soft/20' : ''}`}
      >
        <div className="text-sm font-bold text-ink">
          {isUploading ? 'Processing File…' : 'Drop files here'}
        </div>
        <div className="text-xs text-sub mt-1">
          {isUploading
            ? uploadStatusText || 'Extracting text & acoustic features…'
            : 'or click to browse local documents, audio & video'}
        </div>

        {/* Live Upload Progress Indicator */}
        {isUploading && (
          <div className="mt-3">
            <div className="w-full bg-line h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-accent h-full transition-all duration-300"
                style={{ width: `${Math.max(15, uploadProgress)}%` }}
              />
            </div>
            <div className="font-mono text-[10px] text-sub mt-1">
              {uploadProgress > 0 ? `${uploadProgress}%` : 'Indexing…'}
            </div>
          </div>
        )}
      </div>

      {/* Supported file formats indicator */}
      <div className="flex gap-2 mt-3 text-[10px] font-mono text-sub shrink-0">
        <span className="flex-1 text-center border-b border-line pb-1">pdf document</span>
        <span className="flex-1 text-center border-b border-line pb-1">mp3 / wav audio</span>
        <span className="flex-1 text-center border-b border-line pb-1">mp4 / webm video</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between mt-4 pb-2 border-b border-line text-[11px] font-mono shrink-0">
        <div className="flex gap-1.5">
          {[
            { id: 'auto', label: 'Current' },
            { id: 'all', label: `All (${sources.length})` },
            { id: 'pdf', label: `PDF (${pdfCount})` },
            { id: 'media', label: `AV (${mediaCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPanelFilter(tab.id)}
              className={`px-1.5 py-0.5 rounded-[2px] transition-colors ${
                panelFilter === tab.id
                  ? 'bg-ink text-paper font-bold'
                  : 'text-sub hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* File List */}
      <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1">
        {filteredSources.length === 0 ? (
          <div className="p-4 border border-dashed border-line text-center text-xs text-sub font-mono rounded-[2px]">
            No files in this filter. Drop a file above to begin.
          </div>
        ) : (
          <ul className="space-y-0">
            {filteredSources.map((file, i) => {
              const isActive = activeFileId === file.id;
              return (
                <li key={file.id} className="relative group">
                  <button
                    onClick={() => onSelectFile(file.id)}
                    className={`w-full flex items-start gap-2.5 py-2.5 px-2 border-b border-line text-left transition-colors ${
                      isActive ? 'bg-accent-soft/60 font-semibold' : 'hover:bg-panel'
                    }`}
                  >
                    <span className="font-mono text-[10.5px] text-sub w-4 pt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium truncate text-ink">
                        <span className="mr-1 text-sub">{fileIcon(file.type)}</span>
                        {file.name}
                      </span>
                      <span className="block text-[10px] text-sub font-mono mt-0.5">
                        {file.duration ? `media · ${file.duration}` : file.meta}
                      </span>
                    </span>
                  </button>

                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove "${file.name}"?`)) onDelete(file.id);
                    }}
                    className="absolute right-2 top-2.5 text-xs font-mono text-sub hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Delete source"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
