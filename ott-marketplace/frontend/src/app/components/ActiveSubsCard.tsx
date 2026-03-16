import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { differenceInDays, differenceInHours, differenceInMinutes, format } from 'date-fns';
import api from '../utils/api';

export interface Subscription {
  _id: string;
  productName: string;
  platform: string;
  duration: string;
  durationDays: number;
  startDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'cancelled';
}

interface Props {
  onClick: () => void;
  subs: Subscription[];
  count: number;
  loading: boolean;
}

function getProgress(sub: Subscription): number {
  const total = new Date(sub.expiryDate).getTime() - new Date(sub.startDate).getTime();
  const elapsed = Date.now() - new Date(sub.startDate).getTime();
  const remaining = Math.max(0, 1 - elapsed / total);
  return Math.round(remaining * 100);
}

function LiveCountdown({ expiryDate }: { expiryDate: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const expiry = new Date(expiryDate);
  const now = new Date();
  const days = differenceInDays(expiry, now);
  const hours = differenceInHours(expiry, now) % 24;
  const mins = differenceInMinutes(expiry, now) % 60;

  if (days < 0) return <span className="text-red-400 text-xs font-mono">Expired</span>;
  if (days === 0) return <span className="text-orange-400 text-xs font-mono">{hours}h {mins}m left</span>;
  return <span className="text-emerald-400 text-xs font-mono">{days}d {hours}h left</span>;
}

export default function ActiveSubsCard({ onClick, subs, count, loading }: Props) {
  const activeSubs = subs.filter((s) => s.status === 'active');
  const preview = activeSubs.slice(0, 2);

  return (
    <motion.div
      onClick={onClick}
      className="group cursor-pointer bg-gradient-to-br from-violet-500/20 to-purple-600/20 backdrop-blur-xl border border-violet-500/30 p-5 rounded-3xl hover:shadow-2xl hover:shadow-violet-500/30 hover:-translate-y-1 transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            🎬 Active Subscriptions
          </h3>
          <p className="text-violet-300 text-xs mt-0.5">
            {loading ? 'Loading...' : `${count} Active`}
          </p>
        </div>
        <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <span className="text-white font-black text-sm">{loading ? '…' : count}</span>
        </div>
      </div>

      {/* Sub previews */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : preview.length === 0 ? (
        <div className="text-center py-4 text-white/30 text-sm">
          <span className="text-2xl block mb-1">😢</span>
          No active subscriptions
        </div>
      ) : (
        <div className="space-y-2">
          {preview.map((sub) => {
            const progress = getProgress(sub);
            const progressColor =
              progress > 50 ? 'from-emerald-400 to-teal-500' :
              progress > 20 ? 'from-yellow-400 to-orange-400' :
              'from-red-400 to-rose-500';
            return (
              <div key={sub._id} className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-white text-sm font-semibold truncate max-w-[140px]">{sub.productName}</span>
                  <span className="text-white/50 text-xs">{format(new Date(sub.expiryDate), 'd MMM')}</span>
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    LIVE
                  </span>
                  <LiveCountdown expiryDate={sub.expiryDate} />
                </div>
                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                  <div
                    className={`bg-gradient-to-r ${progressColor} h-1 rounded-full transition-all duration-500`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
          {activeSubs.length > 2 && (
            <p className="text-violet-300 text-xs text-center pt-1">+{activeSubs.length - 2} more...</p>
          )}
        </div>
      )}

      {/* Footer CTA */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-violet-300 text-xs group-hover:text-violet-200 transition-colors">
        <span>➕ Manage Subscriptions</span>
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </motion.div>
  );
}
