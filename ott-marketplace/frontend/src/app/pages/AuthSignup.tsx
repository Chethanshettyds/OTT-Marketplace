import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import GoogleAuthButton from '../components/GoogleAuthButton';

interface SignupForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function AuthSignup() {
  const { register: registerUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<SignupForm>();

  const onSubmit = async (data: SignupForm) => {
    try {
      await registerUser(data.name, data.email, data.password);
      toast.success('Account created! Welcome to OTT Marketplace.');
      navigate('/shop');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
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
          <h1 className="text-white font-bold text-2xl mt-4">Create account</h1>
          <p className="text-white/40 text-sm mt-1">Join thousands saving on streaming</p>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-white/70 text-sm font-medium block mb-2">Full Name</label>
              <div className="relative">
                <i className="pi pi-user absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                <input
                  {...register('name', { required: 'Name required', minLength: { value: 2, message: 'Min 2 characters' } })}
                  placeholder="John Doe"
                  className="input-field pl-10"
                />
              </div>
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>

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
                  {...register('password', { required: 'Password required', minLength: { value: 6, message: 'Min 6 characters' } })}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <i className={`pi ${showPass ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="text-white/70 text-sm font-medium block mb-2">Confirm Password</label>
              <div className="relative">
                <i className="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                <input
                  {...register('confirmPassword', {
                    required: 'Please confirm password',
                    validate: (v) => v === watch('password') || 'Passwords do not match',
                  })}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field pl-10"
                />
              </div>
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-50 mt-2"
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="pi pi-spin pi-spinner" /> Creating account...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="pi pi-user-plus" /> Create Account
                </span>
              )}
            </motion.button>
          </form>

          <p className="text-center text-white/40 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>

          <GoogleAuthButton />
        </div>
      </motion.div>
    </div>
  );
}
