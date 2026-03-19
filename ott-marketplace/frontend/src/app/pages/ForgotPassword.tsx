import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import api from '../utils/api';

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>();

  const onSubmit = async ({ email }: { email: string }) => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch { /* always show success to prevent enumeration */ }
    setLoading(false);
    setSent(true);
  };

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
          <h1 className="text-white font-bold text-2xl mt-4">Reset your password</h1>
          <p className="text-white/40 text-sm mt-1">
            Enter your email and we'll send you a secure reset link
          </p>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/10 shadow-2xl">
          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                <i className="pi pi-envelope text-indigo-400 text-2xl" />
              </div>
              <p className="text-white font-semibold text-lg mb-2">Check your inbox</p>
              <p className="text-white/50 text-sm leading-relaxed">
                If an account exists for this email, we've sent a password reset link. Check your spam folder too.
              </p>
              <Link
                to="/login"
                className="inline-block mt-6 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
              >
                ← Back to sign in
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="text-white/70 text-sm font-medium block mb-2">Email</label>
                <div className="relative">
                  <i className="pi pi-envelope absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                  <input
                    {...register('email', {
                      required: 'Email required',
                      pattern: { value: /^\S+@\S+\.\S+$/i, message: 'Invalid email address' },
                    })}
                    type="email"
                    placeholder="you@example.com"
                    className="input-field pl-10"
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-50"
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="pi pi-spin pi-spinner" /> Sending...
                  </span>
                ) : 'Send reset link'}
              </motion.button>

              <p className="text-center text-white/40 text-sm">
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  ← Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
