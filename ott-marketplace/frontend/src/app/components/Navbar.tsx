import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useCartStore } from '../store/cartStore';
import { useCurrency } from '../hooks/useCurrency';
import { CURRENCIES } from '../utils/currency';
import { useNotifications } from '../hooks/useNotifications';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { items } = useCartStore();
  const { currency, setCurrency, format } = useCurrency();
  const { counts } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const location = useLocation();

  const navLinks = isAdmin
    ? [{ to: '/admin', label: 'Admin Panel', icon: 'pi-cog', badge: counts.support }]
    : [
        { to: '/shop', label: 'Shop', icon: 'pi-shopping-bag', badge: 0 },
        { to: '/dashboard', label: 'Dashboard', icon: 'pi-th-large', badge: 0 },
        { to: '/tickets', label: 'Support', icon: 'pi-ticket', badge: counts.support },
        { to: '/broadcasts', label: 'Broadcasts', icon: 'pi-megaphone', badge: counts.broadcasts },
      ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="font-bold text-white text-lg">
              OTT<span className="text-indigo-400">Market</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname.startsWith(link.to)
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <i className={`pi ${link.icon} text-xs`} />
                {link.label}
                {link.badge > 0 && (
                  <motion.span
                    key={link.badge}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${
                      link.to === '/tickets' ? 'bg-blue-500' : 'bg-red-500'
                    }`}
                  >
                    {link.badge > 99 ? '99+' : link.badge}
                  </motion.span>
                )}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isAuthenticated && !isAdmin && (
              <>
                {/* Cart */}
                <Link to="/shop" className="relative p-2 text-white/70 hover:text-white transition-colors">
                  <i className="pi pi-shopping-cart text-lg" />
                  {items.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                      {items.length}
                    </span>
                  )}
                </Link>
                {/* Wallet */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg text-sm">
                  <i className="pi pi-wallet text-indigo-400 text-xs" />
                  <span className="text-white font-semibold">{format(user?.wallet ?? 0)}</span>
                </div>
                {/* Currency switcher */}
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setCurrencyOpen(!currencyOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 glass rounded-lg text-sm hover:bg-white/10 transition-colors"
                  >
                    <span>{CURRENCIES.find((c) => c.code === currency)?.flag}</span>
                    <span className="text-white/70 font-medium">{currency}</span>
                    <i className="pi pi-chevron-down text-white/30 text-xs" />
                  </button>
                  <AnimatePresence>
                    {currencyOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 mt-2 w-44 glass rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50"
                      >
                        {CURRENCIES.map((c) => (
                          <button
                            key={c.code}
                            onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                              currency === c.code
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'text-white/70 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <span>{c.flag}</span>
                            <span className="font-medium">{c.symbol}</span>
                            <span className="text-white/50 text-xs">{c.code}</span>
                            {currency === c.code && <i className="pi pi-check text-xs ml-auto text-indigo-400" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg hover:bg-white/10 transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className="hidden sm:block text-white text-sm font-medium">{user?.name?.split(' ')[0]}</span>
                  <i className="pi pi-chevron-down text-white/50 text-xs" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-48 glass rounded-xl border border-white/10 shadow-2xl overflow-hidden"
                    >
                      <div className="p-3 border-b border-white/10">
                        <p className="text-white font-medium text-sm">{user?.name}</p>
                        <p className="text-white/50 text-xs">{user?.email}</p>
                      </div>
                      {!isAdmin && (
                        <Link
                          to="/dashboard"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        >
                          <i className="pi pi-user text-xs" /> Profile
                        </Link>
                      )}
                      <Link
                        to={isAdmin ? '/admin?tab=Settings' : '/settings'}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors border-b border-white/10"
                      >
                        <i className="pi pi-cog text-xs" /> Settings
                      </Link>
                      <button
                        onClick={() => { logout(); setMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
                      >
                        <i className="pi pi-sign-out text-xs" /> Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost text-sm py-1.5 px-3">Login</Link>
                <Link to="/signup" className="btn-primary text-sm py-1.5 px-3">Sign Up</Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 text-white/70 hover:text-white"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <i className={`pi ${menuOpen ? 'pi-times' : 'pi-bars'} text-lg`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-white/10 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="relative flex items-center gap-3 px-4 py-3 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <i className={`pi ${link.icon}`} />
                  {link.label}
                  {link.badge > 0 && (
                    <span className={`ml-auto min-w-[20px] h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center text-white ${
                      link.to === '/tickets' ? 'bg-blue-500' : 'bg-red-500'
                    }`}>
                      {link.badge > 99 ? '99+' : link.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
