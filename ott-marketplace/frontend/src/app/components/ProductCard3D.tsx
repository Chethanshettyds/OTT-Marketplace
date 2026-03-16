import { useState } from 'react';
import { motion } from 'framer-motion';
import { platformLetters } from '../utils/threeHelpers';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface Product {
  _id: string;
  name: string;
  platform: string;
  category: string;
  price: number;
  originalPrice: number;
  duration: string;
  stock: number;
  stockStatus?: string;
  gradientFrom: string;
  gradientTo: string;
  priceColor?: string;
  features: string[];
  services?: string[];
  isFeatured: boolean;
  isHot?: boolean;
  isLimited?: boolean;
  imageUrl?: string;
}

interface ProductCard3DProps {
  product: Product;
  onBuy: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  inCart: boolean;
}

function getStockStatus(product: Product) {
  if (product.stockStatus) return product.stockStatus;
  if (product.stock === 0) return 'out_of_stock';
  if (product.stock <= 5) return 'low_stock';
  return 'in_stock';
}

// Resolve price color: use stored priceColor or fall back to gradientFrom
function getPriceColor(product: Product): string {
  if (product.priceColor) return product.priceColor;
  return ''; // will use inline style fallback
}

export default function ProductCard3D({ product, onBuy, onAddToCart, inCart }: ProductCard3DProps) {
  const [hovered, setHovered] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [joining, setJoining] = useState(false);

  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  const letter = platformLetters[product.platform] || product.platform[0];
  const stockStatus = getStockStatus(product);
  const isOutOfStock = stockStatus === 'out_of_stock';
  const isLowStock = stockStatus === 'low_stock';
  const priceColorClass = getPriceColor(product);

  const handleJoinWaitlist = async () => {
    if (!waitlistEmail.trim()) return;
    setJoining(true);
    try {
      const { data } = await api.post(`/products/${product._id}/waitlist`, { email: waitlistEmail });
      toast.success(`You're #${data.position} on the waitlist!`);
      setShowWaitlist(false);
      setWaitlistEmail('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to join waitlist');
    } finally {
      setJoining(false);
    }
  };

  return (
    <motion.div
      className="relative cursor-pointer select-none"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Discount badge — top left */}
      <div className="absolute -top-2 -left-2 z-10 bg-gradient-to-r from-green-400 to-emerald-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">
        -{discount}%
      </div>

      {/* HOT badge — top right */}
      {(product.isHot || product.isFeatured) && !product.isLimited && (
        <div className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-2.5 py-0.5 rounded-full shadow-lg">
          HOT
        </div>
      )}

      {/* LIMITED badge — top right */}
      {product.isLimited && (
        <div className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-lg">
          LIMITED
        </div>
      )}

      <div
        className={`rounded-2xl overflow-hidden border transition-all duration-300 bg-[#12121f] ${
          isOutOfStock ? 'border-red-500/20 opacity-80' : 'border-white/10'
        }`}
        style={{
          boxShadow: hovered
            ? `0 20px 50px ${product.gradientFrom}50, 0 0 20px ${product.gradientFrom}20`
            : '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* Gradient image area */}
        <div
          className="relative h-36 flex items-center justify-center overflow-hidden"
          style={{
            background: product.imageUrl
              ? 'transparent'
              : `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
          }}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className={`w-full h-full object-cover ${isOutOfStock ? 'grayscale' : ''}`}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement!;
                parent.style.background = `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`;
                const fallback = parent.querySelector<HTMLElement>('.img-fallback');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}

          {/* Letter fallback */}
          <div
            className="img-fallback absolute inset-0 flex items-center justify-center"
            style={{ display: product.imageUrl ? 'none' : 'flex' }}
          >
            <motion.div
              className="absolute w-28 h-28 rounded-full opacity-20"
              style={{ background: product.gradientFrom }}
              animate={hovered ? { scale: 1.5, opacity: 0.3 } : { scale: 1, opacity: 0.2 }}
              transition={{ duration: 0.4 }}
            />
            <motion.div
              className="relative z-10 text-white font-black text-5xl"
              style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
              animate={hovered ? { scale: 1.1 } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {letter}
            </motion.div>
          </div>

          {/* Out of stock overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">🔴 Out of Stock</span>
            </div>
          )}

          {/* Low stock badge */}
          {!isOutOfStock && isLowStock && (
            <div className="absolute bottom-2 right-2 bg-orange-500/90 text-white text-xs px-2 py-0.5 rounded-full font-medium">
              ⚡ {product.stock} left
            </div>
          )}
          {!isOutOfStock && !isLowStock && product.stock < 20 && (
            <div className="absolute bottom-2 right-2 bg-green-500/80 text-white text-xs px-2 py-0.5 rounded-full">
              🟢 {product.stock} left
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-4">
          {/* Name + category */}
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-white font-semibold text-sm leading-tight flex-1 mr-2">{product.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 whitespace-nowrap flex-shrink-0">
              {product.category}
            </span>
          </div>

          {/* Duration */}
          <p className="text-white/40 text-xs mb-2">{product.duration}</p>

          {/* Services tags — matches screenshot "Prime Video  Prime Music" */}
          {product.services && product.services.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {product.services.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="text-xs px-2 py-0.5 rounded-md text-white/70"
                  style={{ background: `${product.gradientFrom}25`, border: `1px solid ${product.gradientFrom}40` }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Price row */}
          <div className="flex items-baseline gap-2 mb-4">
            <span
              className={`text-2xl font-black ${priceColorClass} ${isOutOfStock ? 'opacity-40' : ''}`}
              style={!priceColorClass ? { color: product.gradientFrom } : {}}
            >
              ₹{product.price}
            </span>
            <span className="text-white/30 text-sm line-through ml-auto">₹{product.originalPrice}</span>
          </div>

          {/* Actions */}
          {isOutOfStock ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowWaitlist(!showWaitlist)}
                className="w-full py-2 rounded-lg text-sm font-semibold border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                🔔 Notify When Available
              </button>
              {showWaitlist && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-2">
                  <input
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinWaitlist()}
                  />
                  <button onClick={handleJoinWaitlist} disabled={joining}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium disabled:opacity-50">
                    {joining ? '...' : 'Join'}
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <motion.button
                onClick={() => onBuy(product)}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5"
                style={{
                  background: isLowStock
                    ? 'linear-gradient(135deg, #f97316, #ef4444)'
                    : `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
                  boxShadow: hovered ? `0 4px 20px ${product.gradientFrom}60` : 'none',
                }}
                whileTap={{ scale: 0.97 }}
              >
                ⚡ Buy Now
              </motion.button>
              <motion.button
                onClick={() => onAddToCart(product)}
                className={`p-2.5 rounded-xl border transition-all duration-200 ${
                  inCart
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'
                }`}
                whileTap={{ scale: 0.9 }}
              >
                <i className={`pi ${inCart ? 'pi-check' : 'pi-shopping-cart'} text-sm`} />
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
