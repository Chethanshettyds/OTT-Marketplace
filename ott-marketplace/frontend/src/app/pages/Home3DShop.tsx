import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import ProductCard3D from '../components/ProductCard3D';
import CartDrawer from '../components/CartDrawer';
import WalletTopupModal from '../components/WalletTopupModal';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../hooks/useCurrency';
import toast from 'react-hot-toast';

const Scene3D = lazy(() => import('../../canvas/Scene3D'));

interface Product {
  _id: string; name: string; platform: string; category: string;
  price: number; originalPrice: number; duration: string; stock: number;
  stockStatus?: string;
  gradientFrom: string; gradientTo: string; features: string[];
  isFeatured: boolean; imageUrl?: string;
}

const CATEGORIES = ['All', 'Video', 'Music', 'Gaming', 'Bundle'];
const SORT_OPTIONS = [
  { value: 'popular', label: '🔥 Popular' },
  { value: 'price_asc', label: '₹ Low to High' },
  { value: 'price_desc', label: '₹ High to Low' },
  { value: 'discount', label: '🏷️ Best Discount' },
];

const CATEGORY_ICONS: Record<string, string> = {
  Video: '📺', Music: '🎵', Gaming: '🎮', Bundle: '📦', All: '✨',
};

// ─── Shared product fetcher ───────────────────────────────────────────────────
function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/products')
      .then(({ data }) => setProducts(data.products))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);
  return { products, loading };
}

