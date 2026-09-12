import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

// Convert [MM:SS] or [HH:MM:SS] text into seconds
function parseTimestamp(text) {
  const clean = text.replace(/[\[\]]/g, '').trim();
  const parts = clean.split(':');
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  } else if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return 0;
}

// Render message text with interactive timestamp buttons
function FormattedMessageContent({ content, onJumpToTime }) {
  // Regex finding [MM:SS] or [HH:MM:SS]
  const timestampRegex = /(\[\d{1,2}:\d{2}(?::\d{2})?\])/g;
  const parts = content.split(timestampRegex);

  return (
    <div>
      {parts.map((part, i) => {
        if (timestampRegex.test(part)) {
          const seconds = parseTimestamp(part);
          return (
            <button
              key={i}
              className="timestamp-chip"
              onClick={() => onJumpToTime(seconds)}
              title={`Jump playback to ${part}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

export function ChatInterface({ documentId, fileType, onJumpToTime }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedAnswer, setStreamedAnswer] = useState('');
  const messagesEndRef = useRef(null);

  // Load chat history when documentId changes
  useEffect(() => {
    if (!documentId) return;
    setMessages([]);
    setStreamedAnswer('');
    api.getChatHistory(documentId)
      .then((history) => {
        if (history && history.length > 0) {
          setMessages(history);
        } else {
          // Welcoming default assistant message
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              content: `Hello! I have indexed your ${fileType === 'pdf' ? 'PDF document' : 'media file'}. Ask any question or click a suggested prompt below!`,
              citations: [],
            },
          ]);
        }
      })
      .catch((err) => console.error('Failed to load chat history:', err));
  }, [documentId, fileType]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedAnswer]);

  const handleSendMessage = async (customPrompt) => {
    const textToSend = customPrompt || inputMessage.trim();
    if (!textToSend || isStreaming) return;

    // Append user message immediately
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      citations: [],
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsStreaming(true);
    setStreamedAnswer('');

    let accumulatedAnswer = '';

    await api.streamChat(
      documentId,
      textToSend,
      (chunk) => {
        accumulatedAnswer += chunk;
        setStreamedAnswer(accumulatedAnswer);
      },
      (citations) => {
        // Complete stream
        setIsStreaming(false);
        const asstMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: accumulatedAnswer,
          citations: citations || [],
        };
        setMessages((prev) => [...prev, asstMsg]);
        setStreamedAnswer('');
      },
      (err) => {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Error generating response: ${err.message}`,
            citations: [],
          },
        ]);
        setStreamedAnswer('');
      }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedPrompts = fileType === 'pdf'
    ? [
        'Summarize the primary sections',
        'What are the key technical recommendations?',
        'Highlight important conclusions',
      ]
    : [
        'What is discussed in the introduction?',
        'Summarize the core topics covered',
        'What is the conclusion and takeaway?',
      ];

  return (
    <div className="chat-container">
      {/* Quick Suggested Prompts */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px' }}>
        {suggestedPrompts.map((p, idx) => (
          <button
            key={idx}
            className="btn btn-secondary btn-sm"
            onClick={() => handleSendMessage(p)}
            style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
          >
            💡 {p}
          </button>
        ))}
      </div>

      {/* Message History Thread */}
      <div className="chat-messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`message-bubble ${m.role === 'user' ? 'message-user' : 'message-assistant'}`}
          >
            <FormattedMessageContent content={m.content} onJumpToTime={onJumpToTime} />

            {/* Citations Card */}
            {m.citations && m.citations.length > 0 && (
              <div className="chat-citations">
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: '100%' }}>
                  References & Citations:
                </span>
                {m.citations.map((c, ci) => (
                  <button
                    key={ci}
                    className="timestamp-chip"
                    onClick={() => {
                      if (c.start_time !== undefined && c.start_time !== null) {
                        onJumpToTime(c.start_time);
                      }
                    }}
                    title={c.snippet}
                  >
                    {c.formatted_timestamp ? `⏱️ ${c.formatted_timestamp}` : `📄 Page ${c.page || 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Live Streaming Assistant Message */}
        {isStreaming && (
          <div className="message-bubble message-assistant">
            <FormattedMessageContent content={streamedAnswer} onJumpToTime={onJumpToTime} />
            <span className="streaming-cursor" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div className="chat-input-bar">
        <input
          type="text"
          className="chat-input"
          placeholder={isStreaming ? 'Streaming response...' : 'Ask a question about this content...'}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
        <button
          className="btn btn-primary"
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isStreaming}
        >
          {isStreaming ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
