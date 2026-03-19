import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { PAYMENT_TYPES } from '../utils/paymentTypes';
import { useAuthStore } from '../store/authStore';

interface PaymentMethod {
  _id: string; type: string; label: string;
  upiId: string; qrCodeUrl: string; accountDetails: string; isDefault: boolean;
}

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains a letter', ok: /[a-zA-Z]/.test(password) },
    { label: 'Contains a number', ok: /\d/.test(password) },
  ];
  return (
    <div className="mt-2 space-y-1">
      {checks.map(({ label, ok }) => (
        <p key={label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-emerald-400' : 'text-white/30'}`}>
          <i className={`pi ${ok ? 'pi-check-circle' : 'pi-circle'} text-xs`} />
          {label}
        </p>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user, setToken } = useAuthStore();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [changingPw, setChangingPw] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<ChangePasswordForm>();
  const newPassword = watch('newPassword', '');

  useEffect(() => {
    api.get('/wallet/payment-methods')
      .then(({ data }) => setMethods(data.paymentMethods))
      .catch(() => toast.error('Failed to load payment methods'))
      .finally(() => setLoadingMethods(false));
  }, []);

  const onChangePassword = async ({ currentPassword, newPassword, confirmPassword }: ChangePasswordForm) => {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPw(true);
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
      // Refresh token so current session stays alive after password rotation
      if (data.token) setToken(data.token);
      toast.success('Password updated successfully');
      reset();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Something went wrong';
      toast.error(msg);
    }
    setChangingPw(false);
  };

  const isGoogleOnly = user && !user.password && !!user.googleId;

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-10">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
          <h1 className="text-white font-bold text-2xl flex items-center gap-2">
            <i className="pi pi-cog text-indigo-400" /> Settings
          </h1>
          <p className="text-white/40 text-sm mt-1">Manage your account preferences</p>
        </motion.div>

        {/* Payment Methods */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-white/10">
            <i className="pi pi-credit-card text-indigo-400" />
            <h2 className="text-white font-semibold">Payment Methods</h2>
            <span className="text-white/30 text-xs">({methods.length})</span>
          </div>
          <div className="p-4 space-y-3">
            {loadingMethods ? (
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
                  <motion.div key={m._id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-4 glass rounded-xl border border-white/10">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `${pt?.color || '#6366f1'}20`, border: `1px solid ${pt?.color || '#6366f1'}30` }}>
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
        </motion.div>

        {/* Password & Security */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-white/10">
            <i className="pi pi-shield text-indigo-400" />
            <h2 className="text-white font-semibold">Password &amp; Security</h2>
            {user?.role === 'admin' && (
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30 ml-1">
                Admin account
              </span>
            )}
          </div>

          <div className="p-5">
            {isGoogleOnly ? (
              <div className="text-center py-6 text-white/40">
                <i className="pi pi-google text-3xl mb-3 block text-white/20" />
                <p className="text-sm">You signed in with Google.</p>
                <p className="text-xs mt-1">Password change is not available for Google-only accounts.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
                {/* Current password */}
                <div>
                  <label className="text-white/70 text-sm font-medium block mb-2">Current password</label>
                  <div className="relative">
                    <i className="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                    <input
                      {...register('currentPassword', { required: 'Current password required' })}
                      type={showCurrent ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="input-field pl-10 pr-10"
                    />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      <i className={`pi ${showCurrent ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                    </button>
                  </div>
                  {errors.currentPassword && <p className="text-red-400 text-xs mt-1">{errors.currentPassword.message}</p>}
                </div>

                {/* New password */}
                <div>
                  <label className="text-white/70 text-sm font-medium block mb-2">New password</label>
                  <div className="relative">
                    <i className="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                    <input
                      {...register('newPassword', {
                        required: 'New password required',
                        minLength: { value: 8, message: 'At least 8 characters' },
                        pattern: { value: /(?=.*[a-zA-Z])(?=.*\d)/, message: 'Must contain letters and numbers' },
                      })}
                      type={showNew ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="input-field pl-10 pr-10"
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      <i className={`pi ${showNew ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                    </button>
                  </div>
                  {errors.newPassword && <p className="text-red-400 text-xs mt-1">{errors.newPassword.message}</p>}
                  {newPassword && <PasswordStrength password={newPassword} />}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="text-white/70 text-sm font-medium block mb-2">Confirm new password</label>
                  <div className="relative">
                    <i className="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                    <input
                      {...register('confirmPassword', { required: 'Please confirm your password' })}
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="input-field pl-10 pr-10"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      <i className={`pi ${showConfirm ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
                </div>

                <div className="flex justify-end pt-1">
                  <motion.button
                    type="submit"
                    disabled={changingPw}
                    className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                    whileTap={{ scale: 0.98 }}
                  >
                    {changingPw ? (
                      <span className="flex items-center gap-2">
                        <i className="pi pi-spin pi-spinner" /> Saving...
                      </span>
                    ) : 'Save changes'}
                  </motion.button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
