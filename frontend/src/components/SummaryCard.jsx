import React, { useState } from 'react';

export function SummaryCard({ summaryData }) {
  const [copied, setCopied] = useState(false);

  if (!summaryData) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
        No summary available for this asset.
      </div>
    );
  }

  const handleCopy = () => {
    const textToCopy = `${summaryData.executive_summary}\n\nKey Takeaways:\n${summaryData.key_points.map(p => `• ${p}`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Executive Summary
        </h3>
        <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
          {copied ? '✓ Copied' : '📋 Copy Summary'}
        </button>
      </div>

      <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
        {summaryData.executive_summary}
      </p>

      {summaryData.key_points && summaryData.key_points.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Key Takeaways
          </h4>
          <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {summaryData.key_points.map((pt, idx) => (
              <li key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
        Word Count: {summaryData.word_count || 0} words
      </div>
    </div>
  );
}
