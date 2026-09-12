/**
 * OmniMind Frontend API Client.
 * Senior SDE Pattern: Resilient Fetch-based client with SSE streaming support,
 * automatic token injection, error handling, and offline guest sessions.
 */

const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('omnimind_token') || '';
    this.apiKeyOverride = localStorage.getItem('omnimind_openai_key') || '';
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('omnimind_token', token);
    } else {
      localStorage.removeItem('omnimind_token');
    }
  }

  setApiKeyOverride(key) {
    this.apiKeyOverride = key;
    if (key) {
      localStorage.setItem('omnimind_openai_key', key);
    } else {
      localStorage.removeItem('omnimind_openai_key');
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
    const url = `${API_BASE}${endpoint}`;
    const headers = { ...this.getHeaders(options.isMultipart), ...options.headers };

    try {
      const response = await fetch(url, { ...options, headers });
      
      // Auto handle 401 Unauthorized by obtaining a fresh guest session
      if (response.status === 401 && !endpoint.includes('/auth/')) {
        await this.createGuestSession();
        // Retry original request with fresh credentials
        const retryHeaders = { ...this.getHeaders(options.isMultipart), ...options.headers };
        return await fetch(url, { ...options, headers: retryHeaders });
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
  async streamChat(documentId, message, onChunk, onDone, onError) {
    const url = `${API_BASE}/documents/${documentId}/chat/stream`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message,
          api_key_override: this.apiKeyOverride || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Stream error HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

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
                onDone(payload.citations || []);
              }
            } catch (jsonErr) {
              console.warn('[SSE Parse Warning]', jsonErr);
            }
          }
        }
      }
    } catch (err) {
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
    return `${API_BASE}/media/${documentId}/stream`;
  }
}

export const api = new ApiClient();
