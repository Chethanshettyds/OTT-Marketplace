import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface Session {
  _id: string;
  sessionId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  ipAddress: string;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
}

interface SessionsResponse {
  sessions: Session[];
  currentSessionId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function DeviceIcon({ type }: { type: Session['deviceType'] }) {
  const map = {
    mobile: { icon: 'pi-mobile', bg: 'bg-blue-500/15', border: 'border-blue-500/25', color: 'text-blue-400' },
    tablet: { icon: 'pi-tablet', bg: 'bg-violet-500/15', border: 'border-violet-500/25', color: 'text-violet-400' },
    desktop: { icon: 'pi-desktop', bg: 'bg-indigo-500/15', border: 'border-indigo-500/25', color: 'text-indigo-400' },
    unknown: { icon: 'pi-question-circle', bg: 'bg-white/5', border: 'border-white/10', color: 'text-white/30' },
  };
  const s = map[type] ?? map.unknown;
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${s.bg} ${s.border}`}>
      <i className={`pi ${s.icon} text-lg ${s.color}`} />
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  message, onConfirm, onCancel, loading,
}: { message: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 8 }}
        transition={{ duration: 0.18 }}
        className="glass rounded-2xl border border-white/10 p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
            <i className="pi pi-exclamation-triangle text-red-400 text-base" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-1">Sign out device?</p>
            <p className="text-white/50 text-sm leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors rounded-xl border border-white/10 hover:border-white/20 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl border border-red-500/30 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            {loading && <i className="pi pi-spin pi-spinner text-xs" />}
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function YourDevices({ isAdmin = false }: { isAdmin?: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirm, setConfirm] = useState<{ type: 'single' | 'all'; sessionId?: string } | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await api.get<SessionsResponse>('/account/sessions');
      setSessions(data.sessions);
      setCurrentSessionId(data.currentSessionId);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleRevoke = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await api.post('/account/sessions/revoke', { sessionId });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      toast.success('Device signed out successfully');
    } catch {
      toast.error('Failed to sign out device');
    }
    setRevoking(null);
    setConfirm(null);
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await api.post('/account/sessions/revoke-others');
      setSessions((prev) => prev.filter((s) => s.sessionId === currentSessionId));
      toast.success('Signed out of all other devices');
    } catch {
      toast.error('Failed to sign out other devices');
    }
    setRevokingAll(false);
    setConfirm(null);
  };

  const otherCount = sessions.filter((s) => s.sessionId !== currentSessionId).length;

  return (
    <>
      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            message={
              confirm.type === 'all'
                ? `This will sign out ${otherCount} other device${otherCount > 1 ? 's' : ''}. They'll be logged out on their next request.`
                : 'This device will be logged out on its next request.'
            }
            onConfirm={() =>
              confirm.type === 'all' ? handleRevokeAll() : handleRevoke(confirm.sessionId!)
            }
            onCancel={() => setConfirm(null)}
            loading={revoking !== null || revokingAll}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl border border-white/10 overflow-hidden"
      >
        {/* Card header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <i className="pi pi-desktop text-indigo-400" />
            <h2 className="text-white font-semibold">
              Your devices{isAdmin ? <span className="ml-2 text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30 align-middle">Admin</span> : ''}
            </h2>
            {!loading && (
              <span className="text-white/30 text-xs ml-0.5">({sessions.length})</span>
            )}
          </div>
          {otherCount > 0 && (
            <button
              onClick={() => setConfirm({ type: 'all' })}
              disabled={revokingAll}
              className="flex items-center gap-1.5 text-xs font-medium text-red-400/60 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
            >
              {revokingAll
                ? <i className="pi pi-spin pi-spinner text-xs" />
                : <i className="pi pi-sign-out text-xs" />}
              Sign out all others
            </button>
          )}
        </div>

        {/* Sessions list */}
        <div className="divide-y divide-white/[0.06]">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="w-11 h-11 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-white/5 rounded-lg animate-pulse w-44" />
                  <div className="h-3 bg-white/5 rounded-lg animate-pulse w-28" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse flex-shrink-0" />
              </div>
            ))
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <i className="pi pi-desktop text-4xl mb-3 block opacity-40" />
              <p className="text-sm">No active sessions found</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {sessions.map((session) => {
                const isCurrent = session.sessionId === currentSessionId;
                const isBeingRevoked = revoking === session.sessionId;

                return (
                  <motion.div
                    key={session._id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8, height: 0, padding: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors duration-150
                      ${isCurrent ? 'bg-indigo-500/[0.04]' : 'hover:bg-white/[0.025]'}`}
                  >
                    {/* Device icon */}
                    <DeviceIcon type={session.deviceType} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-white font-medium text-sm leading-tight truncate max-w-[200px]">
                          {session.deviceName}
                        </p>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            Current session
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400/70 rounded-full border border-emerald-500/20 flex-shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {session.ipAddress && (
                          <span className="text-white/30 text-xs flex items-center gap-1">
                            <i className="pi pi-map-marker text-[10px]" />
                            {session.ipAddress}
                            {session.location ? ` · ${session.location}` : ''}
                          </span>
                        )}
                        <span className="text-white/30 text-xs flex items-center gap-1">
                          <i className="pi pi-clock text-[10px]" />
                          {timeAgo(session.lastActiveAt)}
                        </span>
                        <span className="text-white/20 text-xs hidden sm:block">
                          Signed in {new Date(session.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Delete / sign-out button — always visible, hidden only for current session */}
                    {isCurrent ? (
                      // Spacer so layout stays consistent
                      <div className="w-9 flex-shrink-0" />
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => setConfirm({ type: 'single', sessionId: session.sessionId })}
                        disabled={isBeingRevoked}
                        title="Sign out this device"
                        className={`
                          w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                          border transition-all duration-150
                          ${isBeingRevoked
                            ? 'bg-red-500/10 border-red-500/20 opacity-60 cursor-not-allowed'
                            : 'bg-white/5 border-white/10 hover:bg-red-500/15 hover:border-red-500/40 text-white/30 hover:text-red-400'
                          }
                        `}
                      >
                        {isBeingRevoked
                          ? <i className="pi pi-spin pi-spinner text-xs text-red-400" />
                          : <i className="pi pi-trash text-sm" />
                        }
                      </motion.button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Footer note */}
        {sessions.length > 0 && (
          <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.02]">
            <p className="text-white/25 text-xs">
              Signing out a device revokes its session — it will be logged out on its next request.
            </p>
          </div>
        )}
      </motion.div>
    </>
  );
}
