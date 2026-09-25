import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Send,
  FileText,
  Lock,
  Unlock,
  RefreshCw,
  Download,
  Eye,
  Clock,
  User,
  ShieldCheck,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { api } from '../api/client';

export default function MyFilesTab({
  currentUser = 'bob',
  onOpenDocument,
  onNavigateSend,
}) {
  const [subTab, setSubTab] = useState('received'); // 'received' | 'sent'
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openingPkg, setOpeningPkg] = useState(null);
  const [error, setError] = useState(null);

  const fetchPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSharedPackages();
      setPackages(res.packages || []);
    } catch (err) {
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [currentUser]);

  // Handle Open / Decrypt action
  const handleOpenDecrypt = async (pkg) => {
    setOpeningPkg(pkg.package_path);
    setError(null);
    try {
      const res = await api.decrypt(pkg.package_path, currentUser, true);
      const payload = res.data || res;
      if (onOpenDocument) {
        onOpenDocument(payload);
      }
    } catch (err) {
      setError(err.message || `Decryption failed for user ${currentUser.toUpperCase()}`);
    } finally {
      setOpeningPkg(null);
    }
  };

  // Determine sender and recipient logic
  const isAlice = currentUser.toLowerCase() === 'alice';
  const otherUser = isAlice ? 'bob' : 'alice';

  // Filter into Received and Sent
  const receivedFiles = packages.filter((p) => {
    // If user is in recipients, it is received
    return p.recipients && p.recipients.map((r) => r.toLowerCase()).includes(currentUser.toLowerCase());
  });

  const sentFiles = packages.filter((p) => {
    // Files sent by this user to others
    return p.recipients && p.recipients.map((r) => r.toLowerCase()).includes(otherUser.toLowerCase());
  });

  const displayedFiles = subTab === 'received' ? receivedFiles : sentFiles;

  return (
    <div className="space-y-5">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            My Files
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Encrypted secure repository for <strong className="text-white uppercase">{currentUser}</strong>. Access is restricted and decryptions are watermarked.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Refresh button */}
          <button
            type="button"
            onClick={fetchPackages}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh Files"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>

          {/* Send File Shortcut */}
          {onNavigateSend && (
            <button
              type="button"
              onClick={onNavigateSend}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Send New File</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs: Received Files vs Sent Files */}
      <div className="flex items-center space-x-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setSubTab('received')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
            subTab === 'received'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Received Files</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {receivedFiles.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('sent')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
            subTab === 'sent'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Sent Files</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {sentFiles.length}
          </span>
        </button>
      </div>

      {/* Files List / Table */}
      {displayedFiles.length === 0 ? (
        <div className="panel rounded-xl p-10 text-center space-y-3 border border-dashed border-slate-800">
          <div className="p-3 rounded-xl bg-slate-900 text-slate-500 inline-block">
            {subTab === 'received' ? <Inbox className="w-8 h-8" /> : <Send className="w-8 h-8" />}
          </div>
          <p className="text-sm font-semibold text-slate-300">
            {subTab === 'received' ? 'No received files yet' : 'No sent files yet'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {subTab === 'received'
              ? `When other users (like ${otherUser.toUpperCase()}) send files to you, they will appear here.`
              : 'Files you send to other users will be listed here with delivery receipts.'}
          </p>
          {onNavigateSend && subTab === 'sent' && (
            <button
              onClick={onNavigateSend}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm inline-block"
            >
              Send File Now
            </button>
          )}
        </div>
      ) : (
        <div className="panel rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80">
          {displayedFiles.map((pkg) => {
            const isOpening = openingPkg === pkg.package_path;
            const senderName = subTab === 'received' ? otherUser : `You (${currentUser})`;
            const recipientList = pkg.recipients || [];

            return (
              <div
                key={pkg.package_path}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/50 transition-colors"
              >
                {/* File Info */}
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-semibold text-white">
                        {pkg.original_filename || pkg.package_name}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                        AES-256
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center space-x-1">
                        <span className="text-slate-500">From:</span>
                        <strong className="text-slate-300 uppercase">{senderName}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <span className="text-slate-500">To:</span>
                        <span className="text-slate-300 font-mono">
                          {recipientList.join(', ') || 'Authorized team'}
                        </span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1 text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>
                          {pkg.created_at ? new Date(pkg.created_at).toLocaleString() : 'Recent'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 self-start md:self-auto shrink-0">
                  {subTab === 'received' ? (
                    <button
                      type="button"
                      onClick={() => handleOpenDecrypt(pkg)}
                      disabled={isOpening}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isOpening ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Decrypting & Watermarking...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Open / Decrypt</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <a
                      href={api.getDownloadUrl('encrypted', pkg.package_name)}
                      download={`${pkg.package_name}.zip`}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Archive</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
