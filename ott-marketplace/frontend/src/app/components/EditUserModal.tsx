import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface User {
  _id: string; name: string; email: string; wallet: number; walletBalance: number;
  isActive: boolean; createdAt: string; orderCount: number; totalSpent: number;
  googleId?: string;
}

interface SigninSession {
  _id: string; ipAddress: string; location: string | null;
  deviceName: string; deviceType: string; createdAt: string; lastActiveAt: string; revoked: boolean;
}

interface Payment {
  _id: string; amount: number; method: string; type: string;
  status: string; transactionId: string; note: string; createdAt: string;
  order?: { orderNumber: string; amount: number; status: string };
}

interface Props {
  user: User;
  onClose: () => void;
  onUpdated: (user: User) => void;
}

const TABS = ['Profile', 'Sign-in History', 'Payments'] as const;
type Tab = typeof TABS[number];

const PAYMENT_METHODS = ['wallet', 'admin', 'upi', 'paytm', 'phonepe', 'gpay', 'bharatpe', 'binance', 'bank', 'other'];
const PAYMENT_TYPES = ['topup', 'purchase', 'refund'];
const PAYMENT_STATUSES = ['completed', 'pending', 'failed', 'refunded'];

const TYPE_STYLE: Record<string, string> = {
  purchase: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  topup:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  refund:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
};
const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  pending:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  failed:    'bg-red-500/15 text-red-400 border-red-500/30',
  refunded:  'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

