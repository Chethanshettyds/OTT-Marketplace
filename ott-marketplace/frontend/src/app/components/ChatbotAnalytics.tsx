import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

interface TopicStat { topic: string; count: number }
interface RecentQuery { topic: string; query: string; ts: string }
interface AnalyticsData {
  totalQueries: number; escalations: number; resolvedByBot: number;
  resolutionRate: number; topTopics: TopicStat[]; recentQueries: RecentQuery[];
}
interface DayData {
  date: string; label: string; total: number; resolved: number; escalations: number;
}
interface PeriodStats {
  total: number; resolved: number; escalations: number; resolutionRate: number;
}
interface DailyData {
  days7: DayData[];
  periods: { last7: PeriodStats; last30: PeriodStats; last365: PeriodStats };
}

type Period = '7d' | '30d' | '365d';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d',   label: 'Last 7 Days' },
  { value: '30d',  label: 'Last 30 Days' },
  { value: '365d', label: 'Last 365 Days' },
];

const TOPIC_ICONS: Record<string, string> = {
  order: '📦', wallet: '💳', subscription: '📺', refund: '💰',
  account: '🔐', escalation: '🆘', pricing: '💎', bug: '🐛',
  order_lookup: '🔍', general: '💬',
};
const TOPIC_COLORS: Record<string, string> = {
  order: 'from-blue-500 to-blue-600', wallet: 'from-green-500 to-green-600',
  subscription: 'from-purple-500 to-purple-600', refund: 'from-yellow-500 to-yellow-600',
  account: 'from-indigo-500 to-indigo-600', escalation: 'from-red-500 to-red-600',
  pricing: 'from-pink-500 to-pink-600', bug: 'from-orange-500 to-orange-600',
  order_lookup: 'from-cyan-500 to-cyan-600', general: 'from-slate-500 to-slate-600',
};

