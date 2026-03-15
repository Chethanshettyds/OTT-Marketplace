import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface Broadcast {
  _id: string;
  subject: string;
  message: string;
  adminName: string;
  sentAt: string;
  template: string | null;
  isRead: boolean;
}

const templateColor: Record<string, string> = {
  promo:       'from-green-500 to-emerald-500',
  maintenance: 'from-yellow-500 to-orange-500',
  update:      'from-blue-500 to-indigo-500',
  alert:       'from-red-500 to-pink-500',
};

let socket: Socket | null = null;

export default function BroadcastsPage() {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchBroadcasts();

    socket = io('/', { path: '/socket.io', transports: ['websocket'] });
    socket.emit('join_user', { userId: user?._id });

    socket.on('broadcast', (data: Broadcast) => {
      setBroadcasts((prev) => [{ ...data, isRead: false }, ...prev]);
      toast(`📢 ${data.subject}`, { icon: '📢' });
    });

    return () => { socket?.disconnect(); };
  }, []);

  const fetchBroadcasts = async () => {
    try {
      const { data } = await api.get('/broadcast/my/inbox');
      setBroadcasts(data.broadcasts);
    } catch {
      toast.error('Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    setBroadcasts((prev) => prev.map((b) => b._id === id ? { ...b, isRead: true } : b));
    try { await api.post(`/broadcast/${id}/read`); } catch { /* ignore */ }
  };

  const handleExpand = (id: string) => {
    setExpanded(expanded === id ? null : id);
    const b = broadcasts.find((x) => x._id === id);
    if (b && !b.isRead) markRead(id);
  };

  const unreadCount = broadcasts.filter((b) => !b.isRead).length;

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-10">
      <div className="max-w-3xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xl">
              📢
            </div>
            <div>
              <h1 className="text-white font-bold text-2xl flex items-center gap-2">
                Broadcasts
                {unreadCount > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-orange-500 text-white rounded-full font-bold">
                    {unreadCount} new
                  </span>
                )}
              </h1>
              <p className="text-white/40 text-sm">Messages from the OTT Market team</p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-lg">No broadcasts yet</p>
            <p className="text-sm mt-1">Admin messages will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((b, i) => {
              const gradKey = b.template || 'update';
              const grad = templateColor[gradKey] || 'from-indigo-500 to-purple-600';
              const isOpen = expanded === b._id;
              return (
                <motion.div
                  key={b._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`glass rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
                    !b.isRead ? 'border-orange-500/30' : 'border-white/10'
                  }`}
                  onClick={() => handleExpand(b._id)}
                >
                  <div className="flex items-start gap-4 p-5">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {b.adminName?.[0]?.toUpperCase() || 'A'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`font-semibold text-sm ${!b.isRead ? 'text-white' : 'text-white/80'}`}>
                          {b.subject}
                        </p>
                        {!b.isRead && (
                          <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-white/40 text-xs">
                        {b.adminName} (Admin) · {new Date(b.sentAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {!isOpen && (
                        <p className="text-white/50 text-sm mt-1.5 line-clamp-1">{b.message}</p>
                      )}
                    </div>

                    <i className={`pi pi-chevron-${isOpen ? 'up' : 'down'} text-white/30 text-xs flex-shrink-0 mt-1`} />
                  </div>

                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-5 pb-5"
                    >
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{b.message}</p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