// ─── GUEST SHOP ───────────────────────────────────────────────────────────────
function GuestShop({ products, loading }: { products: Product[]; loading: boolean }) {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const featured = products.filter((p) => p.isFeatured).slice(0, 3);
  const topSellers = products.slice(0, 4);
  const { format } = useCurrency();

  const CATEGORY_LIST = [
    { icon: '📺', label: 'Streaming', desc: 'Netflix, Prime, Disney+' },
    { icon: '🎵', label: 'Music', desc: 'Spotify, Apple Music' },
    { icon: '🎮', label: 'Gaming', desc: 'Xbox, PlayStation' },
    { icon: '📦', label: 'Bundles', desc: 'Best value packs' },
  ];

  return (
    <div className="min-h-screen gradient-bg">
      {/* Hero */}
      <section ref={heroRef} className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0 opacity-60">
          <Suspense fallback={null}>
            <Scene3D products={products.slice(0, 12)} height="100%" />
          </Suspense>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-28 text-center">
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-sm text-indigo-300 mb-6"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          >
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {products.length}+ Premium Subscriptions Available
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight"
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          >
            Cheapest{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Streaming
            </span>
            <br />Subscriptions
          </motion.h1>

          <motion.p
            className="text-xl text-white/60 max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          >
            Netflix, Spotify, Disney+, Prime Video and more — up to 80% off retail price.
            Instant delivery, secure payments.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          >
            <Link to="/signup">
              <motion.button
                className="btn-primary px-8 py-4 text-lg font-semibold rounded-xl flex items-center gap-2"
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              >
                <i className="pi pi-user-plus" /> Get Started Free
              </motion.button>
            </Link>
            <motion.button
              onClick={() => document.getElementById('guest-products')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-ghost px-8 py-4 text-lg font-semibold rounded-xl flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
            >
              <i className="pi pi-shopping-bag" /> Browse Deals
            </motion.button>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex items-center justify-center gap-10 mt-14"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          >
            {[
              { label: 'Happy Customers', value: '10K+' },
              { label: 'Subscriptions', value: `${products.length}+` },
              { label: 'Avg Savings', value: '75%' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-black text-white">{s.value}</div>
                <div className="text-white/40 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 py-12">
        <motion.h2
          className="text-white font-bold text-2xl mb-6 text-center"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          🔥 Top Categories
        </motion.h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {CATEGORY_LIST.map((cat, i) => (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="glass rounded-2xl border border-white/10 p-5 text-center hover:border-indigo-500/40 transition-all cursor-pointer group"
              onClick={() => navigate('/signup')}
            >
              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform inline-block">{cat.icon}</div>
              <p className="text-white font-semibold text-sm">{cat.label}</p>
              <p className="text-white/40 text-xs mt-1">{cat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Top Sellers teaser */}
      <section id="guest-products" className="relative z-10 max-w-5xl mx-auto px-4 pb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-bold text-2xl">🏆 Top Sellers</h2>
            <p className="text-white/40 text-sm">Most popular subscriptions this month</p>
          </div>
          <Link to="/signup">
            <button className="btn-ghost text-sm py-2 px-4">View All →</button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => <div key={i} className="glass rounded-2xl h-64 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {topSellers.map((p, i) => (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="glass rounded-2xl border border-white/10 overflow-hidden group cursor-pointer hover:border-indigo-500/40 transition-all"
                onClick={() => navigate('/signup')}
              >
                <div className="h-28 flex items-center justify-center text-5xl font-black text-white relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}>
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    : <span>{p.platform?.[0] ?? '?'}</span>
                  }
                  <div className="absolute top-2 left-2 bg-green-400 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    -{Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-white/40 text-xs mb-3">{p.duration}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-indigo-400 font-black text-lg">{format(p.price)}</span>
                    <span className="text-xs px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg">Login to Buy</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* CTA Banner */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-3xl p-10 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.2))' }}
        >
          <div className="absolute inset-0 border border-indigo-500/20 rounded-3xl" />
          <h2 className="text-white font-black text-3xl mb-3">Join 10,000+ Happy Subscribers</h2>
          <p className="text-white/60 mb-8">Sign up free and get access to all premium subscriptions at unbeatable prices.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <motion.button
                className="btn-primary px-10 py-4 text-lg font-bold rounded-xl"
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              >
                <i className="pi pi-user-plus mr-2" /> Create Free Account
              </motion.button>
            </Link>
            <Link to="/login" className="text-white/60 hover:text-white text-sm transition-colors">
              Already have an account? Login →
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

// ─── USER SHOP (authenticated marketplace) ───────────────────────────────────
function UserShop({ products, loading }: { products: Product[]; loading: boolean }) {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const { addItem, items } = useCartStore();
  const { user, isAuthenticated } = useAuth();
  const { format } = useCurrency();
  const navigate = useNavigate();

  // Filter + sort
  const filtered = (() => {
    let result = products;
    if (category !== 'All') result = result.filter((p) => p.category === category);
    if (inStockOnly) result = result.filter((p) => p.stock > 0);
    if (search) result = result.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.platform.toLowerCase().includes(search.toLowerCase())
    );
    if (sort === 'price_asc') result = [...result].sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') result = [...result].sort((a, b) => b.price - a.price);
    else if (sort === 'discount') result = [...result].sort((a, b) =>
      ((b.originalPrice - b.price) / b.originalPrice) - ((a.originalPrice - a.price) / a.originalPrice)
    );
    else result = [...result].sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || 0); // in-stock first for popular
    return result;
  })();

  const recommended = products.filter((p) => p.isFeatured).slice(0, 4);

  const handleBuy = async (product: Product) => {
    if ((user?.wallet ?? 0) < product.price) {
      toast.error('Insufficient balance. Top up your wallet first.');
      setWalletOpen(true);
      return;
    }
    try {
      await api.post('/orders', { productId: product._id });
      toast.success(`${product.name} purchased!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Purchase failed');
    }
  };

  const handleAddToCart = (product: Product) => {
    addItem({ ...product, logo: '', color: product.gradientFrom });
    toast.success('Added to cart');
  };

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">

        {/* Personal header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 flex-wrap gap-4"
        >
          <div>
            <h1 className="text-white font-black text-3xl">
              Hey, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-white/40 text-sm mt-1">Find your next subscription below</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Wallet chip */}
            <div className="flex items-center gap-2 glass rounded-xl px-4 py-2.5 border border-white/10">
              <i className="pi pi-wallet text-indigo-400 text-sm" />
              <div>
                <p className="text-white/40 text-xs leading-none">Wallet</p>
                <p className="text-white font-bold text-sm">{format(user?.wallet ?? 0)}</p>
              </div>
              <button
                onClick={() => setWalletOpen(true)}
                className="ml-2 text-xs px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg hover:bg-indigo-500/30 transition-colors"
              >
                + Top Up
              </button>
            </div>
            {/* Cart */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-3 glass rounded-xl border border-white/10 text-white/70 hover:text-white transition-colors"
            >
              <i className="pi pi-shopping-cart text-lg" />
              {items.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                  {items.length}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* Recommended */}
        {recommended.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mb-10"
          >
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-xl">⭐</span> Recommended For You
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {recommended.map((p) => (
                <motion.div
                  key={p._id}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="glass rounded-2xl border border-white/10 overflow-hidden cursor-pointer hover:border-indigo-500/40 transition-all"
                  onClick={() => handleBuy(p)}
                >
                  <div className="h-20 flex items-center justify-center text-3xl font-black text-white relative"
                    style={{ background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}>
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      : p.platform?.[0] ?? '?'
                    }
                    <div className="absolute top-1.5 left-1.5 bg-orange-400 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                      HOT
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-white text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-indigo-400 font-bold text-sm mt-1">{format(p.price)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Search + Sort bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3 mb-5"
        >
          <div className="relative flex-1">
            <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subscriptions..."
              className="input-field pl-9 py-2.5 text-sm w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <i className="pi pi-times text-xs" />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input-field text-sm py-2.5 sm:w-44"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#0f0f1a]">{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setInStockOnly(!inStockOnly)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
              inStockOnly
                ? 'bg-green-500/20 border-green-500/40 text-green-400'
                : 'glass border-white/10 text-white/50 hover:text-white'
            }`}
          >
            🟢 In Stock Only
          </button>
        </motion.div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                category === cat
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'glass text-white/60 hover:text-white'
              }`}
            >
              <span>{CATEGORY_ICONS[cat]}</span> {cat}
            </button>
          ))}
        </div>

        {/* Grid header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-xl">All Subscriptions</h2>
            <p className="text-white/40 text-sm">{filtered.length} products available</p>
          </div>
          {search && (
            <p className="text-white/40 text-sm">Results for "<span className="text-white">{search}</span>"</p>
          )}
        </div>

        {/* Products grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <i className="pi pi-search text-5xl mb-4 block" />
            <p className="text-lg">No subscriptions found</p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-3 text-indigo-400 text-sm hover:underline">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${category}-${sort}`}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {filtered.map((product, i) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                >
                  <ProductCard3D
                    product={product}
                    onBuy={handleBuy}
                    onAddToCart={handleAddToCart}
                    inCart={items.some((it) => it._id === product._id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <WalletTopupModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}

// ─── ROOT: auth-aware switch ──────────────────────────────────────────────────
export default function Home3DShop() {
  const { isAuthenticated } = useAuth();
  const { products, loading } = useProducts();

  return isAuthenticated
    ? <UserShop products={products} loading={loading} />
    : <GuestShop products={products} loading={loading} />;
}