export default function ChatbotAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('7d');
  const [showPeriodDrop, setShowPeriodDrop] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [r1, r2] = await Promise.all([
        api.get('/chatbot/analytics'),
        api.get('/chatbot/analytics/daily'),
      ]);
      setData(r1.data);
      setDaily(r2.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load analytics');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const periodStats: PeriodStats | null = daily
    ? period === '7d' ? daily.periods.last7
    : period === '30d' ? daily.periods.last30
    : daily.periods.last365
    : null;

  const days7 = daily?.days7 ?? [];
  const chartMax = Math.max(...days7.map((d) => d.total), 1);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="glass rounded-2xl p-8 text-center border border-red-500/20">
      <p className="text-red-400 mb-3">{error}</p>
      <button onClick={fetchAll} className="btn-primary text-sm px-4 py-2">Retry</button>
    </div>
  );

  if (!data || !daily) return null;

  const maxCount = data.topTopics[0]?.count || 1;
  const selectedLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🤖 AI Chatbot Analytics
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Real-time support query insights</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodDrop((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              <i className="pi pi-calendar text-indigo-400 text-xs" />
              {selectedLabel}
              <i className={`pi pi-chevron-down text-xs transition-transform ${showPeriodDrop ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showPeriodDrop && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-white/10 overflow-hidden z-20"
                  style={{ background: '#1a1d2e' }}
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <button key={opt.value}
                      onClick={() => { setPeriod(opt.value); setShowPeriodDrop(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                        period === opt.value
                          ? 'text-indigo-400 bg-indigo-500/15'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}>
                      {opt.label}
                      {period === opt.value && <i className="pi pi-check text-xs text-indigo-400" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <i className="pi pi-refresh text-xs" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Period Summary Cards ── */}
      <AnimatePresence mode="wait">
        <motion.div key={period} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Queries', value: periodStats?.total ?? 0, icon: '💬', color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/20', sub: selectedLabel },
            { label: 'Resolved by Bot', value: periodStats?.resolved ?? 0, icon: '✅', color: 'from-green-500/20 to-green-600/10', border: 'border-green-500/20', sub: selectedLabel },
            { label: 'Escalations', value: periodStats?.escalations ?? 0, icon: '🆘', color: 'from-red-500/20 to-red-600/10', border: 'border-red-500/20', sub: selectedLabel },
            { label: 'Resolution Rate', value: `${periodStats?.resolutionRate ?? 0}%`, icon: '📊', color: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/20', sub: selectedLabel },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`glass rounded-xl p-4 border ${stat.border} bg-gradient-to-br ${stat.color}`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-white/50 mt-0.5">{stat.label}</div>
              <div className="text-[10px] text-white/25 mt-0.5">{stat.sub}</div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* ── Daily Chart (always shows last 7 days) ── */}
      <div className="glass rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <i className="pi pi-chart-bar text-indigo-400" /> Daily Query Breakdown
            </h3>
            <p className="text-white/30 text-xs mt-0.5">Last 7 days — queries vs resolved</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />Total</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Resolved</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Escalated</span>
          </div>
        </div>

        {days7.every((d) => d.total === 0) ? (
          <div className="text-center py-12 text-white/25">
            <i className="pi pi-chart-bar text-4xl mb-3 block opacity-30" />
            <p className="text-sm">No query data for the last 7 days</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {days7.map((day, i) => {
              const totalH = chartMax > 0 ? (day.total / chartMax) * 100 : 0;
              const resolvedH = day.total > 0 ? (day.resolved / day.total) * totalH : 0;
              const escalH = day.total > 0 ? (day.escalations / day.total) * totalH : 0;
              return (
                <motion.div key={day.date} className="flex-1 flex flex-col items-center gap-1 group"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute -translate-y-full mb-2 z-10">
                    <div className="px-3 py-2 rounded-xl text-xs text-white whitespace-nowrap shadow-xl border border-white/10"
                      style={{ background: '#1a1d2e' }}>
                      <p className="font-semibold mb-1">{day.label}</p>
                      <p className="text-white/60">Total: <span className="text-white font-medium">{day.total}</span></p>
                      <p className="text-emerald-400">Resolved: {day.resolved}</p>
                      <p className="text-red-400">Escalated: {day.escalations}</p>
                      {day.total > 0 && <p className="text-indigo-300">Rate: {Math.round((day.resolved / day.total) * 100)}%</p>}
                    </div>
                  </div>
                  {/* Bar group */}
                  <div className="relative w-full flex items-end justify-center gap-0.5" style={{ height: '160px' }}>
                    {/* Total bar (background) */}
                    <div className="absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-700 overflow-hidden"
                      style={{ height: `${totalH}%`, background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.3)' }}>
                      {/* Resolved fill */}
                      <div className="absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-700"
                        style={{ height: `${day.total > 0 ? (day.resolved / day.total) * 100 : 0}%`, background: 'linear-gradient(to top, #10b981, #34d399)' }} />
                    </div>
                    {/* Escalation indicator */}
                    {day.escalations > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 rounded-t-lg"
                        style={{ height: `${escalH}%`, background: 'rgba(239,68,68,0.5)' }} />
                    )}
                    {/* Count label */}
                    {day.total > 0 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/60">{day.total}</span>
                    )}
                  </div>
                  {/* Day label */}
                  <div className="text-center">
                    <p className="text-[10px] text-white/50 font-medium leading-tight">
                      {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                    </p>
                    <p className="text-[9px] text-white/25">
                      {new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Period Comparison Summary ── */}
      <div className="glass rounded-2xl border border-white/10 p-5">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
          <i className="pi pi-chart-line text-indigo-400" /> Period Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-white/10 text-white/30 text-xs uppercase tracking-wider">
                <th className="pb-3 text-left font-medium">Period</th>
                <th className="pb-3 text-right font-medium">Total Queries</th>
                <th className="pb-3 text-right font-medium">Resolved</th>
                <th className="pb-3 text-right font-medium">Escalated</th>
                <th className="pb-3 text-right font-medium">Resolution Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {([
                { label: 'Last 7 Days',   stats: daily.periods.last7,   highlight: period === '7d' },
                { label: 'Last 30 Days',  stats: daily.periods.last30,  highlight: period === '30d' },
                { label: 'Last 365 Days', stats: daily.periods.last365, highlight: period === '365d' },
              ] as { label: string; stats: PeriodStats; highlight: boolean }[]).map(({ label, stats, highlight }) => (
                <tr key={label} className={`transition-colors ${highlight ? 'bg-indigo-500/8' : 'hover:bg-white/3'}`}>
                  <td className="py-3 pr-4">
                    <span className={`text-sm font-medium ${highlight ? 'text-indigo-300' : 'text-white/70'}`}>{label}</span>
                    {highlight && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Selected</span>}
                  </td>
                  <td className="py-3 text-right text-white font-semibold">{stats.total}</td>
                  <td className="py-3 text-right text-emerald-400 font-semibold">{stats.resolved}</td>
                  <td className="py-3 text-right text-red-400 font-semibold">{stats.escalations}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                          style={{ width: `${stats.resolutionRate}%` }} />
                      </div>
                      <span className={`font-bold text-sm ${stats.resolutionRate >= 80 ? 'text-emerald-400' : stats.resolutionRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {stats.resolutionRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Topics + Recent ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <i className="pi pi-list text-indigo-400" /> Top Query Topics
          </h3>
          {data.topTopics.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No queries yet</p>
          ) : (
            <div className="space-y-3">
              {data.topTopics.map((t, i) => (
                <motion.div key={t.topic} className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <span className="text-lg w-7 text-center">{TOPIC_ICONS[t.topic] || '💬'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-white/80 capitalize">{t.topic.replace('_', ' ')}</span>
                      <span className="text-xs text-white/40 font-mono">{t.count}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div className={`h-full rounded-full bg-gradient-to-r ${TOPIC_COLORS[t.topic] || 'from-slate-500 to-slate-600'}`}
                        initial={{ width: 0 }} animate={{ width: `${(t.count / maxCount) * 100}%` }}
                        transition={{ duration: 0.7, delay: i * 0.05 }} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <i className="pi pi-clock text-indigo-400" /> Recent Queries
          </h3>
          {data.recentQueries.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No recent queries</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {data.recentQueries.map((q, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-white/5 transition-colors border border-white/5"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-base flex-shrink-0 mt-0.5">{TOPIC_ICONS[q.topic] || '💬'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{q.query}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/30 capitalize">{q.topic.replace('_', ' ')}</span>
                      <span className="text-[10px] text-white/20">·</span>
                      <span className="text-[10px] text-white/30">
                        {new Date(q.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resolution insight */}
      <div className="glass rounded-2xl border border-purple-500/20 p-5 bg-gradient-to-r from-purple-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎯</span>
          <div>
            <p className="text-white font-semibold">
              {(periodStats?.resolutionRate ?? 0) >= 80 ? 'Excellent bot performance!'
                : (periodStats?.resolutionRate ?? 0) >= 50 ? 'Good bot performance — room to improve'
                : 'Consider expanding bot knowledge base'}
            </p>
            <p className="text-white/40 text-sm mt-0.5">
              {periodStats?.resolved ?? 0} of {periodStats?.total ?? 0} queries resolved without human intervention
              {(periodStats?.escalations ?? 0) > 0 && ` · ${periodStats?.escalations} escalated to support`}
              {' · '}<span className="text-white/30">{selectedLabel}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
