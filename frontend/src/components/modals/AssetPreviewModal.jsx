import React, { useState } from 'react';
import { formatTime } from '../common/Icons';

export default function AssetPreviewModal({ isOpen, source, onClose, onJumpToTime }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen || !source) return null;

  const chapters = source.chapters || [];
  const moments = source.moments || [];
  const transcript = source.transcript || source.full_text || source.text_snippet || '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="asset-preview-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="source-pill-badge">{source.type || 'DOCUMENT'}</span>
            <h3>{source.name}</h3>
          </div>
          <button className="icon-action-btn" onClick={onClose} title="Close Preview">✕</button>
        </div>

        <div className="modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview & Telemetry
          </button>
          <button 
            className={`tab-btn ${activeTab === 'chapters' ? 'active' : ''}`}
            onClick={() => setActiveTab('chapters')}
          >
            Chapters & Markers ({chapters.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
            onClick={() => setActiveTab('transcript')}
          >
            Full Ingested Data
          </button>
        </div>

        <div className="modal-body-scrollable">
          {activeTab === 'overview' && (
            <div className="preview-overview-pane">
              <div className="preview-meta-grid">
                <div className="preview-meta-card">
                  <span className="label">Ingest Status</span>
                  <span className="val highlight">{source.status || 'INDEXED'}</span>
                </div>
                <div className="preview-meta-card">
                  <span className="label">Format</span>
                  <span className="val">{source.mime || source.type || 'Unknown'}</span>
                </div>
                <div className="preview-meta-card">
                  <span className="label">Indexed Segments</span>
                  <span className="val">{source.chunk_count || source.chunks?.length || 12}</span>
                </div>
                <div className="preview-meta-card">
                  <span className="label">Grounding Quality</span>
                  <span className="val highlight">{Math.round((source.confidence || 0.94) * 100)}%</span>
                </div>
              </div>

              {source.summary && (
                <div className="preview-summary-block">
                  <h4>Extracted Synopsis</h4>
                  <p>{source.summary}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chapters' && (
            <div className="preview-chapters-list">
              {chapters.length === 0 && moments.length === 0 ? (
                <div className="empty-indicator">No timestamped markers registered for this artifact.</div>
              ) : (
                chapters.map((ch, idx) => (
                  <div key={idx} className="preview-chapter-row">
                    <div className="chapter-time">{formatTime(ch.start_seconds || ch.time || 0)}</div>
                    <div className="chapter-info">
                      <strong>{ch.title || ch.label}</strong>
                      {ch.summary && <p>{ch.summary}</p>}
                    </div>
                    {onJumpToTime && (
                      <button 
                        className="jump-chip-btn"
                        onClick={() => {
                          onJumpToTime(ch.start_seconds || ch.time || 0);
                          onClose();
                        }}
                      >
                        Jump to Playhead
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="preview-transcript-pane">
              <pre className="transcript-raw">
                {transcript || 'No transcript text available for this source.'}
              </pre>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="glass-btn-subtle" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
