import { useState } from 'react';
import { motion } from 'framer-motion';
import { platformLetters } from '../utils/threeHelpers';

interface Product {
  _id: string;
  name: string;
  platform: string;
  category: string;
  price: number;
  originalPrice: number;
  duration: string;
  stock: number;
  gradientFrom: string;
  gradientTo: string;
  features: string[];
  isFeatured: boolean;
  imageUrl?: string;
}

interface ProductCard3DProps {
  product: Product;
  onBuy: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  inCart: boolean;
}

export default function ProductCard3D({ product, onBuy, onAddToCart, inCart }: ProductCard3DProps) {
  const [hovered, setHovered] = useState(false);
  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  const letter = platformLetters[product.platform] || product.platform[0];

  return (
    <motion.div
      className="relative cursor-pointer select-none"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Featured badge */}
      {product.isFeatured && (
        <div className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
          HOT
        </div>
      )}

      {/* Discount badge */}
      <div className="absolute -top-2 -left-2 z-10 bg-gradient-to-r from-green-400 to-emerald-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
        -{discount}%
      </div>

      <div
        className="glass rounded-2xl overflow-hidden border border-white/10 transition-all duration-300"
        style={{
          boxShadow: hovered
            ? `0 20px 60px ${product.gradientFrom}40, 0 0 30px ${product.gradientFrom}20`
            : '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Card header with gradient */}
        <div
          className="relative h-36 flex items-center justify-center overflow-hidden"
          style={{
            background: product.imageUrl
              ? 'transparent'
              : `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
          }}
        >
          {product.imageUrl ? (
            /* Product image */
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                // fallback to gradient + letter on broken image
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement!;
                parent.style.background = `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`;
                const fallback = parent.querySelector<HTMLElement>('.img-fallback');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}

          {/* Fallback letter (shown when no image or image fails) */}
          <div
            className="img-fallback absolute inset-0 flex items-center justify-center"
            style={{ display: product.imageUrl ? 'none' : 'flex' }}
          >
            {/* Animated background circles */}
            <motion.div
              className="absolute w-32 h-32 rounded-full opacity-20"
              style={{ background: product.gradientFrom }}
              animate={hovered ? { scale: 1.5, opacity: 0.3 } : { scale: 1, opacity: 0.2 }}
              transition={{ duration: 0.4 }}
            />
            <motion.div
              className="absolute w-20 h-20 rounded-full opacity-30 -bottom-4 -right-4"
              style={{ background: product.gradientTo }}
              animate={hovered ? { scale: 1.3 } : { scale: 1 }}
              transition={{ duration: 0.4 }}
            />
            <motion.div
              className="relative z-10 text-white font-black text-5xl"
              style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
              animate={hovered ? { scale: 1.1, rotateY: 15 } : { scale: 1, rotateY: 0 }}
              transition={{ duration: 0.3 }}
            >
              {letter}
            </motion.div>
          </div>

          {/* Stock indicator */}
          {product.stock < 10 && (
            <div className="absolute bottom-2 right-2 bg-red-500/80 text-white text-xs px-2 py-0.5 rounded-full">
              Only {product.stock} left
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-white font-semibold text-sm leading-tight">{product.name}</h3>
              <span className="text-white/40 text-xs">{product.duration}</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
              {product.category}
            </span>
          </div>

          {/* Features */}
          <div className="flex flex-wrap gap-1 mb-3">
            {product.features.slice(0, 2).map((f) => (
              <span key={f} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                {f}
              </span>
            ))}
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="text-2xl font-black"
              style={{ color: product.gradientFrom }}
            >
              ${product.price}
            </span>
            <span className="text-white/30 text-sm line-through">${product.originalPrice}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <motion.button
              onClick={() => onBuy(product)}
              className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
                boxShadow: hovered ? `0 4px 20px ${product.gradientFrom}60` : 'none',
              }}
              whileTap={{ scale: 0.97 }}
            >
              <i className="pi pi-bolt mr-1 text-xs" />
              Buy Now
            </motion.button>
            <motion.button
              onClick={() => onAddToCart(product)}
              className={`p-2 rounded-lg border transition-all duration-200 ${
                inCart
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                  : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <i className={`pi ${inCart ? 'pi-check' : 'pi-shopping-cart'} text-sm`} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
