import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  wallet: number;
  walletBalance: number;
}

interface Props {
  user: User | null;
  onClose: () => void;
  onSuccess: (userId: string, newBalance: number) => void;
}

const REASONS = [
  'Refund',
  'Welcome Bonus',
  'Referral Reward',
  'Support Credit',
  'Manual Adjustment',
  'Promotional Credit',
  'Custom',
];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

export default function FundWalletModal({ user, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Manual Adjustment');
  const [customReason, setCustomReason] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const parsed = parseFloat(amount) || 0;
  const currentBalance = user.walletBalance ?? user.wallet ?? 0;
  const newBalance = parseFloat((currentBalance + parsed).toFixed(2));
  const finalReason = reason === 'Custom' ? customReason : reason;

  const handleSubmit = async () => {
    if (!parsed || parsed <= 0) return toast.error('Enter a valid amount');
    if (reason === 'Custom' && !customReason.trim()) return toast.error('Enter a reason');
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/users/${user._id}/fund`, {
        amount: parsed,
        reason: finalReason,
        reference: reference.trim(),
      });
      toast.success(`₹${parsed} added to ${user.name}'s wallet`);
      onSuccess(user._id, data.newBalance);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add funds');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass rounded-2xl border border-white/10 w-full max-w-md overflow-hidden"
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-xl">
                💰
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Add Funds</h2>
                <p className="text-white/40 text-xs">Admin wallet credit</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10">
              <i className="pi pi-times" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* User info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{user.name}</p>
                <p className="text-white/40 text-xs truncate">{user.email}</p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-xs">Current</p>
                <p className="text-indigo-400 font-bold text-sm">₹{currentBalance.toFixed(2)}</p>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-white/60 text-xs font-medium block mb-2">Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold">₹</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="1"
                  step="0.01"
                  className="input-field pl-8 text-lg font-bold"
                />
              </div>
              {/* Quick amounts */}
              <div className="flex gap-2 mt-2 flex-wrap">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(String(q))}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      amount === String(q)
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                        : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    ₹{q}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-white/60 text-xs font-medium block mb-2">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field text-sm"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r} className="bg-[#0f0f1a]">{r}</option>
                ))}
              </select>
              <AnimatePresence>
                {reason === 'Custom' && (
                  <motion.input
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter custom reason..."
                    className="input-field text-sm mt-2"
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Reference */}
            <div>
              <label className="text-white/60 text-xs font-medium block mb-2">Reference (optional)</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Order ID, Ticket #, etc."
                className="input-field text-sm"
              />
            </div>

            {/* Transaction preview */}
            {parsed > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2 text-sm"
              >
                <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-3">Transaction Preview</p>
                <div className="flex justify-between">
                  <span className="text-white/40">Type</span>
                  <span className="text-green-400 font-medium">Credit (+₹{parsed.toFixed(2)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Reason</span>
                  <span className="text-white/70">{finalReason || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Current Balance</span>
                  <span className="text-white/70">₹{currentBalance.toFixed(2)}</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between">
                  <span className="text-white font-semibold">New Balance</span>
                  <span className="text-green-400 font-bold text-base">₹{newBalance.toFixed(2)}</span>
                </div>
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              onClick={handleSubmit}
              disabled={saving || !parsed || parsed <= 0}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              {saving
                ? <><i className="pi pi-spin pi-spinner" /> Processing...</>
                : <><i className="pi pi-plus-circle" /> Confirm Add Funds{parsed > 0 ? ` — ₹${parsed.toFixed(2)}` : ''}</>
              }
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
