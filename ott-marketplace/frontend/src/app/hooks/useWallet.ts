import { useEffect } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useAuthStore } from '../store/authStore';

export function useWallet() {
  const { balance, isLoading, topup, fetchBalance } = useWalletStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) fetchBalance();
  }, [user]);

  return {
    balance: user?.wallet ?? balance,
    isLoading,
    topup,
    fetchBalance,
  };
}
