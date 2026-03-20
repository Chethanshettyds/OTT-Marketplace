import { create } from 'zustand';
import api from '../utils/api';
import { useAuthStore } from './authStore';

interface TopupResult {
  oldPayment: boolean;
  message: string;
  ticketNumber?: string;
  ticketId?: string;
}

interface WalletState {
  balance: number;
  isLoading: boolean;
  topup: (amount: number, method?: string, transactionId?: string, paymentTimestamp?: string) => Promise<TopupResult>;
  fetchBalance: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: 0,
  isLoading: false,

  fetchBalance: async () => {
    try {
      const { data } = await api.get('/wallet/balance');
      set({ balance: data.balance });
      useAuthStore.getState().updateUser({ wallet: data.balance });
    } catch {
      // ignore
    }
  },

  topup: async (amount: number, method = 'other', transactionId = '', paymentTimestamp?: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/wallet/topup', { amount, method, transactionId, paymentTimestamp });
      if (data.oldPayment) {
        set({ isLoading: false });
        return { oldPayment: true, message: data.message, ticketNumber: data.ticketNumber, ticketId: data.ticketId };
      }
      set({ balance: data.balance, isLoading: false });
      useAuthStore.getState().updateUser({ wallet: data.balance });
      return { oldPayment: false, message: data.message };
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(err.response?.data?.error || 'Top-up failed');
    }
  },
}));
