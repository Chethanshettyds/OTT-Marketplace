import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import api from '../utils/api';
import ProductCard3D from '../components/ProductCard3D';
import CartDrawer from '../components/CartDrawer';
import WalletTopupModal from '../components/WalletTopupModal';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const Scene3D = lazy(() => import('../../canvas/Scene3D'));

gsap.registerPlugin(ScrollTrigger);

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

const CATEGORIES = ['All', 'Video', 'Music', 'Gaming', 'Bundle'];

export default function Home3DShop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [buyLoading, setBuyLoading] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { addItem, items } = useCartStore();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let result = products;
    if (category !== 'All') result = result.filter((p) => p.category === category);
    if (search) result = result.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.platform.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [products, category, search]);

  useEffect(() => {
    if (!heroRef.current) return;
    gsap.fromTo('.hero-title', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' });
    gsap.fromTo('.hero-sub', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, delay: 0.3, ease: 'power3.out' });
    gsap.fromTo('.hero-cta', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.6, ease: 'power3.out' });
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data.products);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (product: Product) => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if ((user?.wallet ?? 0) < product.price) {
      toast.error('Insufficient balance. Top up your wallet first.');
      setWalletOpen(true);
      return;
    }
    setBuyLoading(product._id);
    try {
      await api.post('/orders', { productId: product._id });
      toast.success(`${product.name} purchased!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Purchase failed');
    } finally {
      setBuyLoading(null);
    }
  };

  const handleAddToCart = (product: Product) => {
    addItem({ ...product, logo: '', color: product.gradientFrom });
    toast.success('Added to cart');
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-16 overflow-hidden">
        {/* 3D Scene */}
        <div className="absolute inset-0 opacity-70">
          <Suspense fallback={<div className="w-full h-full bg-dark-900" />}>
            <Scene3D products={products.slice(0, 12)} height="100%" />
          </Suspense>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 pt-20 pb-32 text-center">
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-sm text-indigo-300 mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            12+ Premium Subscriptions Available
          </motion.div>

          <h1 className="hero-title text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Cheapest{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent neon-text">
              Streaming
            </span>
            <br />
            Subscriptions
          </h1>

          <p className="hero-sub text-xl text-white/60 max-w-2xl mx-auto mb-8">
            Netflix, Spotify, Disney+, Prime Video and more — up to 80% off retail price.
            Instant delivery, secure payments.
          </p>

          <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              onClick={() => document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-primary px-8 py-4 text-lg font-semibold rounded-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              <i className="pi pi-shopping-bag mr-2" />
              Browse Deals
            </motion.button>
            {isAuthenticated && (
              <motion.button
                onClick={() => setWalletOpen(true)}
                className="btn-ghost px-8 py-4 text-lg font-semibold rounded-xl"
                whileHover={{ scale: 1.05 }}
              >
                <i className="pi pi-wallet mr-2" />
                Top Up Wallet
              </motion.button>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 mt-12">
            {[
              { label: 'Happy Customers', value: '10K+' },
              { label: 'Subscriptions', value: '12+' },
              { label: 'Avg Savings', value: '75%' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-white/40 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop Grid */}
      <section id="shop-grid" className="relative z-10 max-w-7xl mx-auto px-4 py-16">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-white font-bold text-2xl">All Subscriptions</h2>
            <p className="text-white/40 text-sm">{filtered.length} products available</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative">
              <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subscriptions..."
                className="input-field pl-9 py-2 text-sm w-full sm:w-56"
              />
            </div>
            {/* Cart button */}
            <button
              onClick={() => setCartOpen(true)}
              className="btn-ghost flex items-center gap-2 py-2 px-4 relative"
            >
              <i className="pi pi-shopping-cart" />
              Cart
              {items.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                  {items.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                category === cat
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'glass text-white/60 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.05 }}
          >
            {filtered.map((product) => (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ProductCard3D
                  product={product}
                  onBuy={handleBuy}
                  onAddToCart={handleAddToCart}
                  inCart={items.some((i) => i._id === product._id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-white/30">
            <i className="pi pi-search text-5xl mb-4 block" />
            <p className="text-lg">No subscriptions found</p>
          </div>
        )}
      </section>

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <WalletTopupModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
