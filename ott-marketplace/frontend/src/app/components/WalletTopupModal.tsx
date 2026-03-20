import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../hooks/useWallet';
import { PAYMENT_TYPES } from '../utils/paymentTypes';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface WalletTopupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaymentMethod {
  _id: string; type: string; label: string;
  upiId: string; merchantId?: string; qrCodeUrl: string; accountDetails: string; isDefault: boolean;
}

type Step = 'amount' | 'method' | 'confirm';

// Returns a datetime-local string for "now" in local time
function nowLocalDatetime() {
  const d = new Date();
  d.setSeconds(0, 0);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

// Returns the min allowed datetime (48h ago) — used as the min attr on the datetime input
function minDatetime() {
  const d = new Date(Date.now() - 48 * 60 * 60 * 1000);
  // Convert to local time string for datetime-local input
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export default function WalletTopupModal({ isOpen, onClose }: WalletTopupModalProps) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [txnId, setTxnId] = useState('');
  const [paymentDatetime, setPaymentDatetime] = useState(nowLocalDatetime());
  const [loadingMethods, setLoadingMethods] = useState(false);
  const { balance, topup, isLoading } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchMethods();
      setStep('amount');
      setAmount('');
      setTxnId('');
      setSelectedMethod(null);
      setPaymentDatetime(nowLocalDatetime());
    }
  }, [isOpen]);

  const fetchMethods = async () => {
    setLoadingMethods(true);
    try {
      const { data } = await api.get('/wallet/payment-methods');
      setMethods(data.paymentMethods);
      const def = data.paymentMethods.find((m: PaymentMethod) => m.isDefault);
      if (def) setSelectedMethod(def);
    } catch { /* ignore */ }
    finally { setLoadingMethods(false); }
  };

  const handleAmountNext = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return toast.error('Enter a valid amount');
    if (val < 1) return toast.error('Minimum top-up is ₹1');
    setStep('method');
  };

  const handleMethodNext = () => {
    if (!selectedMethod) return toast.error('Select a payment method');
    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!txnId.trim()) return toast.error('Enter the transaction ID');
    if (txnId.trim().replace(/[^a-zA-Z0-9\-_]/g, '').length < 6) {
      return toast.error('Transaction ID must be at least 6 alphanumeric characters');
    }
    if (!paymentDatetime) return toast.error('Select when you made the payment');

    const paymentTime = new Date(paymentDatetime);
    if (paymentTime > new Date()) return toast.error('Payment time cannot be in the future');

    try {
      const result = await topup(
        parseFloat(amount),
        selectedMethod!.type,
        txnId.trim(),
        paymentTime.toISOString(),
      );

      if (result.oldPayment) {
        toast(
          (t) => (
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-amber-300">Payment is older than 48 hours</p>
              <p className="text-sm text-white/80">{result.message}</p>
              <button
                onClick={() => { toast.dismiss(t.id); onClose(); navigate('/tickets'); }}
                className="text-xs bg-amber-500/20 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-500/30 transition-colors"
              >
                View Ticket {result.ticketNumber}
              </button>
            </div>
          ),
          { duration: 10000, style: { background: '#1a1a2e', border: '1px solid rgba(245,158,11,0.3)' } }
        );
        onClose();
      } else {
        toast.success(result.message);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const pt = PAYMENT_TYPES.find((p) => p.value === selectedMethod?.type);
  const isPaytmBusiness = selectedMethod?.type === 'paytm_business';
  const isPaytm = selectedMethod?.type === 'paytm' || isPaytmBusiness;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative glass rounded-2xl w-full max-w-md border border-white/10 shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="text-white font-bold text-lg">Add Funds</h2>
                <p className="text-white/40 text-xs mt-0.5">Balance: <span className="text-indigo-400 font-semibold">₹{balance.toFixed(2)}</span></p>
              </div>
              <button onClick={onClose} className="p-2 text-white/40 hover:text-white"><i className="pi pi-times" /></button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-0 px-5 pt-4">
              {(['amount', 'method', 'confirm'] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === s ? 'bg-indigo-500 text-white' :
                    (['amount', 'method', 'confirm'].indexOf(step) > i) ? 'bg-green-500 text-white' :
                    'bg-white/10 text-white/40'
                  }`}>{i + 1}</div>
                  {i < 2 && <div className={`flex-1 h-0.5 mx-1 transition-all ${(['amount', 'method', 'confirm'].indexOf(step) > i) ? 'bg-green-500' : 'bg-white/10'}`} />}
                </div>
              ))}
            </div>

            <div className="p-5">
              {/* Step 1: Amount */}
              {step === 'amount' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <p className="text-white/60 text-sm">Enter the amount you want to add:</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold text-lg">₹</span>
                    <input
                      type="number" min="1" value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAmountNext()}
                      placeholder="0.00"
                      className="input-field pl-9 text-xl font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 250, 500, 1000].map((a) => (
                      <button key={a} onClick={() => setAmount(String(a))}
                        className={`py-2 rounded-lg text-sm font-medium border transition-all ${amount === String(a) ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30'}`}>
                        ₹{a}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleAmountNext} className="btn-primary w-full py-3">
                    Continue <i className="pi pi-arrow-right ml-2 text-xs" />
                  </button>
                </motion.div>
              )}

              {/* Step 2: Payment Method */}
              {step === 'method' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                  <p className="text-white/60 text-sm">Select payment method for <span className="text-white font-semibold">₹{amount}</span>:</p>
                  {loadingMethods ? (
                    <div className="text-center py-6 text-white/40"><i className="pi pi-spin pi-spinner text-2xl" /></div>
                  ) : methods.length === 0 ? (
                    <div className="text-center py-6 text-white/40">
                      <i className="pi pi-credit-card text-3xl mb-2 block" />
                      <p className="text-sm">No payment methods saved.</p>
                      <p className="text-xs mt-1">Go to <span className="text-indigo-400">Settings → Payments</span> to add one.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {methods.map((m) => {
                        const mpt = PAYMENT_TYPES.find((p) => p.value === m.type);
                        return (
                          <button key={m._id} onClick={() => setSelectedMethod(m)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedMethod?._id === m._id ? 'border-indigo-500 bg-indigo-500/15' : 'border-white/10 bg-white/5 hover:border-white/25'}`}>
                            <span className="text-xl">{mpt?.icon || '💳'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium">{m.label}</p>
                              {m.upiId && <p className="text-white/40 text-xs">{m.upiId}</p>}
                            </div>
                            {selectedMethod?._id === m._id && <i className="pi pi-check text-indigo-400 text-sm" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setStep('amount')} className="btn-ghost flex-1 py-2.5">Back</button>
                    <button onClick={handleMethodNext} disabled={!selectedMethod} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
                      Continue <i className="pi pi-arrow-right ml-2 text-xs" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Confirm + TxnID + Payment Time */}
              {step === 'confirm' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  {/* Payment instructions */}
                  <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{pt?.icon || '💳'}</span>
                      <div>
                        <p className="text-white font-semibold text-sm">{selectedMethod?.label}</p>
                        <p className="text-white/40 text-xs capitalize">{selectedMethod?.type}</p>
                      </div>
                    </div>
                    {selectedMethod?.upiId && (
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs">UPI ID</span>
                        <span className="text-white font-mono text-sm">{selectedMethod.upiId}</span>
                      </div>
                    )}
                    {selectedMethod?.merchantId && (
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs">{isPaytmBusiness ? 'Merchant ID' : 'Merchant ID'}</span>
                        <span className="text-white font-mono text-sm">{selectedMethod.merchantId}</span>
                      </div>
                    )}
                    {isPaytmBusiness && !selectedMethod?.merchantId && (
                      <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs">
                        No Merchant ID set — contact admin.
                      </div>
                    )}
                    {selectedMethod?.accountDetails && (
                      <div>
                        <span className="text-white/50 text-xs block mb-1">Details</span>
                        <p className="text-white/80 text-xs">{selectedMethod.accountDetails}</p>
                      </div>
                    )}
                    {selectedMethod?.qrCodeUrl && (
                      <div className="text-center pt-2">
                        <img src={selectedMethod.qrCodeUrl} alt="QR Code" className="w-36 h-36 mx-auto rounded-lg object-contain bg-white p-1" />
                        {isPaytm && (
                          <p className="text-white/40 text-xs mt-1">
                            {isPaytmBusiness ? 'Scan with any UPI app — pay to Paytm Business' : 'Scan with Paytm / any UPI app'}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-white/50 text-sm">Amount to pay</span>
                      <span className="text-white font-black text-xl">₹{amount}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs">
                    <i className="pi pi-info-circle mr-1" />
                    Make the payment first, then fill in the details below. Only payments made within the last 48 hours are auto-credited.
                  </div>

                  {/* When did you pay? */}
                  <div>
                    <label className="text-white/60 text-sm block mb-2">
                      When did you make the payment? *
                    </label>
                    <input
                      type="datetime-local"
                      value={paymentDatetime}
                      onChange={(e) => setPaymentDatetime(e.target.value)}
                      min={minDatetime()}
                      max={nowLocalDatetime()}
                      className="input-field text-sm"
                    />
                    <p className="text-white/30 text-xs mt-1">
                      Payments older than 48 hours will be reviewed by our team.
                    </p>
                  </div>

                  <div>
                    <label className="text-white/60 text-sm block mb-2">Transaction ID / UTR Number *</label>
                    <input
                      value={txnId}
                      onChange={(e) => setTxnId(e.target.value)}
                      placeholder="e.g. 123456789012"
                      className="input-field"
                    />
                    <p className="text-white/30 text-xs mt-1">
                      Find this in your Paytm / UPI app under payment history.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setStep('method')} className="btn-ghost flex-1 py-2.5">Back</button>
                    <button onClick={handleSubmit} disabled={isLoading || !txnId.trim()} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
                      {isLoading ? <><i className="pi pi-spin pi-spinner mr-2" />Processing...</> : <><i className="pi pi-check mr-2" />Confirm ₹{amount}</>}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
