import React, { useEffect, useState } from 'react';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { MediaPlayer } from './components/MediaPlayer';
import { ChatInterface } from './components/ChatInterface';
import { SummaryCard } from './components/SummaryCard';
import { TopicTimeline } from './components/TopicTimeline';
import { UploadDropzone } from './components/UploadDropzone';
import { AuthModal } from './components/AuthModal';
import { ApiKeyModal } from './components/ApiKeyModal';

export function App() {
  const [theme, setTheme] = useState(localStorage.getItem('omnimind_theme') || 'dark');
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [topics, setTopics] = useState([]);
  const [seekTimestamp, setSeekTimestamp] = useState(null);
  const [activeMediaTime, setActiveMediaTime] = useState(0);
  const [activeTab, setActiveTab] = useState('media'); // 'media', 'summary', 'topics'
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('omnimind_theme', theme);
  }, [theme]);

  // Initial Authentication & Document Loading
  useEffect(() => {
    const initApp = async () => {
      try {
        let currentUser;
        try {
          currentUser = await api.getMe();
        } catch (_) {
          // Fall back to seamless guest session
          const guestSession = await api.createGuestSession();
          currentUser = guestSession.user;
        }
        setUser(currentUser);
        await loadDocuments();
      } catch (err) {
        console.error('App initialization error:', err);
      }
    };
    initApp();
  }, []);

  const loadDocuments = async () => {
    try {
      const resp = await api.listDocuments();
      if (resp && resp.documents) {
        setDocuments(resp.documents);
        if (resp.documents.length > 0 && !activeDoc) {
          selectDocument(resp.documents[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to list documents:', err);
    }
  };

  const selectDocument = async (docId) => {
    try {
      const doc = await api.getDocument(docId);
      setActiveDoc(doc);
      setSummaryData({
        executive_summary: doc.summary || 'Summary loaded.',
        key_points: [
          'Indexed for semantic vector search.',
          'Granular timestamp chapters extracted.',
          'Ready for conversational Q&A.',
        ],
        word_count: (doc.full_text || '').split(/\s+/).length,
      });
      setTopics(doc.topics || []);
      setActiveTab(doc.file_type === 'pdf' ? 'summary' : 'media');
    } catch (err) {
      console.error('Failed to load document:', err);
    }
  };

  const handleUploadFile = async (file) => {
    setIsUploading(true);
    try {
      const newDoc = await api.uploadFile(file);
      await loadDocuments();
      setActiveDoc(newDoc);
      setSummaryData({
        executive_summary: newDoc.summary,
        key_points: [
          'High-density vector indexing applied.',
          'Granular timestamp citations mapped.',
        ],
        word_count: (newDoc.full_text || '').split(/\s+/).length,
      });
      setTopics(newDoc.topics || []);
      setActiveTab(newDoc.file_type === 'pdf' ? 'summary' : 'media');
      setShowUploadModal(false);
    } catch (err) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Crucial Core UX: Clicking any timestamp chip in Chat or Topics seeks player and plays immediately
  const handleJumpToTime = (seconds) => {
    setActiveTab('media');
    setSeekTimestamp(seconds);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="app-container">
      <Navbar
        documents={documents}
        activeDocId={activeDoc?.id}
        onSelectDoc={selectDocument}
        onOpenUpload={() => setShowUploadModal(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenApiKey={() => setShowApiKeyModal(true)}
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="main-layout">
        {/* Left Column: Media Player / Document Viewer / Summary / Chapters */}
        <section className="card-panel">
          {activeDoc ? (
            <div>
              {/* Document Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {activeDoc.file_type === 'pdf' ? '📄' : activeDoc.file_type === 'video' ? '🎬' : '🎙️'}{' '}
                    {activeDoc.original_name}
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Type: {activeDoc.file_type.toUpperCase()} • Size: {(activeDoc.file_size / 1024).toFixed(1)} KB
                  </span>
                </div>

                {/* View Tabs */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {activeDoc.file_type !== 'pdf' && (
                    <button
                      className={`btn btn-sm ${activeTab === 'media' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setActiveTab('media')}
                    >
                      ▶ Player
                    </button>
                  )}
                  <button
                    className={`btn btn-sm ${activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('summary')}
                  >
                    📝 Summary
                  </button>
                  {activeDoc.file_type !== 'pdf' && (
                    <button
                      className={`btn btn-sm ${activeTab === 'topics' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setActiveTab('topics')}
                    >
                      ⏱️ Chapters ({topics.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Content Display */}
              {activeTab === 'media' && activeDoc.file_type !== 'pdf' && (
                <div>
                  <MediaPlayer
                    document={activeDoc}
                    seekTimestamp={seekTimestamp}
                    onTimeUpdate={setActiveMediaTime}
                  />
                  <div style={{ marginTop: '16px' }}>
                    <TopicTimeline
                      topics={topics}
                      activeTime={activeMediaTime}
                      onJumpToTime={handleJumpToTime}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'summary' && (
                <SummaryCard summaryData={summaryData} />
              )}

              {activeTab === 'topics' && (
                <TopicTimeline
                  topics={topics}
                  activeTime={activeMediaTime}
                  onJumpToTime={handleJumpToTime}
                />
              )}
            </div>
          ) : (
            <div style={{ padding: '24px 0' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', textAlign: 'center' }}>
                Upload an Asset to Begin Analysis
              </h3>
              <UploadDropzone
                onUploadSuccess={handleUploadFile}
                isUploading={isUploading}
              />
            </div>
          )}
        </section>

        {/* Right Column: AI Chatbot & Timestamp Grounding Interface */}
        <section className="card-panel">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>💬</span>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Interactive AI Assistant</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Grounded in transcripts with clickable playback timestamps
                </p>
              </div>
            </div>
            <span
              className="badge"
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--accent-emerald)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
              }}
            >
              Active RAG
            </span>
          </div>

          {activeDoc ? (
            <ChatInterface
              documentId={activeDoc.id}
              fileType={activeDoc.file_type}
              onJumpToTime={handleJumpToTime}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '40px 20px',
              }}
            >
              Please upload or select a document to start the AI conversation.
            </div>
          )}
        </section>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="card-panel"
            style={{ width: '100%', maxWidth: '580px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Upload Document or Multimedia</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
                onClick={() => setShowUploadModal(false)}
              >
                ✕
              </button>
            </div>
            <UploadDropzone
              onUploadSuccess={handleUploadFile}
              isUploading={isUploading}
            />
          </div>
        </div>
      )}

      {/* Auth & API Key Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(u) => setUser(u)}
        user={user}
      />
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />
    </div>
  );
}
