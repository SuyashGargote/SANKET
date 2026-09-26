import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Send,
  Inbox,
  Unlock,
  Search,
  Server,
  Play,
  Shield,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { api, getActiveUser, setActiveUser } from './api/client';
import IdentityScreen from './components/workflow/IdentityScreen';
import SendScreen from './components/workflow/SendScreen';
import InboxScreen from './components/workflow/InboxScreen';
import DecryptScreen from './components/workflow/DecryptScreen';
import LeakVerifyScreen from './components/workflow/LeakVerifyScreen';
import LedgerScreen from './components/workflow/LedgerScreen';
import DemoFlowModal from './components/workflow/DemoFlowModal';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [currentUser, setCurrentUserState] = useState(getActiveUser());
  const [users, setUsers] = useState([
    {
      user_id: 'alice',
      name: 'Alice Smith (Intelligence Officer)',
      role: 'Sender / Intelligence Officer',
      public_key: 'Loading...',
      kem_public_key: 'Loading...',
    },
    {
      user_id: 'bob',
      name: 'Bob Jones (Field Operative)',
      role: 'Recipient / Field Operative',
      public_key: 'Loading...',
      kem_public_key: 'Loading...',
    },
    {
      user_id: 'charlie',
      name: 'Charlie Davis (Forensic Auditor)',
      role: 'Auditor / Validator',
      public_key: 'Loading...',
      kem_public_key: 'Loading...',
    },
  ]);

  const [systemStatus, setSystemStatus] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [prefillImagePath, setPrefillImagePath] = useState(null);

  // Modals
  const [isDemoFlowOpen, setIsDemoFlowOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      if (data?.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const data = await api.getStatus();
      setSystemStatus(data);
      setIsOnline(true);
    } catch (err) {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectUser = async (userId) => {
    try {
      await api.login(userId);
      setActiveUser(userId);
      setCurrentUserState(userId);
      fetchUsers();
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  // 6 Required Workflow Screens (Part 6)
  const screens = [
    { id: 'identity', label: '1. Identity & Login', icon: UserCheck },
    { id: 'send', label: '2. Send Document', icon: Send },
    { id: 'inbox', label: '3. Inbox', icon: Inbox },
    { id: 'decrypt', label: '4. Decrypt & Watermark', icon: Unlock },
    { id: 'leak', label: '5. Leak Verification', icon: Search },
    { id: 'ledger', label: '6. Ledger Viewer', icon: Server },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100 font-sans selection:bg-blue-500/30 selection:text-blue-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & System Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-blue-500/20">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-wide">
                  SANKET
                </h1>
                <span className="text-[10px] font-mono uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-2 py-0.2 rounded font-semibold">
                  PQC Kyber-768 + Dilithium-3
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Secure Document Distribution & Cryptographic Attribution
              </p>
            </div>
          </div>

          {/* User Identity Selector & Actions */}
          <div className="flex items-center gap-3">
            {/* Active User Switcher */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] text-slate-400 hidden sm:inline">Active User:</span>
              <select
                value={currentUser}
                onChange={(e) => handleSelectUser(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
              >
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id} className="bg-slate-900 text-white">
                    {u.name} (@{u.user_id})
                  </option>
                ))}
              </select>
            </div>

            {/* 1-Click Interactive Demo Flow Button (Part 7) */}
            <button
              onClick={() => setIsDemoFlowOpen(true)}
              className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Demo Flow (Part 7)</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
              title="Connection Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Workflow Navigation Tabs (The 6 Required Screens) */}
        <div className="flex items-center space-x-1 sm:space-x-2 border-b border-slate-800 overflow-x-auto pb-1 scrollbar-none">
          {screens.map((screen) => {
            const Icon = screen.icon;
            const isActive = activeTab === screen.id;

            return (
              <button
                key={screen.id}
                onClick={() => setActiveTab(screen.id)}
                className={`relative flex items-center space-x-2 py-3 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
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
                <span>{screen.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <div className="py-2">
          {/* SCREEN 1: Login / Identity selection */}
          {activeTab === 'identity' && (
            <IdentityScreen
              users={users}
              currentUser={currentUser}
              onSelectUser={handleSelectUser}
            />
          )}

          {/* SCREEN 2: Send Document */}
          {activeTab === 'send' && (
            <SendScreen
              currentUser={currentUser}
              users={users}
              onDocumentSent={(doc) => {
                setSelectedDocument(doc);
              }}
              onNavigateInbox={() => setActiveTab('inbox')}
            />
          )}

          {/* SCREEN 3: Inbox */}
          {activeTab === 'inbox' && (
            <InboxScreen
              currentUser={currentUser}
              onSelectDocumentForDecrypt={(doc) => {
                setSelectedDocument(doc);
                setActiveTab('decrypt');
              }}
              onNavigateSend={() => setActiveTab('send')}
            />
          )}

          {/* SCREEN 4: Decrypt & Watermark */}
          {activeTab === 'decrypt' && (
            <DecryptScreen
              currentUser={currentUser}
              selectedDocument={selectedDocument}
              onSimulateLeak={(imagePath) => {
                setPrefillImagePath(imagePath);
                setActiveTab('leak');
              }}
            />
          )}

          {/* SCREEN 5: Leak Verification */}
          {activeTab === 'leak' && (
            <LeakVerifyScreen prefillImagePath={prefillImagePath} />
          )}

          {/* SCREEN 6: Ledger Viewer */}
          {activeTab === 'ledger' && <LedgerScreen />}
        </div>
      </main>

      {/* Corporate Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-3.5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            SANKET — Post-Quantum Document Distribution & Non-Repudiable Attribution
          </p>
          <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500">
            <span>FastAPI Core: :8000</span>
            <span>•</span>
            <span>ML-KEM-768</span>
            <span>•</span>
            <span>ML-DSA-65 Dual-Signatures</span>
            <span>•</span>
            <span>DCT-QIM Watermarking</span>
          </div>
        </div>
      </footer>

      {/* 8-Stage Interactive Demo Flow Modal (Part 7) */}
      <DemoFlowModal
        isOpen={isDemoFlowOpen}
        onClose={() => setIsDemoFlowOpen(false)}
        onRefreshData={() => {
          fetchStatus();
          fetchUsers();
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => {
          fetchStatus();
          fetchUsers();
        }}
      />
    </div>
  );
}
