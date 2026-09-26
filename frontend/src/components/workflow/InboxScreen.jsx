import React, { useState, useEffect } from 'react';
import { Inbox, Lock, Unlock, ShieldAlert, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';

export default function InboxScreen({
  currentUser,
  onSelectDocumentForDecrypt,
  onNavigateSend,
}) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInbox = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getInbox(currentUser);
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch inbox documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, [currentUser]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-400" />
            Document Inbox — Logged in as: <span className="font-mono text-blue-400">@{currentUser}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authorized documents shared logically. Only authorized recipients can decrypt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInbox}
            disabled={isLoading}
            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onNavigateSend}
            className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm transition-all"
          >
            + Send Document
          </button>
        </div>
      </div>

      {/* Documents List */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          Loading inbox documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
          <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No Documents in Inbox</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No documents have been distributed to @{currentUser} yet. You can distribute a document from the Send tab.
          </p>
          <button
            onClick={onNavigateSend}
            className="mt-4 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
          >
            Send First Document
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Document</th>
                  <th className="py-3.5 px-4">Sender</th>
                  <th className="py-3.5 px-4">Recipients</th>
                  <th className="py-3.5 px-4">Authorization</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {documents.map((doc) => {
                  const canDecrypt = doc.can_decrypt;
                  const isSender = doc.is_sender;

                  return (
                    <tr
                      key={doc.document_id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-blue-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">
                              {doc.filename || 'Document.png'}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 truncate max-w-[180px]">
                              {doc.document_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        @{doc.sender}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {doc.recipients?.map((r) => (
                            <span
                              key={r}
                              className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                r === currentUser
                                  ? 'bg-blue-950 border border-blue-700 text-blue-300 font-bold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              @{r}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {canDecrypt ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                            <Unlock className="w-3 h-3" />
                            Authorized Recipient
                          </span>
                        ) : isSender ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3" />
                            Sender Record
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded-full">
                            <ShieldAlert className="w-3 h-3" />
                            Access Restricted
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {canDecrypt ? (
                          <button
                            onClick={() => onSelectDocumentForDecrypt(doc)}
                            className="py-1 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 ml-auto shadow-sm transition-all"
                          >
                            <span>Decrypt</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            {isSender ? 'Sent' : 'Unauthorized'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
