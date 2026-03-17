import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useCartStore } from '../store/cartStore';
import { useCurrency } from '../hooks/useCurrency';
import { CURRENCIES } from '../utils/currency';
import { useNotifications } from '../hooks/useNotifications';

// ── Bulletproof outside-click hook ───────────────────────────────────────────
function useOutsideClick(ref: React.RefObject<HTMLElement>, onClose: () => void, enabled: boolean) {
  const handler = useCallback((e: MouseEvent | TouchEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) onClose();
  }, [ref, onClose]);

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', onEsc);
    };
  }, [enabled, handler, onClose]);
}

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { items } = useCartStore();
  const { currency, setCurrency, format } = useCurrency();
  const { counts } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);

  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  const closeCurrency = useCallback(() => setCurrencyOpen(false), []);

  useOutsideClick(userMenuRef, closeUserMenu, userMenuOpen);
  useOutsideClick(currencyRef, closeCurrency, currencyOpen);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setUserMenuOpen(false); }, [location.pathname]);

  const navLinks = !isAuthenticated
    ? [{ to: '/shop', label: 'Shop', icon: 'pi-shopping-bag', badge: 0 }]
    : isAdmin
    ? [{ to: '/admin', label: 'Admin Panel', icon: 'pi-cog', badge: counts.support }]
    : [
        { to: '/shop',       label: 'Shop',       icon: 'pi-shopping-bag', badge: 0 },
        { to: '/dashboard',  label: 'Dashboard',  icon: 'pi-th-large',     badge: 0 },
        { to: '/tickets',    label: 'Support',    icon: 'pi-ticket',       badge: counts.support },
        { to: '/broadcasts', label: 'Broadcasts', icon: 'pi-megaphone',    badge: counts.broadcasts },
      ];

  const handleLogout = () => { setUserMenuOpen(false); logout(); };

  const menuItem = (icon: string, label: string, to: string) => (
    <Link
      to={to}
      onClick={() => setUserMenuOpen(false)}
      className="flex items-center gap-3 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors rounded-lg mx-1"
    >
      <i className={`pi ${icon} text-xs w-4`} />
      {label}
    </Link>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
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

          {/* Desktop nav links */}
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
                      link.to === '/tickets' ? 'bg-blue-500' : link.to === '/admin' ? 'bg-red-500' : 'bg-red-500'
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

            {/* User-only: wallet + currency */}
            {isAuthenticated && !isAdmin && (
              <>
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg text-sm">
                  <i className="pi pi-wallet text-indigo-400 text-xs" />
                  <span className="text-white font-semibold">{format(user?.wallet ?? 0)}</span>
                </div>
                {/* Currency switcher */}
                <div ref={currencyRef} className="relative hidden sm:block">
                  <button
                    onClick={() => setCurrencyOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 glass rounded-lg text-sm hover:bg-white/10 transition-colors"
                  >
                    <span>{CURRENCIES.find((c) => c.code === currency)?.flag}</span>
                    <span className="text-white/70 font-medium">{currency}</span>
                    <i className="pi pi-chevron-down text-white/30 text-xs" />
                  </button>
                  <AnimatePresence>
                    {currencyOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 mt-2 w-44 glass rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50"
                      >
                        {CURRENCIES.map((c) => (
                          <button key={c.code} onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                              currency === c.code ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/70 hover:text-white hover:bg-white/5'
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

            {/* Avatar dropdown */}
            {isAuthenticated ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg hover:bg-white/10 transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className="hidden sm:block text-white text-sm font-medium">{user?.name?.split(' ')[0]}</span>
                  <motion.i
                    className="pi pi-chevron-down text-white/50 text-xs"
                    animate={{ rotate: userMenuOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -8 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-2 w-56 glass rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50"
                      style={{ backdropFilter: 'blur(20px)' }}
                    >
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-white/10">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{user?.name}</p>
                            <p className="text-white/40 text-xs truncate">{user?.email}</p>
                          </div>
                        </div>
                        {isAdmin && (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                            <i className="pi pi-shield text-xs" /> Admin
                          </span>
                        )}
                      </div>

                      {/* Menu items — user only */}
                      {!isAdmin && (
                        <div className="py-1.5">
                          {menuItem('pi-user',          'Profile',            '/dashboard')}
                          {menuItem('pi-shopping-bag',  'My Orders',          '/dashboard')}
                          {menuItem('pi-ticket',        'Support Tickets',    '/tickets')}
                          {menuItem('pi-cog',           'Settings',           '/settings')}
                        </div>
                      )}

                      {/* Logout */}
                      <div className="border-t border-white/10 py-1.5">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-500/10 text-sm transition-colors rounded-lg mx-0"
                        >
                          <i className="pi pi-sign-out text-xs w-4" /> Logout
                        </button>
                      </div>
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

            {/* Mobile hamburger */}
            <button className="md:hidden p-2 text-white/70 hover:text-white" onClick={() => setMobileOpen((v) => !v)}>
              <i className={`pi ${mobileOpen ? 'pi-times' : 'pi-bars'} text-lg`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-white/10 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
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
