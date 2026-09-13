import React, { useRef, useState, useEffect } from 'react';
import TopBar from './components/TopBar.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import SummaryPanel from './components/SummaryPanel.jsx';
import LibraryView from './components/LibraryView.jsx';
import ApiKeyModal from './components/modals/ApiKeyModal.jsx';
import AuthModal from './components/modals/AuthModal.jsx';
import { useDocumentWorkspace } from './hooks/useDocumentWorkspace.js';
import { useChatStream } from './hooks/useChatStream.js';
import { api } from './services/api.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('workspace'); // 'workspace' | 'library'
  const [workspaceMode, setWorkspaceMode] = useState('media'); // 'documents' | 'media'
  const [user, setUser] = useState(null);
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

  // Initialize guest session and initial file list ONCE on mount
  useEffect(() => {
    let isMounted = true;
    async function initUser() {
      try {
        let me = null;
        try {
          me = await api.getMe();
        } catch (_) {
          const guest = await api.createGuestSession();
          me = guest.user;
        }
        if (isMounted) {
          setUser(me);
          await refreshSources();
        }
      } catch (err) {
        console.error('[App Init Error]', err);
      }
    }
    initUser();
    return () => {
      isMounted = false;
    };
  }, []);

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
        onRefresh={() => refreshSources()}
      />

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
