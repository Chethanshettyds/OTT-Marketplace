import { create } from 'zustand';

export interface CartItem {
  _id: string;
  name: string;
  platform: string;
  price: number;
  duration: string;
  logo: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    const exists = get().items.find((i) => i._id === item._id);
    if (!exists) set((s) => ({ items: [...s.items, item] }));
  },

  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i._id !== id) })),

  clearCart: () => set({ items: [] }),

  total: () => get().items.reduce((sum, i) => sum + i.price, 0),
}));
