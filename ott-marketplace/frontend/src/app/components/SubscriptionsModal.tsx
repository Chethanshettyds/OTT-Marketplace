import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInDays, differenceInHours, differenceInMinutes, format } from 'date-fns';
import { X, RefreshCw, StopCircle, ShoppingBag, TrendingUp } from 'lucide-react';
import type { Subscription } from './ActiveSubsCard';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subs: Subscription[];
  onRefresh: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    expired: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  const icons: Record<string, string> = { active: '🟢', expired: '🔴', cancelled: '🟡' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] || map.expired}`}>
      {icons[status]} {status.toUpperCase()}
    </span>
  );
}

function CountdownCell({ expiryDate, status }: { expiryDate: string; status: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (status !== 'active') return <span className="text-white/30 text-xs">—</span>;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const days = differenceInDays(expiry, now);
  const hours = differenceInHours(expiry, now) % 24;
  const mins = differenceInMinutes(expiry, now) % 60;
  if (days < 0) return <span className="text-red-400 text-xs font-mono">Expired</span>;
  if (days === 0) return <span className="text-orange-400 text-xs font-mono">{hours}h {mins}m</span>;
  return <span className="text-emerald-400 text-xs font-mono">{days}d {hours}h</span>;
}

function ProgressBar({ sub }: { sub: Subscription }) {
  if (sub.status !== 'active') return null;
  const total = new Date(sub.expiryDate).getTime() - new Date(sub.startDate).getTime();
  const elapsed = Date.now() - new Date(sub.startDate).getTime();
  const pct = Math.max(0, Math.round((1 - elapsed / total) * 100));
  const color = pct > 50 ? 'from-emerald-400 to-teal-500' : pct > 20 ? 'from-yellow-400 to-orange-400' : 'from-red-400 to-rose-500';
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-xs text-white/40 mb-1">
        <span>{pct}% remaining</span>
        <span>{format(new Date(sub.expiryDate), 'd MMM yyyy')}</span>
      </div>
      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
        <div className={`bg-gradient-to-r ${color} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SubscriptionsModal({ isOpen, onClose, subs, onRefresh }: Props) {
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'cancelled'>('all');

  const filtered = filter === 'all' ? subs : subs.filter((s) => s.status === filter);
  const counts = {
    all: subs.length,
    active: subs.filter((s) => s.status === 'active').length,
    expired: subs.filter((s) => s.status === 'expired').length,
    cancelled: subs.filter((s) => s.status === 'cancelled').length,
  };

  const handleCancel = async (subId: string) => {
    if (!confirm('Cancel this subscription?')) return;
    setCancelling(subId);
    try {
      await api.patch(`/user/subscriptions/${subId}/cancel`);
      toast.success('Subscription cancelled');
      onRefresh();
    } catch {
      toast.error('Failed to cancel');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-3xl glass rounded-3xl border border-white/10 overflow-hidden"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-white font-bold text-xl flex items-center gap-2">
                  🎬 Subscription Management
                </h2>
                <p className="text-white/40 text-sm mt-0.5">{counts.active} active · {counts.expired} expired</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onRefresh}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                  title="Refresh"
                >
                  <RefreshCw size={16} />
                </button>
                <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 p-4 pb-0">
              {(['all', 'active', 'expired', 'cancelled'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filter === f ? 'bg-violet-500 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-white/30">
                  <span className="text-4xl block mb-3">😢</span>
                  <p className="text-sm">No subscriptions found</p>
                  <a href="/shop" className="text-violet-400 text-sm mt-2 inline-block hover:text-violet-300">
                    Browse subscriptions →
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((sub) => (
                    <motion.div
                      key={sub._id}
                      layout
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-white font-semibold truncate">{sub.productName}</span>
                            <StatusBadge status={sub.status} />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-white/40">
                            {sub.platform && <span>📺 {sub.platform}</span>}
                            <span>⏱ {sub.duration}</span>
                            <span>Started {format(new Date(sub.startDate), 'd MMM yyyy')}</span>
                          </div>
                          <ProgressBar sub={sub} />
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <CountdownCell expiryDate={sub.expiryDate} status={sub.status} />
                          <div className="flex gap-2">
                            {sub.status === 'active' && (
                              <button
                                onClick={() => handleCancel(sub._id)}
                                disabled={cancelling === sub._id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-all border border-red-500/20 disabled:opacity-50"
                              >
                                <StopCircle size={12} />
                                {cancelling === sub._id ? 'Cancelling...' : 'Cancel'}
                              </button>
                            )}
                            {(sub.status === 'expired' || sub.status === 'cancelled') && (
                              <a
                                href="/shop"
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-medium transition-all border border-violet-500/20"
                              >
                                <RefreshCw size={12} />
                                Renew
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <TrendingUp size={14} />
                <span>{counts.active} active subscription{counts.active !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href="/shop"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-sm font-medium transition-all border border-violet-500/30"
                >
                  <ShoppingBag size={14} />
                  Add New
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
