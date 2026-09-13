import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';

/**
 * useChatStream: Senior React Hook for real-time SSE chat streaming.
 * Features:
 * - Real-time token streaming with live cursor
 * - AbortController integration to prevent connection leaks on unmount or query cancel
 * - Automatic citation and follow-up suggestion parsing
 * - Grounded timestamp detection
 */
export function useChatStream(activeFile) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const abortControllerRef = useRef(null);

  // Load chat history when activeFile changes and clean up active stream
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamedText('');

    if (!activeFile?.id) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    api.getChatHistory(activeFile.id)
      .then((history) => {
        if (!isMounted) return;
        if (history && history.length > 0) {
          setMessages(
            history.map((h, idx) => ({
              id: h.id || `hist-${activeFile.id}-${idx}`,
              role: h.role === 'user' ? 'user' : 'assistant',
              text: h.content,
              citations: h.citations || [],
              follow_ups: h.follow_ups || [],
              searchMode: h.search_mode || 'rag',
              engine: h.engine || 'Local RAG (Vector Search)',
            }))
          );
        } else {
          setMessages([]);
        }
      })
      .catch((err) => console.warn('[Chat History Warning]', err));

    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [activeFile?.id]);

  const sendQuery = useCallback(
    async (queryText, searchMode = 'rag', gptModel = 'gpt-4o-mini') => {
      if (!queryText.trim() || !activeFile?.id) return;

      // Abort any ongoing stream to prevent leakage
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const userMsgId = `usr-${Date.now()}`;
      const aiMsgId = `ai-${Date.now()}`;

      const userMessage = {
        id: userMsgId,
        role: 'user',
        text: queryText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        searchMode,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setStreamedText('');

      const backendSearchMode = searchMode === 'llm' ? 'gpt' : 'inbuilt';
      const chatHistoryForBackend = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      let accumulatedText = '';

      const onChunk = (chunk) => {
        accumulatedText += chunk;
        setStreamedText(accumulatedText);
      };

      const onDone = (citations = [], followUps = [], engine = null, retrievalMethod = null) => {
        setIsStreaming(false);
        const finalAnswer = accumulatedText || 'No response generated.';
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: 'assistant',
            text: finalAnswer,
            citations,
            follow_ups: followUps,
            searchMode,
            engine: engine || (searchMode === 'llm' ? `OpenAI ${gptModel}` : 'Inbuilt RAG / Vector Search'),
            retrievalMethod,
          },
        ]);
        setStreamedText('');
        abortControllerRef.current = null;
      };

      const onError = (err) => {
        setIsStreaming(false);
        setStreamedText('');
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: 'assistant',
            text: `⚠️ Query error: ${err.message || 'Unable to connect to reasoning service.'}`,
            searchMode,
            error: true,
          },
        ]);
        abortControllerRef.current = null;
      };

      try {
        await api.streamChat(
          activeFile.id,
          queryText,
          onChunk,
          onDone,
          onError,
          chatHistoryForBackend,
          backendSearchMode,
          searchMode === 'llm' ? gptModel : null,
          abortControllerRef.current.signal
        );
      } catch (err) {
        onError(err);
      }
    },
    [activeFile?.id, messages]
  );

  return {
    messages,
    setMessages,
    isStreaming,
    streamedText,
    sendQuery,
  };
}
