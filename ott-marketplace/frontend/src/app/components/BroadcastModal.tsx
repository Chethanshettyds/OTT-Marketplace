import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface User { _id: string; name: string; email: string; }

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
}

type BcastType = 'all' | 'selected' | 'group' | 'specific';
type AiBroadcastType = 'promo' | 'maintenance' | 'update' | 'alert' | 'general';

const AI_BROADCAST_TYPES: { value: AiBroadcastType; label: string; icon: string; desc: string }[] = [
  { value: 'promo',       icon: '🎉', label: 'Promotion',    desc: 'Offer or discount' },
  { value: 'update',      icon: '🚀', label: 'New Feature',  desc: 'Product update' },
  { value: 'maintenance', icon: '🔧', label: 'Maintenance',  desc: 'Downtime notice' },
  { value: 'alert',       icon: '⚠️', label: 'Alert',        desc: 'Account notice' },
  { value: 'general',     icon: '📣', label: 'General',      desc: 'Informational' },
];

const TEMPLATES = [
  { id: 'promo',       label: '🎉 Promotion',    subject: 'Exclusive Deal Just for You!',       body: 'Hi! We have an exclusive offer available for a limited time. Check it out now on OTT Market.' },
  { id: 'maintenance', label: '🔧 Maintenance',  subject: 'Scheduled Maintenance Notice',        body: 'We will be performing scheduled maintenance on [DATE] from [TIME]. Services may be briefly unavailable.' },
  { id: 'update',      label: '🚀 New Feature',  subject: 'New Feature Available on OTT Market', body: 'We just launched a new feature! Log in to explore what\'s new and enjoy an improved experience.' },
  { id: 'alert',       label: '⚠️ Alert',        subject: 'Important Account Notice',            body: 'We noticed unusual activity on your account. Please review your recent activity and contact support if needed.' },
];

const GROUP_OPTIONS = [
  { value: 'active',   label: 'All Active Users' },
  { value: 'inactive', label: 'Inactive Users' },
  { value: 'vip',      label: 'VIP Users (spent > $100)' },
];

