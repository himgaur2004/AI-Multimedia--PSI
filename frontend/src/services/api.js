/**
 * PSI Frontend API Client.
 * Senior SDE Pattern: Resilient Fetch-based client with SSE streaming support,
 * automatic token injection, error handling, and offline guest sessions.
 */

export const DEFAULT_BACKEND_URL = 'https://ai-multimedia-psi-production.up.railway.app';

class ApiClient {
  constructor() {
    this.token = typeof window !== 'undefined' ? (localStorage.getItem('psi_token') || '') : '';
    this.apiKeyOverride = typeof window !== 'undefined' ? (localStorage.getItem('psi_openai_key') || '') : '';
  }

  getBaseUrl() {
    if (typeof window !== 'undefined') {
      const custom = localStorage.getItem('psi_backend_url');
      if (custom && custom.trim()) {
        return custom.trim().replace(/\/$/, '') + '/api/v1';
      }
    }
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && envUrl.trim()) {
      return envUrl.trim().replace(/\/$/, '') + '/api/v1';
    }
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocalhost) {
        return `${DEFAULT_BACKEND_URL}/api/v1`;
      }
    }
    return '/api/v1';
  }

  getBackendUrl() {
    if (typeof window === 'undefined') return '';
    const custom = localStorage.getItem('psi_backend_url');
    if (custom && custom.trim()) return custom.trim();
    if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) {
      return import.meta.env.VITE_API_URL.trim();
    }
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      return DEFAULT_BACKEND_URL;
    }
    return '';
  }

  setBackendUrl(url) {
    if (typeof window === 'undefined') return;
    if (url && url.trim()) {
      localStorage.setItem('psi_backend_url', url.trim().replace(/\/$/, ''));
    } else {
      localStorage.removeItem('psi_backend_url');
    }
  }

  setToken(token) {
    this.token = token || '';
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('psi_token', token);
      } else {
        localStorage.removeItem('psi_token');
      }
    }
  }

  logout() {
    this.setToken('');
  }

  setApiKeyOverride(key) {
    this.apiKeyOverride = key;
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem('psi_openai_key', key);
      } else {
        localStorage.removeItem('psi_openai_key');
      }
    }
  }

  getHeaders(isMultipart = false) {
    const headers = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const headers = { ...this.getHeaders(options.isMultipart), ...options.headers };

    try {
      const response = await fetch(url, { ...options, headers });
      
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error(
          'API returned HTML instead of JSON. Backend service is not reachable at ' + url
        );
      }

      if (response.status === 405) {
        throw new Error(
          'HTTP 405 Method Not Allowed on ' + url
        );
      }

      if (response.status === 401) {
        this.setToken('');
      }

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errData = await response.json();
          errorMsg = errData.detail || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      if (response.status === 204) return null;
      return await response.json();
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  // Auth Endpoints
  async register(username, email, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    this.setToken(data.access_token);
    return data;
  }

  async login(usernameOrEmail, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
    });
    this.setToken(data.access_token);
    return data;
  }

  async createGuestSession() {
    const data = await this.request('/auth/guest', { method: 'POST' });
    this.setToken(data.access_token);
    return data;
  }

  async getMe() {
    return await this.request('/auth/me');
  }

  // Multi-User API Key Authentication Endpoints
  async createApiKey(name = 'PSI API Key') {
    return await this.request('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async listApiKeys() {
    return await this.request('/auth/api-keys');
  }

  async revokeApiKey(keyId) {
    return await this.request(`/auth/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }


  // Document Management
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    if (this.apiKeyOverride) {
      formData.append('api_key_override', this.apiKeyOverride);
    }

    return await this.request('/documents/upload', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
  }

  async listDocuments() {
    return await this.request('/documents/list');
  }

  async getDocument(id) {
    return await this.request(`/documents/${id}`);
  }

  async deleteDocument(id) {
    return await this.request(`/documents/${id}`, { method: 'DELETE' });
  }

  // Chat & Real-Time Streaming
  async streamChat(documentId, message, onChunk, onDone, onError, chatHistory = [], searchMode = 'inbuilt', model = null, signal = null) {
    if (!this.token) {
      try {
        await this.createGuestSession();
      } catch (_) {}
    }

    const url = `${this.getBaseUrl()}/documents/${documentId}/chat/stream`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        signal: signal || undefined,
        body: JSON.stringify({
          message,
          chat_history: chatHistory.length > 0 ? chatHistory : undefined,
          api_key_override: this.apiKeyOverride || undefined,
          search_mode: searchMode || 'inbuilt',
          model: model || undefined,
        }),
      });

      if (!response.ok) {
        // Fallback to standard chat endpoint if SSE fails
        const fallbackResp = await this.request(`/documents/${documentId}/chat`, {
          method: 'POST',
          headers: this.getHeaders(),
          signal: signal || undefined,
          body: JSON.stringify({
            message,
            chat_history: chatHistory.length > 0 ? chatHistory : undefined,
            api_key_override: this.apiKeyOverride || undefined,
            search_mode: searchMode || 'inbuilt',
            model: model || undefined,
          }),
        });
        if (fallbackResp && fallbackResp.answer) {
          onChunk(fallbackResp.answer);
          onDone(fallbackResp.citations || [], fallbackResp.follow_up_questions || [], fallbackResp.engine, fallbackResp.retrieval_method);
          return;
        }
        throw new Error(`Stream error HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let receivedDone = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            const lines = buffer.split('\n\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const payload = JSON.parse(line.replace('data: ', '').trim());
                  if (payload.chunk) onChunk(payload.chunk);
                  if (payload.done) {
                    receivedDone = true;
                    onDone(payload.citations || [], payload.follow_up_questions || [], payload.engine, payload.retrieval_method);
                  }
                } catch (_) {}
              }
            }
          }
          if (!receivedDone) {
            onDone([], []);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep partial frame in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.replace('data: ', '').trim());
              if (payload.chunk) {
                onChunk(payload.chunk);
              }
              if (payload.done) {
                receivedDone = true;
                onDone(payload.citations || [], payload.follow_up_questions || [], payload.engine, payload.retrieval_method);
              }
            } catch (jsonErr) {
              console.warn('[SSE Parse Warning]', jsonErr);
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return; // Clean cancellation, no leak
      }
      console.error('[StreamChat Error]', err);
      if (onError) onError(err);
    }
  }

  async getChatHistory(documentId) {
    return await this.request(`/documents/${documentId}/messages`);
  }

  // Summary & Topics
  async getSummary(documentId) {
    return await this.request(`/documents/${documentId}/summary`);
  }

  async getTopics(documentId) {
    return await this.request(`/documents/${documentId}/topics`);
  }

  // Media Stream URL
  getMediaStreamUrl(documentId) {
    return `${this.getBaseUrl()}/media/${documentId}/stream`;
  }
}

export const api = new ApiClient();
export default api;

