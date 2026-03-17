import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// Extend window for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          prompt: () => void;
          renderButton: (el: HTMLElement, config: object) => void;
          cancel: () => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function GoogleAuthButton() {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  // Load Google Identity Services SDK once
  useEffect(() => {
    if (window.google) { setSdkReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => console.error('Failed to load Google SDK');
    document.head.appendChild(script);
  }, []);

  // Initialize Google once SDK is ready
  useEffect(() => {
    if (!sdkReady || !window.google || !CLIENT_ID) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
  }, [sdkReady]);

  const handleCredentialResponse = async (response: { credential: string }) => {
    setLoading(true);
    try {
      await googleLogin(response.credential);
      toast.success('Signed in with Google');
      const { user } = useAuthStore.getState();
      navigate(user?.role === 'admin' ? '/admin' : '/shop');
    } catch (err: any) {
      toast.error(err.message || 'Google auth failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (!CLIENT_ID) {
      toast.error('Google Sign-In is not configured yet');
      return;
    }
    if (!window.google) {
      toast.error('Google SDK not loaded. Check your connection.');
      return;
    }
    window.google.accounts.id.prompt();
  };

  return (
    <div className="w-full">
      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs font-medium">or continue with</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Custom Google button */}
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={loading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="google-auth-btn w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm text-white/90 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <i className="pi pi-spin pi-spinner text-base" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            {/* Google "G" SVG logo */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </motion.button>

      {/* Hidden div for Google's own renderer (fallback) */}
      <div ref={btnRef} className="hidden" />
    </div>
  );
}
