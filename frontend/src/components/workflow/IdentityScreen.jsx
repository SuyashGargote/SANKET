import React from 'react';
import { UserCheck, Key, ShieldCheck, CheckCircle2, User } from 'lucide-react';

export default function IdentityScreen({
  users,
  currentUser,
  onSelectUser,
  isLoading,
}) {
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-400" />
              User Identity & Cryptographic Binding
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select active identity. Decryption strictly enforces local private key authorization — manual overrides are prevented.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-blue-950/60 border border-blue-800/60 px-3 py-1.5 rounded-lg text-xs font-mono text-blue-300">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Active: <strong className="text-white uppercase">{currentUser}</strong></span>
          </div>
        </div>
      </div>

      {/* Identity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {users.map((u) => {
          const isActive = currentUser === u.user_id;

          return (
            <div
              key={u.user_id}
              className={`rounded-xl border p-5 transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-900/90 border-blue-500 shadow-md shadow-blue-500/10'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {u.user_id.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{u.name}</h3>
                      <span className="text-[11px] font-mono text-slate-400">@{u.user_id}</span>
                    </div>
                  </div>
                  {isActive && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-blue-400 bg-blue-950/80 border border-blue-800/80 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active
                    </span>
                  )}
                </div>

                <div className="space-y-2 mt-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px]">Role:</span>
                    <p className="text-slate-200 font-medium">{u.role}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Key className="w-3 h-3 text-slate-400" />
                      Post-Quantum Dilithium (ML-DSA-65) Public Key:
                    </span>
                    <p className="font-mono text-[11px] text-slate-300 bg-slate-950/80 border border-slate-800/80 px-2 py-1 rounded truncate">
                      {u.public_key || 'Generated on disk'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Key className="w-3 h-3 text-slate-400" />
                      Post-Quantum Kyber (ML-KEM-768) Public Key:
                    </span>
                    <p className="font-mono text-[11px] text-slate-300 bg-slate-950/80 border border-slate-800/80 px-2 py-1 rounded truncate">
                      {u.kem_public_key || 'Generated on disk'}
                    </p>
                  </div>

                  <div className="pt-1">
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Private Keys: <span className="font-mono text-slate-300">data/keys/{u.user_id}/</span> (Protected)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80">
                <button
                  onClick={() => onSelectUser(u.user_id)}
                  disabled={isActive || isLoading}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 cursor-default'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  }`}
                >
                  {isActive ? 'Currently Logged In' : `Switch to ${u.name.split(' ')[0]}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
