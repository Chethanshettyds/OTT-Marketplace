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
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function DeviceIcon({ type }: { type: Session['deviceType'] }) {
  const icon =
    type === 'mobile' ? 'pi-mobile' :
    type === 'tablet' ? 'pi-tablet' :
    type === 'desktop' ? 'pi-desktop' : 'pi-question-circle';
  return <i className={`pi ${icon} text-lg text-indigo-400`} />;
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  message, onConfirm, onCancel, loading,
}: { message: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="glass rounded-2xl border border-white/10 p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <i className="pi pi-exclamation-triangle text-red-400" />
          </div>
          <p className="text-white/80 text-sm leading-relaxed pt-1">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors rounded-lg border border-white/10 hover:border-white/20">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/30 transition-colors flex items-center gap-2">
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
  const [revoking, setRevoking] = useState<string | null>(null); // sessionId being revoked
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
      toast.success('Signed out from that device');
    } catch {
      toast.error('Failed to sign out');
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
                ? `Sign out of all ${otherCount} other device${otherCount > 1 ? 's' : ''}? They will be logged out on their next request.`
                : 'Sign out from this device? It will be logged out on its next request.'
            }
            onConfirm={() =>
              confirm.type === 'all'
                ? handleRevokeAll()
                : handleRevoke(confirm.sessionId!)
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
          <div className="flex items-center gap-2">
            <i className="pi pi-desktop text-indigo-400" />
            <h2 className="text-white font-semibold">
              Your devices{isAdmin ? ' (Admin account)' : ''}
            </h2>
            {!loading && (
              <span className="text-white/30 text-xs">({sessions.length})</span>
            )}
          </div>
          {otherCount > 0 && (
            <button
              onClick={() => setConfirm({ type: 'all' })}
              disabled={revokingAll}
              className="text-xs text-red-400/70 hover:text-red-400 font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <i className="pi pi-sign-out text-xs" />
              Sign out all other devices
            </button>
          )}
        </div>

        {/* Sessions list */}
        <div className="divide-y divide-white/5">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-white/5 rounded animate-pulse w-48" />
                  <div className="h-3 bg-white/5 rounded animate-pulse w-32" />
                </div>
              </div>
            ))
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-white/30">
              <i className="pi pi-desktop text-4xl mb-3 block" />
              <p className="text-sm">No active sessions found</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isCurrent = session.sessionId === currentSessionId;
              const isRevoking = revoking === session.sessionId;
              return (
                <motion.div
                  key={session._id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center gap-4 p-4 transition-all duration-200 group
                    ${!isCurrent ? 'hover:bg-white/[0.03] hover:border-l-2 hover:border-l-indigo-500/40' : ''}`}
                >
                  {/* Device icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isCurrent ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-white/5 border border-white/10'}`}>
                    <DeviceIcon type={session.deviceType} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium text-sm truncate">{session.deviceName}</p>
                      {isCurrent ? (
                        <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30 flex-shrink-0">
                          Current session
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400/70 rounded-full border border-emerald-500/20 flex-shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {session.ipAddress && (
                        <span className="text-white/30 text-xs flex items-center gap-1">
                          <i className="pi pi-map-marker text-xs" />
                          {session.ipAddress}
                          {session.location ? ` · ${session.location}` : ''}
                        </span>
                      )}
                      <span className="text-white/30 text-xs flex items-center gap-1">
                        <i className="pi pi-clock text-xs" />
                        {timeAgo(session.lastActiveAt)}
                      </span>
                      <span className="text-white/20 text-xs hidden sm:block">
                        Signed in {new Date(session.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Sign out button — hidden for current session */}
                  {!isCurrent && (
                    <button
                      onClick={() => setConfirm({ type: 'single', sessionId: session.sessionId })}
                      disabled={isRevoking}
                      className="text-xs text-white/30 hover:text-red-400 transition-colors flex-shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 disabled:opacity-40"
                    >
                      {isRevoking
                        ? <i className="pi pi-spin pi-spinner text-xs" />
                        : <i className="pi pi-sign-out text-xs" />}
                      <span className="hidden sm:inline">Sign out</span>
                    </button>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </>
  );
}