export default function BroadcastModal({ isOpen, onClose, onSent }: BroadcastModalProps) {
  const [type, setType] = useState<BcastType>('all');
  const [group, setGroup] = useState('active');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [specificEmail, setSpecificEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);

  // ── AI generation state ───────────────────────────────────────────────────
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiType, setAiType] = useState<AiBroadcastType>('promo');
  const [aiHint, setAiHint] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/admin/users').then(({ data }) => setTotalUsers(data.users.length)).catch(() => {});
    }
  }, [isOpen]);

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSubject(tpl.subject);
    setMessage(tpl.body);
  };

  const handleGenerate = async () => {
    if (!aiHint.trim()) return toast.error('Enter a short topic or hint first.');
    setAiGenerating(true);
    try {
      const { data } = await api.post('/broadcast/generate', {
        broadcastType: aiType,
        hint: aiHint.trim(),
      });
      setSubject(data.subject);
      setMessage(data.message);
      setAiPanelOpen(false);
      setAiHint('');
      toast.success('AI draft applied — review and edit before sending.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'AI generation failed. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  const searchUsers = async (q: string) => {
    setSpecificEmail(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get('/admin/users');
      const filtered = data.users.filter((u: User) =>
        u.email.toLowerCase().includes(q.toLowerCase()) ||
        u.name.toLowerCase().includes(q.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 6));
    } catch { /* ignore */ }
    finally { setSearching(false); }
  };

  const toggleUser = (u: User) => {
    setSelectedUsers((prev) =>
      prev.find((x) => x._id === u._id) ? prev.filter((x) => x._id !== u._id) : [...prev, u]
    );
  };

  const recipientCount = () => {
    if (type === 'all') return totalUsers;
    if (type === 'selected' || type === 'specific') return selectedUsers.length;
    return '?';
  };

  const handleSend = async () => {
    if (!subject.trim()) return toast.error('Subject is required');
    if (!message.trim()) return toast.error('Message is required');
    if ((type === 'selected' || type === 'specific') && !selectedUsers.length) {
      return toast.error('Select at least one recipient');
    }
    setSending(true);
    try {
      const payload: Record<string, unknown> = { type, subject, message };
      if (type === 'group') payload.group = group;
      if (type === 'selected' || type === 'specific') {
        payload.recipients = selectedUsers.map((u) => u._id);
      }
      const { data } = await api.post('/broadcast', payload);
      toast.success(`📢 ${data.message}`);
      onSent();
      handleClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setType('all'); setSubject(''); setMessage('');
    setSpecificEmail(''); setSearchResults([]);
    setSelectedUsers([]); setPreview(false);
    setAiPanelOpen(false); setAiHint(''); setAiType('promo');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-2xl border border-white/10 shadow-2xl"
            initial={{ scale: 0.92, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xl">
                  📢
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Send Broadcast</h2>
                  <p className="text-white/40 text-xs">Notify users directly from admin</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                <i className="pi pi-times" />
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Recipients */}
              <div>
                <label className="text-white/70 text-sm font-medium block mb-3">
                  <i className="pi pi-users mr-2 text-orange-400" />Recipients
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'all',      icon: '🌐', label: 'All Users',       sub: `${totalUsers} users` },
                    { v: 'selected', icon: '✅', label: 'Selected Users',  sub: `${selectedUsers.length} selected` },
                    { v: 'group',    icon: '👥', label: 'User Group',      sub: 'VIP / Inactive' },
                    { v: 'specific', icon: '🎯', label: 'Specific User',   sub: 'Search by email' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setType(opt.v)}
                      className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        type === opt.v
                          ? 'border-orange-500 bg-orange-500/15'
                          : 'border-white/10 bg-white/5 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{opt.icon}</span>
                        <div>
                          <p className="text-white text-sm font-medium">{opt.label}</p>
                          <p className="text-white/40 text-xs">{opt.sub}</p>
                        </div>
                        {type === opt.v && <i className="pi pi-check text-orange-400 text-xs ml-auto" />}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Group picker */}
                {type === 'group' && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
                    <select
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      className="input-field text-sm"
                    >
                      {GROUP_OPTIONS.map((g) => (
                        <option key={g.value} value={g.value} className="bg-[#0f0f1a]">{g.label}</option>
                      ))}
                    </select>
                  </motion.div>
                )}

                {/* User search */}
                {(type === 'specific' || type === 'selected') && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-2">
                    <div className="relative">
                      <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                      <input
                        value={specificEmail}
                        onChange={(e) => searchUsers(e.target.value)}
                        placeholder="Search by name or email..."
                        className="input-field pl-9 text-sm"
                      />
                      {searching && <i className="pi pi-spin pi-spinner absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />}
                    </div>
                    {searchResults.length > 0 && (
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        {searchResults.map((u) => {
                          const sel = selectedUsers.some((x) => x._id === u._id);
                          return (
                            <button
                              key={u._id}
                              onClick={() => toggleUser(u)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${sel ? 'bg-orange-500/15' : 'hover:bg-white/5'}`}
                            >
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {u.name[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm">{u.name}</p>
                                <p className="text-white/40 text-xs truncate">{u.email}</p>
                              </div>
                              {sel && <i className="pi pi-check text-orange-400 text-sm" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {selectedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedUsers.map((u) => (
                          <span key={u._id} className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full border border-orange-500/30">
                            {u.name}
                            <button onClick={() => toggleUser(u)} className="hover:text-white"><i className="pi pi-times text-xs" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Templates */}
              <div>
                <label className="text-white/70 text-sm font-medium block mb-3">
                  <i className="pi pi-palette mr-2 text-orange-400" />Quick Templates
                </label>
                <div className="flex gap-2 flex-wrap">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:border-orange-500/40 hover:bg-orange-500/10 text-white/70 hover:text-white text-xs transition-all"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── AI Generate ── */}
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
                {/* Toggle header */}
                <button
                  onClick={() => setAiPanelOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-500/10 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm flex-shrink-0">
                      ✨
                    </div>
                    <div className="text-left">
                      <p className="text-violet-300 text-sm font-semibold">Generate with AI</p>
                      <p className="text-violet-400/60 text-xs">Let AI write the subject & message for you</p>
                    </div>
                  </div>
                  <i className={`pi ${aiPanelOpen ? 'pi-chevron-up' : 'pi-chevron-down'} text-violet-400/60 text-xs transition-transform`} />
                </button>

                <AnimatePresence>
                  {aiPanelOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4 border-t border-violet-500/20 pt-4">
                        {/* Broadcast type selector */}
                        <div>
                          <p className="text-white/50 text-xs font-medium mb-2">Broadcast type</p>
                          <div className="grid grid-cols-5 gap-1.5">
                            {AI_BROADCAST_TYPES.map((t) => (
                              <button
                                key={t.value}
                                onClick={() => setAiType(t.value)}
                                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all ${
                                  aiType === t.value
                                    ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                                    : 'border-white/10 bg-white/5 text-white/50 hover:border-violet-500/40 hover:text-white/80'
                                }`}
                              >
                                <span className="text-base leading-none">{t.icon}</span>
                                <span className="text-[10px] font-medium leading-tight">{t.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Hint input */}
                        <div>
                          <p className="text-white/50 text-xs font-medium mb-2">
                            What's this broadcast about?
                            <span className="text-white/25 font-normal ml-1">(a short hint is enough)</span>
                          </p>
                          <div className="flex gap-2">
                            <input
                              value={aiHint}
                              onChange={(e) => setAiHint(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !aiGenerating) handleGenerate(); }}
                              placeholder={
                                aiType === 'promo'       ? 'e.g. Netflix restock, 20% off this weekend' :
                                aiType === 'maintenance' ? 'e.g. Server upgrade on Sunday 2–4 AM' :
                                aiType === 'update'      ? 'e.g. New 3D shop and wallet top-up feature' :
                                aiType === 'alert'       ? 'e.g. Remind users to verify their email' :
                                'e.g. Thank users for their support this month'
                              }
                              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/25 focus:outline-none focus:border-violet-500/60 transition-all"
                              disabled={aiGenerating}
                            />
                            <button
                              onClick={handleGenerate}
                              disabled={aiGenerating || !aiHint.trim()}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                            >
                              {aiGenerating
                                ? <><i className="pi pi-spin pi-spinner text-xs" /> Writing...</>
                                : <><span className="text-sm">✨</span> Generate</>
                              }
                            </button>
                          </div>
                          <p className="text-white/20 text-xs mt-1.5">
                            AI will draft the subject and message — you can edit before sending.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Subject */}
              <div>
                <label className="text-white/70 text-sm font-medium block mb-2">
                  <i className="pi pi-tag mr-2 text-orange-400" />Subject *
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Important update about your account"
                  className="input-field text-sm"
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-white/70 text-sm font-medium block mb-2">
                  <i className="pi pi-file-edit mr-2 text-orange-400" />Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your broadcast message here..."
                  rows={5}
                  className="input-field text-sm resize-none"
                />
                <p className="text-white/20 text-xs mt-1 text-right">{message.length} chars</p>
              </div>

              {/* Preview */}
              <AnimatePresence>
                {preview && subject && message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 space-y-2">
                      <p className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Preview</p>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-xs font-bold">A</div>
                        <div>
                          <p className="text-white text-sm font-semibold">{subject}</p>
                          <p className="text-white/40 text-xs">Admin · Just now</p>
                        </div>
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed">{message}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t border-white/10">
              <div className="text-white/40 text-sm">
                <i className="pi pi-send mr-1 text-orange-400" />
                Sending to <span className="text-white font-semibold">{recipientCount()}</span> recipient{recipientCount() !== 1 ? 's' : ''}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreview(!preview)}
                  className="btn-ghost text-sm py-2 px-4"
                >
                  <i className="pi pi-eye mr-1.5 text-xs" />{preview ? 'Hide' : 'Preview'}
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !subject.trim() || !message.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm text-white disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)' }}
                >
                  {sending
                    ? <><i className="pi pi-spin pi-spinner text-xs" /> Sending...</>
                    : <><i className="pi pi-send text-xs" /> Send Now</>
                  }
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
