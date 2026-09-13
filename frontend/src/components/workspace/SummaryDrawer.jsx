import React from 'react';
import { Icon, parseSeconds } from '../common/Icons';

export function SummaryDrawer({
  summaryData,
  activeSource,
  showSummaryDrawer,
  setShowSummaryDrawer,
  copiedSummary,
  setCopiedSummary,
  jumpToTimestamp,
}) {
  if (!summaryData) return null;

  return (
    <div className="executive-summary-box">
      <div className="summary-box-header" onClick={() => setShowSummaryDrawer(!showSummaryDrawer)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="section-tag">AI SUMMARY & TAKEAWAYS</span>
          <span className="summary-title-hint">
            {activeSource?.type === 'video' || activeSource?.type === 'audio'
              ? 'Interactive timestamps enabled'
              : 'Vector indexed'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-pill-small"
            onClick={(e) => {
              e.stopPropagation();
              const textToCopy = `${summaryData.executive_summary}\n\nKey Takeaways:\n${(summaryData.key_points || []).map((p) => `• ${p}`).join('\n')}`;
              navigator.clipboard?.writeText(textToCopy);
              setCopiedSummary(true);
              setTimeout(() => setCopiedSummary(false), 2000);
            }}
            title="Copy executive summary"
          >
            <Icon name={copiedSummary ? 'check' : 'copy'} size={12} /> {copiedSummary ? 'Copied' : 'Copy'}
          </button>
          <span className="drawer-chevron">{showSummaryDrawer ? '▲ Hide' : '▼ View Takeaways'}</span>
        </div>
      </div>

      {showSummaryDrawer && (
        <div className="summary-box-content">
          {/* Active Extraction & Pipeline Architecture Banner */}
          <div className="pipeline-architecture-card">
            <div className="pipeline-arch-title">
              <span className="pipeline-arch-pulse" />
              Active Extraction & Reasoning Pipeline
            </div>
            <div className="pipeline-arch-grid">
              <div className="pipeline-arch-item">
                <span className="pipeline-arch-label">Synthesis / Generation</span>
                <strong className="pipeline-arch-value">
                  {summaryData.engine?.includes('OpenAI') ? '🧠 ' : '⚡ '}
                  {summaryData.engine || 'Inbuilt RAG Grounding Engine'}
                </strong>
              </div>
              <div className="pipeline-arch-item">
                <span className="pipeline-arch-label">Retrieval System</span>
                <strong className="pipeline-arch-value">
                  🔍 {summaryData.retrieval_method || 'Semantic Vector Search (TF-IDF & Cosine Similarity)'}
                </strong>
              </div>
              <div className="pipeline-arch-item">
                <span className="pipeline-arch-label">Extraction / Ingestion</span>
                <strong className="pipeline-arch-value">
                  {activeSource?.type === 'video' || activeSource?.type === 'audio' ? '🎙️ ' : '📄 '}
                  {summaryData.transcription_engine ||
                    (activeSource?.type === 'video' || activeSource?.type === 'audio'
                      ? 'Local SpeechRecognition (FFmpeg + FFprobe)'
                      : 'Document Vector Parser')}
                </strong>
              </div>
            </div>
          </div>

          <p className="summary-text">{summaryData.executive_summary}</p>
          {summaryData.key_points && summaryData.key_points.length > 0 && (
            <div className="summary-takeaways-wrap">
              <span className="takeaways-label">KEY TAKEAWAYS & TIMESTAMPS:</span>
              <div className="takeaways-list">
                {summaryData.key_points.map((pt, idx) => {
                  const match = pt.match(/^\[([0-9]{1,2}:[0-9]{2})\]\s*(.*)/);
                  if (match && (activeSource?.type === 'video' || activeSource?.type === 'audio')) {
                    const ts = match[1];
                    const desc = match[2];
                    const secs = parseSeconds(ts);
                    return (
                      <div key={idx} className="takeaway-row">
                        <button
                          className="inline-play-btn"
                          onClick={() => jumpToTimestamp(secs, ts)}
                          title={`Jump and play at ${ts}`}
                        >
                          ▶ Play {ts}
                        </button>
                        <span className="takeaway-desc">{desc}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="takeaway-bullet">
                      <span className="bullet-dot">•</span>
                      <span>{pt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SummaryDrawer;
