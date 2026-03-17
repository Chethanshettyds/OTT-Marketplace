import { useState, useEffect } from 'react';
import api from '../utils/api';

interface TopicStat { topic: string; count: number }
interface RecentQuery { topic: string; query: string; ts: string }
interface AnalyticsData {
  totalQueries: number;
  escalations: number;
  resolvedByBot: number;
  resolutionRate: number;
  topTopics: TopicStat[];
  recentQueries: RecentQuery[];
}

const TOPIC_ICONS: Record<string, string> = {
  order: '📦', wallet: '💳', subscription: '📺', refund: '💰',
  account: '🔐', escalation: '🆘', pricing: '💎', bug: '🐛', general: '💬',
};

const TOPIC_COLORS: Record<string, string> = {
  order: 'from-blue-500 to-blue-600',
  wallet: 'from-green-500 to-green-600',
  subscription: 'from-purple-500 to-purple-600',
  refund: 'from-yellow-500 to-yellow-600',
  account: 'from-indigo-500 to-indigo-600',
  escalation: 'from-red-500 to-red-600',
  pricing: 'from-pink-500 to-pink-600',
  bug: 'from-orange-500 to-orange-600',
  general: 'from-slate-500 to-slate-600',
};

export default function ChatbotAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get('/chatbot/analytics');
      setData(res);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-8 text-center border border-red-500/20">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={fetchAnalytics} className="btn-primary text-sm px-4 py-2">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const maxCount = data.topTopics[0]?.count || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🤖 AI Chatbot Analytics
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Real-time support query insights</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="btn-ghost text-sm px-4 py-2 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Queries', value: data.totalQueries, icon: '💬', color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/20' },
          { label: 'Resolved by Bot', value: data.resolvedByBot, icon: '✅', color: 'from-green-500/20 to-green-600/10', border: 'border-green-500/20' },
          { label: 'Escalations', value: data.escalations, icon: '🆘', color: 'from-red-500/20 to-red-600/10', border: 'border-red-500/20' },
          { label: 'Resolution Rate', value: `${data.resolutionRate}%`, icon: '📊', color: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/20' },
        ].map((stat) => (
          <div key={stat.label} className={`glass rounded-xl p-4 border ${stat.border} bg-gradient-to-br ${stat.color}`}>
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-white/50 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Topics */}
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            📈 Top Query Topics
          </h3>
          {data.topTopics.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No queries yet</p>
          ) : (
            <div className="space-y-3">
              {data.topTopics.map((t) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{TOPIC_ICONS[t.topic] || '💬'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-white/80 capitalize">{t.topic}</span>
                      <span className="text-xs text-white/40">{t.count}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${TOPIC_COLORS[t.topic] || 'from-slate-500 to-slate-600'} transition-all duration-700`}
                        style={{ width: `${(t.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Queries */}
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            🕐 Recent Queries
          </h3>
          {data.recentQueries.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No recent queries</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {data.recentQueries.map((q, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/3 hover:bg-white/5 transition-colors border border-white/5">
                  <span className="text-base flex-shrink-0 mt-0.5">{TOPIC_ICONS[q.topic] || '💬'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{q.query}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/30 capitalize">{q.topic}</span>
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
              {data.resolutionRate >= 80
                ? 'Excellent bot performance!'
                : data.resolutionRate >= 50
                ? 'Good bot performance — room to improve'
                : 'Consider expanding bot knowledge base'}
            </p>
            <p className="text-white/40 text-sm mt-0.5">
              {data.resolvedByBot} of {data.totalQueries} queries resolved without human intervention
              {data.escalations > 0 && ` · ${data.escalations} escalated to support`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
