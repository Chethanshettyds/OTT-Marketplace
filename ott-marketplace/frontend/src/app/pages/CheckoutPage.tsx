import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { PAYMENT_TYPES } from '../utils/paymentTypes';
import { useCurrency } from '../hooks/useCurrency';
import toast from 'react-hot-toast';

interface PaymentMethod {
  _id: string;
  type: string;
  label: string;
  upiId: string;
  qrCodeUrl: string;
  accountDetails: string;
  isDefault: boolean;
}

const TAX_RATE = 0.18;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, clearCart, total } = useCartStore();
  const { user } = useAuth();
  const { updateUser } = useAuthStore();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);

  const subtotal = total();
  const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const grandTotal = parseFloat((subtotal + tax).toFixed(2));
  const { format } = useCurrency();

  useEffect(() => {
    if (items.length === 0 && !success) navigate('/shop');
  }, [items]);

  useEffect(() => {
    api.get('/wallet/payment-methods')
      .then(({ data }) => {
        setMethods(data.paymentMethods);
        const def = data.paymentMethods.find((m: PaymentMethod) => m.isDefault);
        if (def) setSelectedMethod(def._id);
        else if (data.paymentMethods.length > 0) setSelectedMethod(data.paymentMethods[0]._id);
      })
      .catch(() => toast.error('Failed to load payment methods'))
      .finally(() => setLoadingMethods(false));
  }, []);

  const handlePlaceOrder = async () => {
    if (!selectedMethod) return toast.error('Select a payment method');
    if ((user?.wallet ?? 0) < grandTotal) return toast.error('Insufficient wallet balance. Please top up.');
    setPlacing(true);
    try {
      for (const item of items) {
        await api.post('/orders', { productId: item._id });
      }
      const newBalance = (user?.wallet ?? 0) - grandTotal;
      updateUser({ wallet: newBalance });
      clearCart();
      setSuccess(true);
      toast.success(`Order placed successfully!`);
      setTimeout(() => navigate('/dashboard'), 2200);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Checkout failed');
    } finally {
      setPlacing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen gradient-bg pt-20 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <motion.div
            className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.6 }}
          >
            <i className="pi pi-check text-white text-4xl" />
          </motion.div>
          <h2 className="text-white font-bold text-3xl mb-2">Order Placed!</h2>
          <p className="text-white/50">Redirecting to your dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-4 transition-colors">
            <i className="pi pi-arrow-left text-xs" /> Back
          </button>
          <h1 className="text-white font-bold text-3xl flex items-center gap-3">
            <i className="pi pi-shopping-cart text-indigo-400" />
            Checkout
            <span className="text-indigo-400">— {format(grandTotal)}</span>
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: Payment Methods */}
          <div className="lg:col-span-3 space-y-5">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-5 border-b border-white/10">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <i className="pi pi-credit-card text-indigo-400" /> Payment Method
                </h2>
              </div>

              <div className="p-4 space-y-2">
                {loadingMethods ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="h-16 glass rounded-xl animate-pulse" />
                  ))
                ) : methods.length === 0 ? (
                  <div className="text-center py-10 text-white/30">
                    <i className="pi pi-credit-card text-4xl mb-3 block" />
                    <p>No payment methods available</p>
                    <p className="text-xs mt-1">Contact admin to configure payment options</p>
                  </div>
                ) : (
                  methods.map((m) => {
                    const pt = PAYMENT_TYPES.find((p) => p.value === m.type);
                    const isSelected = selectedMethod === m._id;
                    return (
                      <motion.button
                        key={m._id}
                        onClick={() => setSelectedMethod(m._id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left ${
                          isSelected
                            ? 'border-indigo-500/60 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                            : 'border-white/10 glass hover:border-white/20'
                        }`}
                      >
                        {/* Icon */}
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform"
                          style={{
                            background: `${pt?.color || '#6366f1'}20`,
                            border: `1px solid ${pt?.color || '#6366f1'}40`,
                            boxShadow: isSelected ? `0 0 16px ${pt?.color || '#6366f1'}30` : 'none',
                          }}
                        >
                          {pt?.icon || '💳'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{m.label}</p>
                          {m.upiId && <p className="text-white/40 text-xs mt-0.5">{m.upiId}</p>}
                          {m.accountDetails && <p className="text-white/40 text-xs mt-0.5 truncate">{m.accountDetails}</p>}
                          {m.isDefault && (
                            <span className="text-xs px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full mt-1 inline-block">Default</span>
                          )}
                        </div>

                        {/* Radio */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected ? 'border-indigo-400 bg-indigo-500' : 'border-white/20'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>

              {/* QR code display for selected method */}
              <AnimatePresence>
                {selectedMethod && (() => {
                  const m = methods.find((x) => x._id === selectedMethod);
                  return m?.qrCodeUrl ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-white/10 p-5 flex flex-col items-center gap-3"
                    >
                      <p className="text-white/50 text-sm">Scan QR to pay</p>
                      <img
                        src={m.qrCodeUrl}
                        alt="QR Code"
                        className="w-40 h-40 rounded-xl border border-white/10 object-contain bg-white p-2"
                      />
                    </motion.div>
                  ) : null;
                })()}
              </AnimatePresence>
            </motion.div>

            {/* Wallet balance info */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="glass rounded-2xl border border-white/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <i className="pi pi-wallet text-white text-sm" />
                </div>
                <div>
                  <p className="text-white/50 text-xs">Wallet Balance</p>
                  <p className="text-white font-bold text-lg">{format(user?.wallet ?? 0)}</p>
                </div>
              </div>
              {(user?.wallet ?? 0) < grandTotal ? (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <i className="pi pi-exclamation-triangle" />
                  <span>Insufficient</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <i className="pi pi-check-circle" />
                  <span>Sufficient</span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right: Order Summary */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-2 space-y-4">
            <div className="glass rounded-2xl border border-white/10 overflow-hidden sticky top-24">
              <div className="p-5 border-b border-white/10">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <i className="pi pi-list text-indigo-400" /> Order Summary
                </h2>
              </div>

              {/* Items */}
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item._id} className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${item.gradientFrom}, ${item.gradientTo})` }}
                    >
                      {item.platform[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.name}</p>
                      <p className="text-white/40 text-xs">{item.duration}</p>
                    </div>
                    <span className="text-indigo-400 font-semibold text-sm">{format(item.price)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="p-4 border-t border-white/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Subtotal</span>
                  <span className="text-white">{format(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Tax (18% GST)</span>
                  <span className="text-white">{format(tax)}</span>
                </div>
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Total</span>
                  <motion.span key={grandTotal} initial={{ scale: 1.1 }} animate={{ scale: 1 }}
                    className="font-bold text-xl text-orange-400">
                    {format(grandTotal)}
                  </motion.span>
                </div>
              </div>

              {/* CTA */}
              <div className="p-4 pt-0">
                <motion.button
                  onClick={handlePlaceOrder}
                  disabled={placing || !selectedMethod || methods.length === 0 || (user?.wallet ?? 0) < grandTotal}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)' }}
                >
                  {placing ? (
                    <><i className="pi pi-spin pi-spinner" /> Processing...</>
                  ) : (
                    <><i className="pi pi-lock text-sm" /> Place Order — {format(grandTotal)}</>
                  )}
                </motion.button>
                <p className="text-white/20 text-xs text-center mt-2 flex items-center justify-center gap-1">
                  <i className="pi pi-shield text-xs" /> Secured · Wallet deducted instantly
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
