import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { useWallet } from '../hooks/useWallet';
import { PAYMENT_TYPES } from '../utils/paymentTypes';
import toast from 'react-hot-toast';

interface PaymentMethod {
  _id: string; type: string; label: string;
  upiId: string; qrCodeUrl: string; accountDetails: string; isDefault: boolean;
}

const TAX_RATE = 0.18;
const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, clearCart, total } = useCartStore();
  const { user } = useAuth();
  const { updateUser } = useAuthStore();
  const { fetchBalance } = useWallet();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [txnId, setTxnId] = useState('');
  const [rechargeMethod, setRechargeMethod] = useState('upi');
  const [recharging, setRecharging] = useState(false);

  const subtotal = total();
  const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const grandTotal = parseFloat((subtotal + tax).toFixed(2));
  const walletBalance = user?.wallet ?? 0;
  const hasSufficientFunds = walletBalance >= grandTotal;
  const shortfall = parseFloat((grandTotal - walletBalance).toFixed(2));

  useEffect(() => {
    if (items.length === 0 && !success) navigate('/shop');
  }, [items]);

  useEffect(() => {
    api.get('/wallet/payment-methods')
      .then(({ data }) => setMethods(data.paymentMethods))
      .catch(() => {})
      .finally(() => setLoadingMethods(false));
  }, []);

  const handlePlaceOrder = async () => {
    if (!hasSufficientFunds) {
      toast.error('Insufficient wallet balance. Please top up first.');
      setRechargeOpen(true);
      return;
    }
    setPlacing(true);
    try {
      const results = await Promise.allSettled(
        items.map((item) => api.post('/orders', { productId: item._id }))
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === 0) {
        toast.success('All orders placed successfully!');
      } else {
        toast.error(`${failed.length} order(s) failed. Check your dashboard.`);
      }
      await fetchBalance();
      const { data } = await api.get('/auth/me');
      updateUser(data.user);
      clearCart();
      setSuccess(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Checkout failed');
    } finally {
      setPlacing(false);
    }
  };

  const handleRecharge = async () => {
    const amount = customAmount ? parseFloat(customAmount) : rechargeAmount;
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    if (!txnId.trim()) return toast.error('Transaction ID is required');
    setRecharging(true);
    try {
      const { data } = await api.post('/wallet/topup', {
        amount,
        method: rechargeMethod,
        transactionId: txnId.trim(),
      });
      toast.success(data.message);
      updateUser({ ...user!, wallet: data.balance });
      setRechargeOpen(false);
      setTxnId('');
      setCustomAmount('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Top-up failed');
    } finally {
      setRecharging(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-10 text-center max-w-md w-full border border-green-500/20">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6">
            <i className="pi pi-check text-white text-3xl" />
          </motion.div>
          <h2 className="text-white font-black text-3xl mb-2">Order Placed!</h2>
          <p className="text-white/50 mb-8">Your subscriptions are being processed. Check your dashboard for credentials.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/dashboard')} className="btn-primary flex-1 py-3">
              <i className="pi pi-user mr-2" /> My Orders
            </button>
            <button onClick={() => navigate('/shop')} className="btn-ghost flex-1 py-3">Shop More</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-white font-black text-3xl">Checkout</h1>
          <p className="text-white/40 text-sm mt-1">{items.length} item{items.length !== 1 ? 's' : ''} in your cart</p>
        </motion.div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {items.map((item, i) => (
                <motion.div key={item._id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }} transition={{ delay: i * 0.06 }}
                  className="glass rounded-2xl border border-white/10 p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-xl flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)` }}>
                    {item.platform?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{item.name}</p>
                    <p className="text-white/40 text-xs">{item.platform} · {item.duration}</p>
                  </div>
                  <p className="text-indigo-400 font-black text-lg flex-shrink-0">Rs.{item.price}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass rounded-2xl border border-white/10 p-5">
              <h3 className="text-white font-semibold text-lg mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-white/60"><span>Subtotal</span><span>Rs.{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-white/60"><span>Tax (18%)</span><span>Rs.{tax.toFixed(2)}</span></div>
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between text-white font-bold text-base"><span>Total</span><span>Rs.{grandTotal.toFixed(2)}</span></div>
              </div>
              <div className={`rounded-xl p-3 mb-4 flex items-center justify-between ${hasSufficientFunds ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                <div>
                  <p className="text-white/60 text-xs">Wallet Balance</p>
                  <p className={`font-bold text-sm ${hasSufficientFunds ? 'text-green-400' : 'text-red-400'}`}>Rs.{walletBalance.toFixed(2)}</p>
                </div>
                {!hasSufficientFunds && (
                  <div className="text-right">
                    <p className="text-red-400 text-xs">Short by</p>
                    <p className="text-red-400 font-bold text-sm">Rs.{shortfall.toFixed(2)}</p>
                  </div>
                )}
              </div>
              {!hasSufficientFunds && (
                <button onClick={() => setRechargeOpen(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold mb-3 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                  + Top Up Wallet
                </button>
              )}
              <motion.button onClick={handlePlaceOrder} disabled={placing}
                className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all"
                style={{ background: hasSufficientFunds ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)' }}
                whileTap={{ scale: 0.97 }}>
                {placing
                  ? <><i className="pi pi-spin pi-spinner mr-2" />Processing...</>
                  : <><i className="pi pi-check mr-2" />Place Order Rs.{grandTotal.toFixed(2)}</>}
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {rechargeOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setRechargeOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl border border-white/10 p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-lg">Top Up Wallet</h3>
                <button onClick={() => setRechargeOpen(false)} className="text-white/40 hover:text-white"><i className="pi pi-times" /></button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {QUICK_AMOUNTS.map((a) => (
                  <button key={a} onClick={() => { setRechargeAmount(a); setCustomAmount(''); }}
                    className={`py-2 rounded-xl text-sm font-semibold transition-all ${rechargeAmount === a && !customAmount ? 'bg-indigo-500 text-white' : 'glass text-white/60 hover:text-white border border-white/10'}`}>
                    Rs.{a}
                  </button>
                ))}
              </div>
              <input value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Custom amount" type="number" className="input-field text-sm mb-4" />
              {!loadingMethods && methods.length > 0 && (
                <div className="mb-4">
                  <p className="text-white/60 text-xs mb-2">Pay via</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {methods.map((m) => {
                      const pt = PAYMENT_TYPES.find((p) => p.value === m.type);
                      return (
                        <button key={m._id} onClick={() => setRechargeMethod(m.type)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${rechargeMethod === m.type ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                          <span className="text-xl">{pt?.icon || '?'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium">{m.label}</p>
                            {m.upiId && <p className="text-white/40 text-xs truncate">{m.upiId}</p>}
                          </div>
                          {m.qrCodeUrl && <img src={m.qrCodeUrl} alt="QR" className="w-10 h-10 rounded object-contain bg-white p-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="mb-4">
                <label className="text-white/60 text-xs block mb-1">Transaction ID *</label>
                <input value={txnId} onChange={(e) => setTxnId(e.target.value)}
                  placeholder="Enter your transaction ID" className="input-field text-sm" />
              </div>
              <button onClick={handleRecharge} disabled={recharging} className="btn-primary w-full py-3 disabled:opacity-50">
                {recharging
                  ? <><i className="pi pi-spin pi-spinner mr-2" />Processing...</>
                  : `Add Rs.${customAmount || rechargeAmount} to Wallet`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}