import React, { useState } from 'react';
import MediaStation from './MediaStation.jsx';
import TopicTimeline from './TopicTimeline.jsx';

export default function SummaryPanel({
  summaryData,
  activeFile,
  topics,
  videoRef,
  seekTo,
  onJumpTo,
  workspaceMode,
}) {
  const [copied, setCopied] = useState(false);
  const isMedia = activeFile?.type === 'video' || activeFile?.type === 'audio';

  const handleCopy = () => {
    if (!summaryData) return;
    const bullets = (summaryData.key_points || []).map((p) => `• ${p}`).join('\n');
    const fullText = `${summaryData.executive_summary}\n\nKey Takeaways:\n${bullets}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 md:p-5 overflow-y-auto h-full min-h-0 max-h-full bg-paper space-y-5">
      {/* 1ST: PLAY OPTION (FOR MEDIA) / DOCUMENT INSPECT (FOR PDF) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-[11px] text-sub lowercase">
            03 — {isMedia ? 'play video & media' : 'document inspect'}
          </div>
          {activeFile && (
            <span className="font-mono text-[10px] text-sub uppercase">
              {activeFile.type} · {activeFile.duration || activeFile.meta || 'ready'}
            </span>
          )}
        </div>
        <MediaStation ref={videoRef} activeFile={activeFile} seekTo={seekTo} />
      </div>

      {/* 2ND: TIMESTAMPS SECTION (WHEN GOING THROUGH VIDEO OR AUDIO) */}
      {isMedia && (
        <div className="pt-4 border-t border-line">
          <TopicTimeline
            topics={topics}
            onJumpTo={onJumpTo}
            activeFile={activeFile}
            sectionNumber="04 — topic timestamps"
          />
        </div>
      )}

      {/* 3RD: SUMMARY & SYNOPSIS */}
      <div className="pt-4 border-t border-line">
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-[11px] text-sub lowercase">
            {isMedia ? '05 — summary & synopsis' : '04 — summary & synopsis'}
          </div>
          {summaryData && (
            <button
              onClick={handleCopy}
              className="font-mono text-[10.5px] text-accent hover:underline transition-all cursor-pointer"
              title="Copy summary to clipboard"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
        </div>

        <span className="font-mono text-[10.5px] text-accent block mb-2">
          {summaryData?.engine ? `Generated via ${summaryData.engine}` : 'Extracted from source'}
        </span>

        <div className="bg-panel border border-line p-3.5 rounded-[2px] shadow-xs">
          <p className="text-[13px] leading-relaxed text-ink/90">
            {summaryData?.executive_summary ||
              (activeFile
                ? 'Extracting structured summary and semantic vector chunks from document…'
                : 'Select a file to inspect its executive summary and synopsis.')}
          </p>

          {summaryData?.key_points && summaryData.key_points.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-line">
              <span className="block font-mono text-[11px] font-semibold text-ink/80 mb-1.5">
                Key Takeaways:
              </span>
              <ul className="space-y-1.5">
                {summaryData.key_points.map((point, idx) => (
                  <li key={idx} className="text-xs text-sub leading-snug flex items-start gap-1.5">
                    <span className="text-accent font-bold">›</span>
                    <span className="flex-1">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summaryData?.word_count && (
            <div className="mt-2.5 pt-2 border-t border-line/50 flex items-center justify-between font-mono text-[10px] text-sub">
              <span>Indexed synopsis</span>
              <span>~{summaryData.word_count} words</span>
            </div>
          )}
        </div>
      </div>

      {/* For PDF documents if any chapter topics exist */}
      {!isMedia && topics && topics.length > 0 && (
        <div className="pt-4 border-t border-line">
          <TopicTimeline
            topics={topics}
            onJumpTo={onJumpTo}
            activeFile={activeFile}
            sectionNumber="05 — topic timestamps"
          />
        </div>
      )}
    </div>
  );
}
