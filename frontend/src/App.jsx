import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StatusCards from './components/StatusCards';
import WorkflowBanner from './components/WorkflowBanner';
import SendFileTab from './components/SendFileTab';
import MyFilesTab from './components/MyFilesTab';
import LeakInvestigationTab from './components/LeakInvestigationTab';
import LedgerTab from './components/LedgerTab';
import DocumentViewerModal from './components/DocumentViewerModal';
import DemoModal from './components/DemoModal';
import StoryModeModal from './components/StoryModeModal';
import SettingsModal from './components/SettingsModal';
import { Send, Inbox, Search, Server } from 'lucide-react';
import { api } from './api/client';

export default function App() {
  // Navigation: 1. Send File, 2. My Files, 3. Leak Investigation, 4. Ledger
  const [activeTab, setActiveTab] = useState('my-files');
  const [statusData, setStatusData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simulated identity (Alice vs Bob switch)
  const [currentUser, setCurrentUser] = useState('bob');

  // Modals
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [openedDocument, setOpenedDocument] = useState(null);

  // Workflow state passed between tabs
  const [latestPackagePath, setLatestPackagePath] = useState('data/encrypted/test_document');
  const [latestDecryptedPath, setLatestDecryptedPath] = useState(null);

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.getStatus();
      setStatusData(res);
      setIsOnline(true);
      setStatusError(null);
    } catch (err) {
      setIsOnline(false);
      setStatusError(err.message || 'Cannot connect to SANKET backend');
    } finally {
      setIsLoadingStatus(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  // 4 Core User Workflow Navigation Tabs (Requirement 3)
  const tabs = [
    { id: 'send', label: '1. Send File', icon: Send, desc: 'Encrypt & dispatch' },
    { id: 'my-files', label: '2. My Files', icon: Inbox, desc: 'Sent & received files' },
    { id: 'leak', label: '3. Leak Investigation', icon: Search, desc: 'Forensic source trace' },
    { id: 'ledger', label: '4. Ledger', icon: Server, desc: 'Cryptographic audit' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100 font-sans selection:bg-blue-500/30 selection:text-blue-200">
      {/* Top Navbar */}
      <Header
        onOpenDemo={() => setIsDemoOpen(true)}
        onOpenStory={() => setIsStoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isOnline={isOnline}
        onRefresh={fetchStatus}
        isRefreshing={isRefreshing}
        currentUser={currentUser}
        onSelectUser={setCurrentUser}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Real-time System Metrics */}
        <StatusCards
          statusData={statusData}
          isLoading={isLoadingStatus}
          error={statusError}
        />

        {/* 5-Step Process Flow Banner (Requirement 6: Understand in under 10 seconds) */}
        <WorkflowBanner
          activeTab={activeTab}
          onRunDemo={() => setIsDemoOpen(true)}
        />

        {/* Clean Enterprise Navigation Tabs (Requirement 3) */}
        <div className="flex items-center space-x-1 sm:space-x-2 border-b border-slate-800 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center space-x-2 py-3 px-3.5 sm:px-5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-500' : 'text-slate-500'
                  }`}
                />
                <span>{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Panels: User Workflow System */}
        <div className="py-2">
          {/* TAB 1: Send File */}
          {activeTab === 'send' && (
            <SendFileTab
              currentUser={currentUser}
              onFileSent={(pkgPath) => {
                setLatestPackagePath(pkgPath);
              }}
              onNavigateMyFiles={() => setActiveTab('my-files')}
              onSelectUser={setCurrentUser}
            />
          )}

          {/* TAB 2: My Files (Received / Sent) */}
          {activeTab === 'my-files' && (
            <MyFilesTab
              currentUser={currentUser}
              onOpenDocument={(doc) => {
                setOpenedDocument(doc);
                setIsViewerOpen(true);
              }}
              onNavigateSend={() => setActiveTab('send')}
            />
          )}

          {/* TAB 3: Leak Investigation */}
          {activeTab === 'leak' && (
            <LeakInvestigationTab prefillImagePath={latestDecryptedPath} />
          )}

          {/* TAB 4: Ledger & Audit Chain */}
          {activeTab === 'ledger' && <LedgerTab />}
        </div>
      </main>

      {/* Clean Corporate Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            SANKET — Enterprise Secure File Exchange with Non-Repudiable Attribution
          </p>
          <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500">
            <span>FastAPI Core: :8000</span>
            <span>•</span>
            <span>DCT-QIM Watermarking</span>
            <span>•</span>
            <span>Ed25519 Anchored Ledger</span>
          </div>
        </div>
      </footer>

      {/* Document Viewer Modal for Opened Received Files */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        documentData={openedDocument}
        currentUser={currentUser}
        onSimulateLeak={(imagePath) => {
          setLatestDecryptedPath(imagePath);
          setActiveTab('leak');
        }}
      />

      {/* 1-Click Complete Flow Demo Modal */}
      <DemoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />

      {/* Story Mode Guide */}
      <StoryModeModal isOpen={isStoryOpen} onClose={() => setIsStoryOpen(false)} />

      {/* Connection Settings */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={fetchStatus}
      />
    </div>
  );
}
