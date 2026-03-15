import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface LoginForm {
  email: string;
  password: string;
}

export default function AuthLogin() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      // Redirect based on role from the store after login
      const { user } = useAuthStore.getState();
      if (user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/shop');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      {/* Background glow */}
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
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-xl">O</span>
            </div>
          </Link>
          <h1 className="text-white font-bold text-2xl mt-4">Welcome back</h1>
          <p className="text-white/40 text-sm mt-1">Sign in to your OTT Marketplace account</p>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="text-white/70 text-sm font-medium block mb-2">Email</label>
              <div className="relative">
                <i className="pi pi-envelope absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                <input
                  {...register('email', { required: 'Email required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })}
                  type="email"
                  placeholder="you@example.com"
                  className="input-field pl-10"
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="text-white/70 text-sm font-medium block mb-2">Password</label>
              <div className="relative">
                <i className="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                <input
                  {...register('password', { required: 'Password required' })}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  <i className={`pi ${showPass ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-50"
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="pi pi-spin pi-spinner" /> Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="pi pi-sign-in" /> Sign In
                </span>
              )}
            </motion.button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white/50 text-xs font-medium mb-2">Demo Accounts:</p>
            <div className="space-y-1 text-xs text-white/40">
              <p><span className="text-indigo-400">Admin:</span> chethanshetty242@gmail.com</p>
              <p><span className="text-purple-400">User:</span> user@site.com / user123</p>
            </div>
          </div>

          <p className="text-center text-white/40 text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