export default function EditUserModal({ user: initialUser, onClose, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Profile');
  const [user, setUser] = useState(initialUser);

  // ── Profile state ──────────────────────────────────────────────────────────
  const [name, setName] = useState(initialUser.name);
  const [email, setEmail] = useState(initialUser.email);
  const [wallet, setWallet] = useState(String(initialUser.walletBalance ?? initialUser.wallet ?? 0));
  const [isActive, setIsActive] = useState(initialUser.isActive);
  const [saving, setSaving] = useState(false);

  // ── Password reset state ───────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);

  // ── Sign-in history state ──────────────────────────────────────────────────
  const [sessions, setSessions] = useState<SigninSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // ── Payments state ─────────────────────────────────────────────────────────
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [payForm, setPayForm] = useState({
    amount: '', method: 'admin', type: 'topup', status: 'completed', transactionId: '', note: '',
  });
  const [paySubmitting, setPaySubmitting] = useState(false);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const { data } = await api.get(`/admin/users/${user._id}/signin-history`);
      setSessions(data.sessions);
    } catch { toast.error('Failed to load sign-in history'); }
    finally { setSessionsLoading(false); }
  }, [user._id]);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const { data } = await api.get(`/admin/users/${user._id}/payments`);
      setPayments(data.payments);
    } catch { toast.error('Failed to load payments'); }
    finally { setPaymentsLoading(false); }
  }, [user._id]);

  useEffect(() => {
    if (activeTab === 'Sign-in History') fetchSessions();
    else if (activeTab === 'Payments') fetchPayments();
  }, [activeTab, fetchSessions, fetchPayments]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/users/${user._id}`, {
        name, email, wallet: parseFloat(wallet), isActive,
      });
      setUser({ ...user, ...data.user, walletBalance: data.user.wallet });
      onUpdated({ ...user, ...data.user, walletBalance: data.user.wallet });
      toast.success('User updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setResettingPw(true);
    try {
      const { data } = await api.post(`/admin/users/${user._id}/reset-password`, { password: newPassword });
      toast.success(data.message);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Reset failed');
    } finally { setResettingPw(false); }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      toast.error('Enter a valid amount'); return;
    }
    setPaySubmitting(true);
    try {
      const { data } = await api.post(`/admin/users/${user._id}/payments`, payForm);
      toast.success(data.message);
      setUser((u) => ({ ...u, wallet: data.newBalance, walletBalance: data.newBalance }));
      onUpdated({ ...user, wallet: data.newBalance, walletBalance: data.newBalance });
      setPayForm({ amount: '', method: 'admin', type: 'topup', status: 'completed', transactionId: '', note: '' });
      setShowAddPayment(false);
      fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add payment');
    } finally { setPaySubmitting(false); }
  };

  const handleUpdatePayment = async () => {
    if (!editPayment) return;
    setPaySubmitting(true);
    try {
      const { data } = await api.put(`/admin/users/${user._id}/payments/${editPayment._id}`, {
        status: payForm.status, note: payForm.note, transactionId: payForm.transactionId,
      });
      toast.success(data.message);
      setEditPayment(null);
      fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setPaySubmitting(false); }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Delete this payment? Wallet balance will be reversed.')) return;
    try {
      const { data } = await api.delete(`/admin/users/${user._id}/payments/${paymentId}`);
      toast.success(data.message);
      setUser((u) => ({ ...u, wallet: data.newBalance, walletBalance: data.newBalance }));
      onUpdated({ ...user, wallet: data.newBalance, walletBalance: data.newBalance });
      fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const openEditPayment = (p: Payment) => {
    setEditPayment(p);
    setPayForm({ amount: String(p.amount), method: p.method, type: p.type, status: p.status, transactionId: p.transactionId, note: p.note });
    setShowAddPayment(false);
  };

  const deviceIcon = (type: string) => {
    if (type === 'mobile') return '📱';
    if (type === 'tablet') return '📟';
    return '💻';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f1117 0%, #1a1d2e 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-bold text-sm">{user.name?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">{user.name}</h2>
              <p className="text-white/40 text-xs">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-indigo-400 font-bold text-sm">₹{(user.walletBalance ?? user.wallet ?? 0).toFixed(2)}</p>
              <p className="text-white/30 text-xs">wallet</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
              <i className="pi pi-times text-sm" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-0 flex-shrink-0">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all border-b-2 ${
                activeTab === tab
                  ? 'text-indigo-400 border-indigo-500 bg-indigo-500/10'
                  : 'text-white/40 border-transparent hover:text-white/70'
              }`}>
              {tab === 'Profile' && <><i className="pi pi-user mr-1.5 text-xs" />{tab}</>}
              {tab === 'Sign-in History' && <><i className="pi pi-history mr-1.5 text-xs" />{tab}</>}
              {tab === 'Payments' && <><i className="pi pi-credit-card mr-1.5 text-xs" />{tab}</>}
            </button>
          ))}
        </div>
        <div className="h-px bg-white/10 mx-6 flex-shrink-0" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {/* ── Profile Tab ── */}
            {activeTab === 'Profile' && (
              <motion.div key="profile" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
                {/* Basic Info */}
                <div className="rounded-xl border border-white/10 p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <i className="pi pi-id-card text-indigo-400" /> Basic Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-white/50 text-xs mb-1.5 block">Full Name</label>
                      <input value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
                        placeholder="Full name" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1.5 block">Email Address</label>
                      <input value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
                        placeholder="Email" type="email" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1.5 block">Wallet Balance (₹)</label>
                      <input value={wallet} onChange={(e) => setWallet(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
                        placeholder="0.00" type="number" min="0" step="0.01" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1.5 block">Account Status</label>
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setIsActive(true)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-white/30 border-white/10 hover:border-white/20'}`}>
                          Active
                        </button>
                        <button onClick={() => setIsActive(false)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${!isActive ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-white/5 text-white/30 border-white/10 hover:border-white/20'}`}>
                          Banned
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button onClick={handleSaveProfile} disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      {saving ? <><i className="pi pi-spin pi-spinner text-xs" /> Saving…</> : <><i className="pi pi-check text-xs" /> Save Changes</>}
                    </button>
                  </div>
                </div>

                {/* Reset Password */}
                <div className="rounded-xl border border-amber-500/20 p-5 space-y-4" style={{ background: 'rgba(245,158,11,0.04)' }}>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <i className="pi pi-lock text-amber-400" /> Reset Password
                  </h3>
                  <p className="text-white/40 text-xs">Set a new custom password for this user. They will need to use this to log in.</p>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (min 6 chars)"
                        className="w-full px-3 py-2.5 pr-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500/60 transition-colors"
                      />
                      <button onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                        <i className={`pi ${showPw ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                      </button>
                    </div>
                    <button onClick={handleResetPassword} disabled={resettingPw || !newPassword}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      {resettingPw ? <i className="pi pi-spin pi-spinner text-xs" /> : <i className="pi pi-key text-xs" />}
                      Reset
                    </button>
                  </div>
                </div>

                {/* Account Meta */}
                <div className="rounded-xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
                    <i className="pi pi-info-circle text-indigo-400" /> Account Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'User ID', value: user._id, mono: true },
                      { label: 'Joined', value: new Date(user.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                      { label: 'Total Orders', value: String(user.orderCount || 0) },
                      { label: 'Total Spent', value: `₹${(user.totalSpent || 0).toFixed(2)}` },
                      { label: 'Auth Method', value: user.googleId ? 'Google OAuth' : 'Email/Password' },
                    ].map(({ label, value, mono }) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <span className="text-white/30">{label}</span>
                        <span className={`text-white/70 ${mono ? 'font-mono text-[10px] break-all' : ''}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Sign-in History Tab ── */}
            {activeTab === 'Sign-in History' && (
              <motion.div key="history" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold text-sm">Last 10 Days Sign-in History</h3>
                    <p className="text-white/30 text-xs mt-0.5">{sessions.length} sessions found</p>
                  </div>
                  <button onClick={fetchSessions} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-all">
                    <i className="pi pi-refresh text-xs" /> Refresh
                  </button>
                </div>

                {sessionsLoading ? (
                  <div className="flex items-center justify-center py-16 text-white/30">
                    <i className="pi pi-spin pi-spinner text-2xl mr-3" /> Loading history…
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-16 text-white/30">
                    <i className="pi pi-history text-4xl mb-3 block opacity-40" />
                    <p className="text-sm">No sign-in activity in the last 10 days</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s, i) => (
                      <motion.div key={s._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-4 p-4 rounded-xl border border-white/8 hover:border-white/15 transition-all"
                        style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {/* Device icon */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: 'rgba(99,102,241,0.15)' }}>
                          {deviceIcon(s.deviceType)}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-medium">{s.deviceName || 'Unknown device'}</span>
                            {s.revoked && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">Revoked</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-white/40">
                              <i className="pi pi-map-marker text-indigo-400/70" />
                              {s.location || 'Location unknown'}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-white/40">
                              <i className="pi pi-desktop text-indigo-400/70" />
                              {s.ipAddress || 'IP unknown'}
                            </span>
                          </div>
                        </div>
                        {/* Timestamps */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-white/60 text-xs font-medium">
                            {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-white/30 text-xs mt-0.5">
                            {new Date(s.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                          <p className="text-white/20 text-[10px] mt-1">
                            Last active: {new Date(s.lastActiveAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Payments Tab ── */}
            {activeTab === 'Payments' && (
              <motion.div key="payments" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold text-sm">Payment Management</h3>
                    <p className="text-white/30 text-xs mt-0.5">{payments.length} transactions · Wallet: <span className="text-indigo-400 font-semibold">₹{(user.walletBalance ?? user.wallet ?? 0).toFixed(2)}</span></p>
                  </div>
                  <button onClick={() => { setShowAddPayment(true); setEditPayment(null); setPayForm({ amount: '', method: 'admin', type: 'topup', status: 'completed', transactionId: '', note: '' }); }}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    <i className="pi pi-plus text-xs" /> Add Payment
                  </button>
                </div>

                {/* Add / Edit Payment Form */}
                <AnimatePresence>
                  {(showAddPayment || editPayment) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="mb-4 rounded-xl border overflow-hidden"
                      style={{ borderColor: editPayment ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)', background: editPayment ? 'rgba(99,102,241,0.05)' : 'rgba(16,185,129,0.05)' }}>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-white font-semibold text-sm">{editPayment ? 'Edit Payment' : 'Add New Payment'}</h4>
                          <button onClick={() => { setShowAddPayment(false); setEditPayment(null); }} className="text-white/30 hover:text-white/60 transition-colors">
                            <i className="pi pi-times text-sm" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {!editPayment && (
                            <>
                              <div>
                                <label className="text-white/40 text-xs mb-1 block">Amount (₹)</label>
                                <input type="number" min="0.01" step="0.01" value={payForm.amount}
                                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
                                  placeholder="0.00" />
                              </div>
                              <div>
                                <label className="text-white/40 text-xs mb-1 block">Type</label>
                                <select value={payForm.type} onChange={(e) => setPayForm({ ...payForm, type: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors">
                                  {PAYMENT_TYPES.map((t) => <option key={t} value={t} className="bg-slate-900">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-white/40 text-xs mb-1 block">Method</label>
                                <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors">
                                  {PAYMENT_METHODS.map((m) => <option key={m} value={m} className="bg-slate-900">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                                </select>
                              </div>
                            </>
                          )}
                          <div>
                            <label className="text-white/40 text-xs mb-1 block">Status</label>
                            <select value={payForm.status} onChange={(e) => setPayForm({ ...payForm, status: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors">
                              {PAYMENT_STATUSES.map((s) => <option key={s} value={s} className="bg-slate-900">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                          </div>
                          <div className={editPayment ? 'col-span-2' : ''}>
                            <label className="text-white/40 text-xs mb-1 block">Transaction ID</label>
                            <input value={payForm.transactionId} onChange={(e) => setPayForm({ ...payForm, transactionId: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors font-mono"
                              placeholder="Auto-generated if empty" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-white/40 text-xs mb-1 block">Note</label>
                            <input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
                              placeholder="Optional note" />
                          </div>
                        </div>
                        {!editPayment && (
                          <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            {payForm.type === 'topup' && <span className="text-emerald-400">💡 Topup will <strong>add</strong> ₹{payForm.amount || '0'} to wallet</span>}
                            {payForm.type === 'refund' && <span className="text-amber-400">💡 Refund will <strong>add</strong> ₹{payForm.amount || '0'} to wallet</span>}
                            {payForm.type === 'purchase' && <span className="text-blue-400">💡 Purchase will <strong>deduct</strong> ₹{payForm.amount || '0'} from wallet</span>}
                          </div>
                        )}
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setShowAddPayment(false); setEditPayment(null); }}
                            className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
                            Cancel
                          </button>
                          <button onClick={editPayment ? handleUpdatePayment : handleAddPayment} disabled={paySubmitting}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                            style={{ background: editPayment ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)' }}>
                            {paySubmitting ? <i className="pi pi-spin pi-spinner text-xs" /> : <i className={`pi ${editPayment ? 'pi-check' : 'pi-plus'} text-xs`} />}
                            {editPayment ? 'Update' : 'Add Payment'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Payments List */}
                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-16 text-white/30">
                    <i className="pi pi-spin pi-spinner text-2xl mr-3" /> Loading payments…
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-16 text-white/30">
                    <i className="pi pi-credit-card text-4xl mb-3 block opacity-40" />
                    <p className="text-sm">No payments yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p, i) => (
                      <motion.div key={p._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-4 p-3.5 rounded-xl border border-white/8 hover:border-white/15 transition-all group"
                        style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {/* Amount */}
                        <div className="w-20 text-right flex-shrink-0">
                          <span className={`font-bold text-sm tabular-nums ${p.type === 'purchase' ? 'text-red-400' : 'text-emerald-400'}`}>
                            {p.type === 'purchase' ? '−' : '+'}₹{p.amount?.toFixed(2)}
                          </span>
                        </div>
                        {/* Badges */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${TYPE_STYLE[p.type] ?? TYPE_STYLE.topup}`}>{p.type}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${STATUS_STYLE[p.status] ?? STATUS_STYLE.completed}`}>{p.status}</span>
                        </div>
                        {/* Method + Note */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white/50 text-xs capitalize px-1.5 py-0.5 rounded bg-white/5">{p.method}</span>
                            {p.order && <span className="text-white/30 text-xs font-mono">{p.order.orderNumber}</span>}
                          </div>
                          {p.note && <p className="text-white/30 text-xs mt-0.5 truncate">{p.note}</p>}
                          {p.transactionId && <p className="text-white/20 text-[10px] font-mono mt-0.5 truncate">{p.transactionId}</p>}
                        </div>
                        {/* Date */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-white/40 text-xs">{new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                          <p className="text-white/25 text-[10px]">{new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => openEditPayment(p)}
                            className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 flex items-center justify-center transition-all"
                            title="Edit payment">
                            <i className="pi pi-pencil text-xs" />
                          </button>
                          <button onClick={() => handleDeletePayment(p._id)}
                            className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-all"
                            title="Delete payment">
                            <i className="pi pi-trash text-xs" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
