import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../hooks/useCurrency';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, removeItem, total } = useCartStore();
  const { isAuthenticated, user } = useAuth();
  const { format } = useCurrency();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (!isAuthenticated) { navigate('/login'); onClose(); return; }
    onClose();
    navigate('/checkout');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm glass border-l border-white/10 z-50 flex flex-col"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <i className="pi pi-shopping-cart text-indigo-400" /> Cart ({items.length})
              </h2>
              <button onClick={onClose} className="p-2 text-white/50 hover:text-white">
                <i className="pi pi-times" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/30">
                  <i className="pi pi-shopping-cart text-5xl mb-3" />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item._id} className="flex items-center gap-3 p-3 glass rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${item.gradientFrom}, ${item.gradientTo})` }}>
                      {item.platform[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.name}</p>
                      <p className="text-white/40 text-xs">{item.duration}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-400 font-bold">{format(item.price)}</span>
                      <button onClick={() => removeItem(item._id)} className="p-1 text-white/30 hover:text-red-400 transition-colors">
                        <i className="pi pi-trash text-xs" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-4 border-t border-white/10 space-y-3">
                <div className="flex justify-between text-white">
                  <span className="text-white/60">Total</span>
                  <span className="font-bold text-xl">{format(total())}</span>
                </div>
                {user && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Wallet Balance</span>
                    <span className={user.wallet >= total() ? 'text-green-400' : 'text-red-400'}>
                      {format(user.wallet)}
                    </span>
                  </div>
                )}
                <button onClick={handleCheckout} className="w-full btn-primary py-3 font-semibold">
                  <span className="flex items-center justify-center gap-2">
                    <i className="pi pi-arrow-right" /> Proceed to Checkout
                  </span>
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
