import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { PAYMENT_TYPES } from '../utils/paymentTypes';

interface PaymentMethod {
  _id: string; type: string; label: string;
  upiId: string; qrCodeUrl: string; accountDetails: string; isDefault: boolean;
}

export default function SettingsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/wallet/payment-methods')
      .then(({ data }) => setMethods(data.paymentMethods))
      .catch(() => toast.error('Failed to load payment methods'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-10">
      <div className="max-w-2xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-white font-bold text-2xl flex items-center gap-2">
            <i className="pi pi-cog text-indigo-400" /> Settings
          </h1>
          <p className="text-white/40 text-sm mt-1">Available payment methods for wallet top-up</p>
        </motion.div>

        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-white/10">
            <i className="pi pi-credit-card text-indigo-400" />
            <h2 className="text-white font-semibold">Payment Methods</h2>
            <span className="text-white/30 text-xs">({methods.length})</span>
          </div>

          <div className="p-4 space-y-3">
            {loading ? (
              [1, 2].map((i) => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)
            ) : methods.length === 0 ? (
              <div className="text-center py-10 text-white/30">
                <i className="pi pi-credit-card text-4xl mb-3 block" />
                <p>No payment methods configured yet</p>
                <p className="text-xs mt-1">Contact admin to set up payment options</p>
              </div>
            ) : (
              methods.map((m) => {
                const pt = PAYMENT_TYPES.find((p) => p.value === m.type);
                return (
                  <motion.div
                    key={m._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-4 glass rounded-xl border border-white/10"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `${pt?.color || '#6366f1'}20`, border: `1px solid ${pt?.color || '#6366f1'}30` }}
                    >
                      {pt?.icon || '💳'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium text-sm">{m.label}</p>
                        {m.isDefault && (
                          <span className="text-xs px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">Default</span>
                        )}
                      </div>
                      {m.upiId && <p className="text-white/40 text-xs">{m.upiId}</p>}
                      {m.qrCodeUrl && (
                        <a href={m.qrCodeUrl} target="_blank" rel="noreferrer"
                          className="text-indigo-400/70 text-xs hover:text-indigo-400 transition-colors">
                          View QR Code ↗
                        </a>
                      )}
                      {m.accountDetails && <p className="text-white/40 text-xs truncate">{m.accountDetails}</p>}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
