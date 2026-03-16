import { useEffect, useRef } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useAuthStore } from '../store/authStore';

export function useWallet() {
  const { balance, isLoading, topup, fetchBalance } = useWalletStore();
  const { user } = useAuthStore();
  const fetchedRef = useRef(false);

  // Only fetch once per user session — use user._id as stable key, not the whole object
  useEffect(() => {
    if (user?._id && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchBalance();
    }
    if (!user?._id) {
      fetchedRef.current = false;
    }
  }, [user?._id]);

  return {
    balance: user?.wallet ?? balance,
    isLoading,
    topup,
    fetchBalance,
  };
}
