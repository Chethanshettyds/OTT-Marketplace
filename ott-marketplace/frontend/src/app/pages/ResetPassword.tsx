import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface ResetForm {
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

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [tokenValid, setTokenValid] = useState<boolean | null>(null); // null = checking
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetForm>();
  const newPassword = watch('newPassword', '');

  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    api.post('/auth/validate-reset-token', { token })
      .then(({ data }) => setTokenValid(data.valid))
      .catch(() => setTokenValid(false));
  }, [token]);

  const onSubmit = async ({ newPassword, confirmPassword }: ResetForm) => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    }
    setLoading(false);
  };

  // Loading state while validating token
  if (tokenValid === null) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <i className="pi pi-spin pi-spinner text-white/40 text-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-xl">O</span>
            </div>
          </Link>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/10 shadow-2xl">
          {/* Invalid / expired token */}
          {!tokenValid && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <i className="pi pi-times-circle text-red-400 text-2xl" />
              </div>
              <p className="text-white font-semibold text-lg mb-2">Link invalid or expired</p>
              <p className="text-white/50 text-sm mb-6">
                This reset link is no longer valid. Links expire after 1 hour and can only be used once.
              </p>
              <Link to="/forgot-password" className="btn-primary px-6 py-2.5 text-sm font-semibold inline-block">
                Request a new link
              </Link>
            </div>
          )}

          {/* Success state */}
          {tokenValid && success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <i className="pi pi-check-circle text-emerald-400 text-2xl" />
              </div>
              <p className="text-white font-semibold text-lg mb-2">Password updated</p>
              <p className="text-white/50 text-sm mb-6">Your password has been changed successfully.</p>
              <button onClick={() => navigate('/login')} className="btn-primary px-6 py-2.5 text-sm font-semibold">
                Continue to login
              </button>
            </motion.div>
          )}

          {/* Reset form */}
          {tokenValid && !success && (
            <>
              <h2 className="text-white font-bold text-xl mb-1">Create a new password</h2>
              <p className="text-white/40 text-sm mb-6">Must be at least 8 characters with letters and numbers.</p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="text-white/70 text-sm font-medium block mb-2">New password</label>
                  <div className="relative">
                    <i className="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                    <input
                      {...register('newPassword', {
                        required: 'Password required',
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

                <div>
                  <label className="text-white/70 text-sm font-medium block mb-2">Confirm password</label>
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

                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-50"
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="pi pi-spin pi-spinner" /> Updating...
                    </span>
                  ) : 'Update password'}
                </motion.button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
