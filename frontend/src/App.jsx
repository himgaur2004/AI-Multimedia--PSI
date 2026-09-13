import React, { useRef, useState, useEffect } from 'react';
import TopBar from './components/TopBar.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import SummaryPanel from './components/SummaryPanel.jsx';
import LibraryView from './components/LibraryView.jsx';
import ApiKeyModal from './components/modals/ApiKeyModal.jsx';
import AuthModal from './components/modals/AuthModal.jsx';
import AuthGateway from './components/auth/AuthGateway.jsx';
import { useDocumentWorkspace } from './hooks/useDocumentWorkspace.js';
import { useChatStream } from './hooks/useChatStream.js';
import { api } from './services/api.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('workspace'); // 'workspace' | 'library'
  const [workspaceMode, setWorkspaceMode] = useState('media'); // 'documents' | 'media'
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [gptModel, setGptModel] = useState('gpt-4o-mini');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [seekTo, setSeekTo] = useState(null);

  const videoRef = useRef(null);
  const globalFileInputRef = useRef(null);

  const {
    sources,
    activeFile,
    summaryData,
    topics,
    isUploading,
    uploadProgress,
    uploadStatusText,
    toastMessage,
    refreshSources,
    selectFile,
    handleUpload,
    handleDelete,
  } = useDocumentWorkspace();

  const { messages, isStreaming, streamedText, sendQuery } = useChatStream(activeFile);

  const [backendError, setBackendError] = useState(null);

  // Check for an existing authenticated session on initial mount
  useEffect(() => {
    const checkSession = async () => {
      setIsCheckingAuth(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('psi_token') : null;
      if (token) {
        try {
          const me = await api.getMe();
          setUser(me);
          setBackendError(null);
          await refreshSources();
        } catch (err) {
          console.warn('[Session token invalid or expired]', err);
          api.logout();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsCheckingAuth(false);
    };
    checkSession();
  }, []);

  const handleAuthSuccess = async (authenticatedUser) => {
    setUser(authenticatedUser);
    setBackendError(null);
    try {
      await refreshSources();
    } catch (err) {
      console.error('[Failed to refresh sources]', err);
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  const handleWorkspaceModeChange = (newMode) => {
    setWorkspaceMode(newMode);
    if (sources.length > 0) {
      if (newMode === 'documents' && activeFile?.type !== 'pdf') {
        const firstPdf = sources.find((s) => s.type === 'pdf');
        if (firstPdf) selectFile(firstPdf.id);
      } else if (newMode === 'media' && activeFile?.type === 'pdf') {
        const firstMedia = sources.find((s) => s.type === 'video' || s.type === 'audio');
        if (firstMedia) selectFile(firstMedia.id);
      }
    }
  };

  function handleJumpTo(seconds) {
    if (seconds == null || isNaN(seconds)) return;
    setSeekTo(seconds + Math.random() * 1e-6);
  }

  const handleUploadWithMode = async (file) => {
    if (!file) return;
    const isPdf = file.name?.toLowerCase().endsWith('.pdf');
    if (isPdf && workspaceMode !== 'documents') {
      setWorkspaceMode('documents');
    } else if (!isPdf && workspaceMode !== 'media') {
      setWorkspaceMode('media');
    }
    await handleUpload(file);
  };

  if (isCheckingAuth) {
    return (
      <div className="h-screen w-screen bg-paper flex flex-col items-center justify-center font-mono text-xs text-sub">
        <div className="w-11 h-11 rounded-lg bg-[#141413] flex items-center justify-center p-2 mb-3 shadow-md animate-pulse">
          <img src="/psi-icon-white.webp" alt="PSI" className="w-full h-full object-contain" />
        </div>
        <div className="font-semibold text-ink">Loading Pan Science Innovation…</div>
        <div className="text-[11px] text-sub mt-1">Verifying research session</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50 bg-ink text-paper text-xs font-mono py-2 px-3.5 rounded-[2px] shadow-lg flex items-center gap-2 animate-fade-in">
            <span className="text-accent font-bold">✦</span> {toastMessage}
          </div>
        )}

        <AuthGateway
          onSuccess={handleAuthSuccess}
          onOpenSettings={() => setShowSettingsModal(true)}
        />

        <ApiKeyModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          gptModel={gptModel}
          setGptModel={setGptModel}
          onSettingsSaved={() => setBackendError(null)}
        />
      </>
    );
  }

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden bg-paper text-ink font-body flex flex-col">
      {/* Hidden global file input for library triggers */}
      <input
        ref={globalFileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,audio/*,video/*,.mp3,.wav,.m4a,.mp4,.webm,.mov"
        onChange={(e) => {
          if (e.target.files) {
            Array.from(e.target.files).forEach((f) => handleUploadWithMode(f));
            e.target.value = '';
          }
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-ink text-paper text-xs font-mono py-2 px-3.5 rounded-[2px] shadow-lg flex items-center gap-2 animate-fade-in">
          <span className="text-accent font-bold">✦</span> {toastMessage}
        </div>
      )}

      {/* Global TopBar Header */}
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        workspaceMode={workspaceMode}
        onWorkspaceModeChange={handleWorkspaceModeChange}
        sourcesCount={sources.length}
        user={user}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onRefresh={() => refreshSources()}
      />

      {/* Backend Disconnected Notice */}
      {backendError && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 text-xs font-mono text-amber-900 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-bold">Backend Server Not Connected:</span>
            <span className="text-amber-800">
              Requests to <code>{api.getBackendUrl() || '/api/v1'}</code> failed. If deployed on Vercel, connect your Railway backend URL.
            </span>
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-2.5 py-1 bg-ink text-paper text-xs font-semibold rounded-[2px] hover:bg-ink/80 transition-colors cursor-pointer"
          >
            Configure Backend URL →
          </button>
        </div>
      )}

      {/* View Switcher: Workspace vs Library & Threads */}
      {activeTab === 'library' ? (
        <div className="flex-1 min-h-0 overflow-y-auto bg-paper">
          <LibraryView
            sources={sources}
            activeFileId={activeFile?.id}
            onSelectFile={(id) => selectFile(id)}
            onDeleteFile={(id) => handleDelete(id)}
            onSwitchToWorkspace={() => setActiveTab('workspace')}
            onTriggerUpload={() => globalFileInputRef.current?.click()}
            isUploading={isUploading}
          />
        </div>
      ) : (
        <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[290px_1fr_340px] lg:grid-rows-1 h-full max-h-full overflow-hidden">
          {/* Column 1: Upload & File Index */}
          <div className="h-full min-h-0 max-h-full overflow-hidden flex flex-col">
            <UploadPanel
              sources={sources}
              activeFileId={activeFile?.id}
              onSelectFile={selectFile}
              onUpload={handleUploadWithMode}
              onDelete={handleDelete}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              uploadStatusText={uploadStatusText}
              workspaceMode={workspaceMode}
            />
          </div>

          {/* Column 2: Conversational Grounded AI Chat */}
          <div className="border-r border-line flex flex-col h-full min-h-0 max-h-full overflow-hidden">
            <ChatPanel
              activeFile={activeFile}
              messages={messages}
              isStreaming={isStreaming}
              streamedText={streamedText}
              onSendMessage={(text, mode) => sendQuery(text, mode, gptModel)}
              onJumpTo={handleJumpTo}
            />
          </div>

          {/* Column 3: Executive Summary & Synchronized Media Player Station */}
          <div className="h-full min-h-0 max-h-full overflow-hidden flex flex-col">
            <SummaryPanel
              summaryData={summaryData}
              activeFile={activeFile}
              topics={topics}
              videoRef={videoRef}
              seekTo={seekTo}
              onJumpTo={handleJumpTo}
              workspaceMode={workspaceMode}
            />
          </div>
        </main>
      )}

      {/* Modals */}
      <ApiKeyModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        gptModel={gptModel}
        setGptModel={setGptModel}
        onSettingsSaved={() => {
          setBackendError(null);
          if (user) refreshSources();
        }}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={user}
        onUserChange={setUser}
        onRefreshSources={refreshSources}
      />
    </div>
  );
}
