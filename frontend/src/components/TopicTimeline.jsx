import React from 'react';

export function TopicTimeline({ topics = [], activeTime = 0, onJumpToTime }) {
  if (!topics || topics.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
        No topics extracted. (Available for audio and video media files)
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
        Chapters & Topic Timestamps
      </h3>
      <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
        {topics.map((t) => {
          const isActive = activeTime >= t.start_time && activeTime <= t.end_time;
          return (
            <div
              key={t.id}
              className="topic-item"
              style={{
                borderColor: isActive ? 'var(--primary)' : 'var(--border-subtle)',
                background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-input)',
              }}
              onClick={() => onJumpToTime(t.start_time)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="timestamp-chip"
                    style={{ margin: 0 }}
                  >
                    ▶ {t.formatted_start} - {t.formatted_end}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t.title}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '4px' }}>
                  {t.summary}
                </p>
              </div>

              <button
                className="btn btn-primary btn-sm"
                style={{ alignSelf: 'center', marginLeft: '10px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToTime(t.start_time);
                }}
              >
                Play
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
