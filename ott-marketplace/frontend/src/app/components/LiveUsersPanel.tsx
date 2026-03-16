import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';

export interface OnlineUser {
  userId: string;
  name: string;
  email: string;
  page: string;
  lastSeen: string;
  lastSeenMs: number;
  status: 'active' | 'idle' | 'offline';
}

interface Props {
  onUsersChange?: (users: OnlineUser[]) => void;
  externalUsers?: OnlineUser[];
}

function pageLabel(path: string) {
  if (path.startsWith('/shop')) return '🛒 Shop';
  if (path.startsWith('/checkout')) return '💳 Checkout';
  if (path.startsWith('/dashboard')) return '📊 Dashboard';
  if (path.startsWith('/tickets')) return '🎫 Support';
  if (path.startsWith('/broadcasts')) return '📢 Broadcasts';
  if (path.startsWith('/settings')) return '⚙️ Settings';
  return '🏠 Home';
}

function timeAgo(ms: number) {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3600_000)}h ago`;
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-400',
  idle: 'bg-yellow-400',
  offline: 'bg-gray-500',
};

let panelSocket: Socket | null = null;

export default function LiveUsersPanel({ onUsersChange, externalUsers }: Props) {
  const [internalUsers, setInternalUsers] = useState<OnlineUser[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  // Use external users if provided (parent manages socket), else own socket
  const users = externalUsers ?? internalUsers;

  useEffect(() => {
    if (externalUsers) return; // parent handles socket
    if (!panelSocket) {
      panelSocket = io('/', { path: '/socket.io', transports: ['websocket'] });
    }
    panelSocket.emit('join_admin');
    panelSocket.on('online_users_update', ({ users: u }: { users: OnlineUser[]; count: number }) => {
      setInternalUsers(u);
      onUsersChange?.(u);
    });
    return () => {
      panelSocket?.off('online_users_update');
    };
  }, []);

  const active = users.filter((u) => u.status === 'active').length;
  const idle = users.filter((u) => u.status === 'idle').length;

  return (
    <div className="glass rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <i className="pi pi-eye text-white text-sm" />
            </div>
            {users.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-black animate-pulse" />
            )}
          </div>
          <div className="text-left">
            <p className="text-white font-semibold text-sm">Live Users</p>
            <p className="text-white/40 text-xs">
              {users.length} online · {active} active · {idle} idle
            </p>
          </div>
        </div>
        <motion.i
          className="pi pi-chevron-down text-white/30 text-xs"
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ duration: 0.2 }}
        />
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {users.length === 0 ? (
              <div className="px-5 pb-5 text-center text-white/30 text-sm py-6">
                <div className="text-3xl mb-2">👻</div>
                No users online right now
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1 max-h-72 overflow-y-auto">
                <AnimatePresence>
                  {users.map((u) => (
                    <motion.div
                      key={u.userId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      {/* Avatar + status dot */}
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{u.name?.[0]?.toUpperCase()}</span>
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black ${STATUS_DOT[u.status]}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{u.name}</p>
                        <p className="text-white/40 text-xs truncate">{pageLabel(u.page)}</p>
                      </div>

                      <span className="text-white/30 text-xs flex-shrink-0">{timeAgo(u.lastSeenMs)}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Footer stats */}
            <div className="border-t border-white/10 px-5 py-3 flex items-center gap-4 text-xs text-white/30">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" /> Active
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400" /> Idle (&gt;5m)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-500" /> Offline (&gt;15m)
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
