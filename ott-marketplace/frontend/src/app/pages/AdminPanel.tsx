import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { PAYMENT_TYPES } from '../utils/paymentTypes';
import BroadcastModal from '../components/BroadcastModal';
import FundWalletModal from '../components/FundWalletModal';
import { useNotifications } from '../hooks/useNotifications';
import { io as socketIO } from 'socket.io-client';
import LiveUsersPanel, { OnlineUser } from '../components/LiveUsersPanel';
import OrdersSearchBar, { FilterField } from '../components/OrdersSearchBar';
import ChatbotAnalytics from '../components/ChatbotAnalytics';
import YourDevices from '../components/YourDevices';
import { useAuthStore } from '../store/authStore';
import AdminReports from '../components/AdminReports';
import EditUserModal from '../components/EditUserModal';

const TABS = ['Dashboard', 'Products', 'Orders', 'Users', 'Payments', 'Tickets', 'Broadcast', 'AI Chat', 'Reports', 'Settings'];

interface PaymentMethod {
  _id: string; type: string; label: string;
  upiId: string; merchantId: string; qrCodeUrl: string; accountDetails: string; isDefault: boolean;
}
interface AddMethodForm {
  type: string; label: string; upiId: string; merchantId: string;
  qrCodeUrl: string; accountDetails: string; isDefault: boolean;
}
const EMPTY_FORM: AddMethodForm = { type: '', label: '', upiId: '', merchantId: '', qrCodeUrl: '', accountDetails: '', isDefault: false };

interface Product {
  _id: string; name: string; platform: string; category: string;
  price: number; originalPrice: number; duration: string; stock: number;
  isActive: boolean; isFeatured: boolean; isHot: boolean; isLimited: boolean;
  gradientFrom: string; gradientTo: string; priceColor?: string;
  services?: string[]; imageUrl?: string; deletedAt?: string | null;
}
interface Order {
  _id: string; orderNumber: string; user: { name: string; email: string };
  productSnapshot: { name: string; platform: string }; amount: number;
  status: string; isRefunded: boolean; refundStatus: string; createdAt: string;
  paymentDetails?: { method: string; transactionId: string };
}
interface User {
  _id: string; name: string; email: string; wallet: number; walletBalance: number;
  isActive: boolean; createdAt: string; orderCount: number; totalSpent: number;
  googleId?: string;
}
interface Payment {
  _id: string; userEmail: string; userName: string; orderId: string;
  orderNumber: string; amount: number; method: string; status: string;
  type: string; transactionId: string; timestamp: string; note?: string;
}
interface Ticket {
  _id: string; ticketNumber: string; user: { name: string; email: string };
  subject: string; status: string; priority: string; createdAt: string;
}
interface DashStats {
  totalUsers: number; totalOrders: number; totalRevenue: number;
  recentOrders: Order[]; lowStockProducts: Product[]; pendingPayments: Payment[];
}

export default function AdminPanel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'Dashboard');
  const [stats, setStats] = useState<DashStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [servicesInput, setServicesInput] = useState<string>('');

  // ── Payment Methods (Settings tab) ──────────────────────────────────────────
  const [payMethods, setPayMethods] = useState<PaymentMethod[]>([]);
  const [payLoading, setPayLoading] = useState(false);
  const [showAddPay, setShowAddPay] = useState(false);
  const [payForm, setPayForm] = useState<AddMethodForm>(EMPTY_FORM);
  const [paySaving, setPaySaving] = useState(false);

  // ── Pending topup approvals ───────────────────────────────────────────────
  const [pendingTopups, setPendingTopups] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ paymentId: string; userName: string; amount: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Password & Security (Settings tab) ───────────────────────────────────────
  const { user: adminUser, setToken: setAdminToken } = useAuthStore();
  const [showCurPw, setShowCurPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConPw, setShowConPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const {
    register: regPw,
    handleSubmit: handlePwSubmit,
    watch: watchPw,
    reset: resetPw,
    formState: { errors: pwErrors },
  } = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>();
  const newPwVal = watchPw('newPassword', '');

  // ── Broadcast tab ─────────────────────────────────────────────────────────
  interface BroadcastRecord {
    _id: string; subject: string; message: string; type: string;
    adminName: string; sentCount: number; readCount: number; createdAt: string;
  }
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);

  const { register, handleSubmit, reset, watch, setValue } = useForm<Partial<Product>>();

  // ── Fund Wallet modal ─────────────────────────────────────────────────────
  const [fundTarget, setFundTarget] = useState<User | null>(null);
  // ── Edit User modal ────────────────────────────────────────────────────────
  const [editUserTarget, setEditUserTarget] = useState<User | null>(null);
  const { counts, markRead } = useNotifications();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // Connect to socket for live users as soon as AdminPanel mounts
  useEffect(() => {
    const sock = socketIO(import.meta.env.VITE_API_URL || '/', { path: '/socket.io', transports: ['websocket'] });
    sock.emit('join_admin');
    sock.on('online_users_update', ({ users: u }: { users: OnlineUser[]; count: number }) => {
      setOnlineUsers(u);
    });
    return () => { sock.disconnect(); };
  }, []);

  // ── Admin Orders search ───────────────────────────────────────────────────
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilterField, setOrderFilterField] = useState<FilterField>('orderId');
  const [orderPage, setOrderPage] = useState(1);
  const ORDER_PAGE_SIZE = 10;

  // ── Admin Users search ────────────────────────────────────────────────────
  const [userSearch, setUserSearch] = useState('');

  // ── Admin Payments search ─────────────────────────────────────────────────
  const [paymentSearch, setPaymentSearch] = useState('');

  // ── Admin Tickets search ──────────────────────────────────────────────────
  const [ticketSearch, setTicketSearch] = useState('');

  const filteredOrders = useMemo(() => {
    const t = orderSearch.trim().toLowerCase();
    if (!t) return orders;
    return orders.filter((o) => {
      if (orderFilterField === 'orderId')  return o.orderNumber.toLowerCase().includes(t);
      if (orderFilterField === 'product')  return o.productSnapshot?.name?.toLowerCase().includes(t);
      if (orderFilterField === 'duration') return (o.productSnapshot as any)?.duration?.toLowerCase().includes(t);
      if (orderFilterField === 'user')     return o.user?.name?.toLowerCase().includes(t);
      if (orderFilterField === 'email')    return o.user?.email?.toLowerCase().includes(t);
      return false;
    });
  }, [orders, orderSearch, orderFilterField]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDER_PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE);

  const ADMIN_ORDER_FILTERS: FilterField[] = ['orderId', 'product', 'duration', 'user', 'email'];

  const STATUS_STYLES: Record<string, string> = {
    delivered:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    processing: 'bg-blue-500/15    text-blue-300    border-blue-500/40',
    pending:    'bg-amber-500/15   text-amber-300   border-amber-500/40',
    refunded:   'bg-rose-500/15    text-rose-300    border-rose-500/40',
    cancelled:  'bg-rose-500/15    text-rose-300    border-rose-500/40',
  };

  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    if (activeTab === 'Products') fetchProducts();
    else if (activeTab === 'Orders') fetchOrders();
    else if (activeTab === 'Users') fetchUsers();
    else if (activeTab === 'Payments') { fetchPayments(); fetchPendingTopups(); }
    else if (activeTab === 'Tickets') fetchTickets();
    else if (activeTab === 'Settings') fetchPayMethods();
    else if (activeTab === 'Broadcast') fetchBroadcasts();
  }, [activeTab]);

  const fetchPayMethods = async () => {
    setPayLoading(true);
    try {
      const { data } = await api.get('/wallet/payment-methods');
      setPayMethods(data.paymentMethods);
    } catch { toast.error('Failed to load payment methods'); }
    finally { setPayLoading(false); }
  };

  const fetchPendingTopups = async () => {
    setPendingLoading(true);
    try {
      const { data } = await api.get('/wallet/pending-topups');
      setPendingTopups(data.payments);
    } catch { toast.error('Failed to load pending topups'); }
    finally { setPendingLoading(false); }
  };

  const handleApproveTopup = async (paymentId: string) => {
    try {
      const { data } = await api.post(`/wallet/topup/${paymentId}/approve`);
      toast.success(data.message);
      setPendingTopups((prev) => prev.filter((p) => p._id !== paymentId));
      fetchPayments(); // refresh full payments list
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Approval failed');
    }
  };

  const handleRejectTopup = async () => {
    if (!rejectModal) return;
    try {
      await api.post(`/wallet/topup/${rejectModal.paymentId}/reject`, { reason: rejectReason.trim() || 'Transaction ID could not be verified' });
      toast.success('Payment rejected and user notified');
      setPendingTopups((prev) => prev.filter((p) => p._id !== rejectModal.paymentId));
      setRejectModal(null);
      setRejectReason('');
      fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Rejection failed');
    }
  };

  const handleAddPayMethod = async () => {
    if (!payForm.type) return toast.error('Select a payment type');
    if (!payForm.label.trim()) return toast.error('Enter a label');
    if (payForm.type === 'paytm_business' && !payForm.merchantId.trim()) {
      return toast.error('Paytm Business Merchant ID is required');
    }
    setPaySaving(true);
    try {
      const { data } = await api.post('/wallet/payment-methods', payForm);
      setPayMethods(data.paymentMethods);
      setPayForm(EMPTY_FORM);
      setShowAddPay(false);
      toast.success('Payment method added');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add');
    } finally { setPaySaving(false); }
  };

  const handleDeletePayMethod = async (id: string) => {
    if (!confirm('Remove this payment method?')) return;
    try {
      const { data } = await api.delete(`/wallet/payment-methods/${id}`);
      setPayMethods(data.paymentMethods);
      toast.success('Removed');
    } catch { toast.error('Failed to remove'); }
  };

  const fetchBroadcasts = async () => {
    setBroadcastLoading(true);
    try {
      const { data } = await api.get('/broadcast');
      setBroadcasts(data.broadcasts);
    } catch { toast.error('Failed to load broadcasts'); }
    finally { setBroadcastLoading(false); }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!confirm('Delete this broadcast?')) return;
    try {
      await api.delete(`/broadcast/${id}`);
      setBroadcasts((prev) => prev.filter((b) => b._id !== id));
      toast.success('Broadcast deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const fetchStats = async () => {
    try { const { data } = await api.get('/admin/dashboard'); setStats(data); } catch { /* ignore */ }
  };
  const fetchProducts = async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/products'); setProducts(data.products); }
    finally { setLoading(false); }
  };
  const fetchOrders = async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/orders'); setOrders(data.orders); }
    finally { setLoading(false); }
  };
  const fetchUsers = async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/users'); setUsers(data.users); }
    finally { setLoading(false); }
  };
  const fetchPayments = async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/payments'); setPayments(data.payments); }
    finally { setLoading(false); }
  };
  const fetchTickets = async () => {
    setLoading(true);
    try { const { data } = await api.get('/tickets/all'); setTickets(data.tickets); }
    finally { setLoading(false); }
  };

  const handleOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status });
      toast.success('Order updated');
      fetchOrders();
      fetchStats();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Update failed'); }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Soft-delete this product?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch { toast.error('Delete failed'); }
  };

  const openProductDialog = (product?: Product) => {
    setEditProduct(product || null);
    reset(product || {});
    setImagePreview(product?.imageUrl || '');
    setServicesInput(product?.services?.join(', ') || '');
    setProductDialog(true);
  };

  const handleProductSave = async (data: Partial<Product>) => {
    // Parse services from the local input state
    const services = servicesInput.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      if (editProduct) {
        await api.put(`/admin/products/${editProduct._id}`, { ...data, services });
        toast.success('Product updated');
      } else {
        await api.post('/admin/products', { ...data, services });
        toast.success('Product created');
      }
      setProductDialog(false);
      fetchProducts();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  const handleToggleUser = async (id: string) => {
    try {
      const { data } = await api.put(`/admin/users/${id}/toggle`);
      toast.success(data.message);
      fetchUsers();
    } catch { toast.error('Failed'); }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Permanently delete user "${name}"? This cannot be undone.`)) return;
    try {
      const { data } = await api.delete(`/admin/users/${id}`);
      toast.success(data.message);
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (err: any) { toast.error(err.response?.data?.error || 'Delete failed'); }
  };

  const handleStockUpdate = async (id: string, stock: number) => {
    try {
      const { data } = await api.patch(`/products/${id}/stock`, { stock });
      setProducts((prev) => prev.map((p) => p._id === id ? { ...p, stock: data.product.stock } : p));
      toast.success(`Stock updated to ${stock}`);
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to update stock'); }
  };

  const handleFundSuccess = (userId: string, newBalance: number) => {
    setUsers((prev) => prev.map((u) =>
      u._id === userId ? { ...u, wallet: newBalance, walletBalance: newBalance } : u
    ));
    fetchPayments(); // refresh payments table
  };

  const onChangeAdminPassword = async (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (data.newPassword !== data.confirmPassword) { toast.error('Passwords do not match'); return; }
    setChangingPw(true);
    try {
      const { data: res } = await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (res.token) setAdminToken(res.token);
      toast.success('Password updated successfully');
      resetPw();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    }
    setChangingPw(false);
  };

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: 'pi-users', color: 'from-blue-500 to-cyan-500' },
    { label: 'Total Orders', value: stats.totalOrders, icon: 'pi-shopping-bag', color: 'from-indigo-500 to-purple-600' },
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toFixed(2)}`, icon: 'pi-dollar', color: 'from-yellow-500 to-orange-500' },
    { label: 'Low Stock', value: stats.lowStockProducts.length, icon: 'pi-exclamation-triangle', color: 'from-red-500 to-pink-500' },
    { label: 'Pending Payments', value: stats.pendingPayments.length, icon: 'pi-clock', color: 'from-orange-500 to-red-500' },
  ] : [];

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-10 admin-page-wrapper">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 w-full">
        <motion.div className="flex items-center gap-3 mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <i className="pi pi-cog text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-2xl">Admin Panel</h1>
            <p className="text-white/40 text-sm">Manage your OTT marketplace</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="admin-tabs flex gap-1 mb-6 glass rounded-xl p-1 w-full overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${activeTab === tab ? 'bg-indigo-500 text-white' : 'text-white/50 hover:text-white'}`}>
              {tab}
              {tab === 'Tickets' && counts.support > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white bg-red-500">
                  {counts.support > 99 ? '99+' : counts.support}
                </span>
              )}
            </button>
          ))}
        </div>

        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

          {/* ── Dashboard ── */}
          {activeTab === 'Dashboard' && (
            <div className="space-y-6">
              <div className="admin-stat-grid grid grid-cols-2 lg:grid-cols-5 gap-4">
                {statCards.map((s, i) => (
                  <motion.div key={s.label} className="glass rounded-2xl p-5 border border-white/10"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                      <i className={`pi ${s.icon} text-white text-sm`} />
                    </div>
                    <div className="text-white font-bold text-2xl">{s.value}</div>
                    <div className="text-white/40 text-xs mt-0.5">{s.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Recent orders */}
              {stats && stats.recentOrders.length > 0 && (
                <div className="glass rounded-2xl p-6 border border-white/10">
                  <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                    <i className="pi pi-history text-indigo-400" /> Recent Orders
                  </h3>
                  <div className="space-y-2">
                    {stats.recentOrders.map((o) => (
                      <div key={o._id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                        <div>
                          <p className="text-white text-sm font-medium">{o.productSnapshot?.name}</p>
                          <p className="text-white/40 text-xs">{o.user?.email} · {o.orderNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-indigo-400 font-bold">₹{o.amount}</p>
                          <span className={`text-xs ${o.status === 'delivered' ? 'text-green-400' : o.status === 'cancelled' ? 'text-red-400' : 'text-yellow-400'}`}>{o.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Low stock */}
              {stats && stats.lowStockProducts.length > 0 && (
                <div className="glass rounded-2xl p-6 border border-red-500/20">
                  <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                    <i className="pi pi-exclamation-triangle text-red-400" /> Low Stock Products
                  </h3>
                  <div className="space-y-2">
                    {stats.lowStockProducts.map((p) => (
                      <div key={p._id} className="flex items-center justify-between p-3 rounded-xl bg-red-500/10">
                        <p className="text-white text-sm">{p.name}</p>
                        <span className="text-red-400 font-bold text-sm">{p.stock} left</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Products ── */}
          {activeTab === 'Products' && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h3 className="text-white font-semibold text-lg">Products</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                    <span className="text-green-400">🟢 In Stock: {products.filter(p => p.stock > 5).length}</span>
                    <span className="text-orange-400">🟡 Low Stock: {products.filter(p => p.stock > 0 && p.stock <= 5).length}</span>
                    <span className="text-red-400">🔴 Out of Stock: {products.filter(p => p.stock === 0).length}</span>
                  </div>
                </div>
                <button onClick={() => openProductDialog()} className="btn-primary text-sm py-2 px-4">
                  <i className="pi pi-plus mr-1 text-xs" /> Add Product
                </button>
              </div>
              <DataTable value={products} loading={loading} paginator rows={10} emptyMessage="No products">
                <Column field="name" header="Name" style={{ minWidth: '160px' }} />
                <Column field="platform" header="Platform" />
                <Column field="price" header="Price" body={(r) => <span className="text-indigo-400 font-bold">₹{r.price}</span>} />
                <Column field="duration" header="Duration" />
                <Column header="Stock" style={{ minWidth: '140px' }} body={(r) => (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      defaultValue={r.stock}
                      className="w-16 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs text-center focus:outline-none focus:border-indigo-500/50"
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val !== r.stock) handleStockUpdate(r._id, val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (!isNaN(val)) handleStockUpdate(r._id, val);
                        }
                      }}
                    />
                    <div className="flex gap-1">
                      <button onClick={() => handleStockUpdate(r._id, 0)} title="Set out of stock"
                        className="p-1 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs">
                        <i className="pi pi-times-circle" />
                      </button>
                      <button onClick={() => handleStockUpdate(r._id, 100)} title="Restock to 100"
                        className="p-1 rounded text-green-400/60 hover:text-green-400 hover:bg-green-500/10 transition-colors text-xs">
                        <i className="pi pi-refresh" />
                      </button>
                    </div>
                  </div>
                )} />
                <Column header="Stock Status" body={(r) => {
                  if (r.stock === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">🔴 Out of Stock</span>;
                  if (r.stock <= 5) return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">🟡 Low Stock</span>;
                  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">🟢 In Stock</span>;
                }} />
                <Column field="isActive" header="Active" body={(r) => (
                  <Tag value={r.deletedAt ? 'Deleted' : r.isActive ? 'Active' : 'Inactive'}
                    severity={r.deletedAt ? 'danger' : r.isActive ? 'success' : 'warning'} />
                )} />
                <Column header="Actions" body={(r) => (
                  <div className="flex gap-2">
                    <button onClick={() => openProductDialog(r)} className="p-1.5 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors">
                      <i className="pi pi-pencil text-sm" />
                    </button>
                    {!r.deletedAt && (
                      <button onClick={() => handleDeleteProduct(r._id)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                        <i className="pi pi-trash text-sm" />
                      </button>
                    )}
                  </div>
                )} />
              </DataTable>
            </div>
          )}

          {/* ── Orders ── */}
          {activeTab === 'Orders' && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h3 className="text-white font-semibold text-lg mb-4">All Orders</h3>

              <OrdersSearchBar
                filters={ADMIN_ORDER_FILTERS}
                totalCount={orders.length}
                filteredCount={filteredOrders.length}
                onSearch={(term, field) => { setOrderSearch(term); setOrderFilterField(field); setOrderPage(1); }}
                onClear={() => { setOrderSearch(''); setOrderFilterField('orderId'); setOrderPage(1); }}
              />

              {loading ? (
                <div className="flex items-center justify-center py-16 text-white/30">
                  <i className="pi pi-spin pi-spinner text-2xl mr-3" /> Loading orders…
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-slate-700/50 relative">
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900/80 to-transparent sm:hidden" />
                    <table className="w-full text-sm min-w-[800px]">
                      <thead>
                        <tr className="border-b border-slate-700/60 text-slate-400 text-xs uppercase tracking-wider">
                          <th className="px-4 py-3 text-left font-medium">Order #</th>
                          <th className="px-4 py-3 text-left font-medium">User</th>
                          <th className="px-4 py-3 text-left font-medium">Product</th>
                          <th className="px-4 py-3 text-right font-medium">Amount</th>
                          <th className="px-4 py-3 text-left font-medium">Method</th>
                          <th className="px-4 py-3 text-left font-medium">Status</th>
                          <th className="px-4 py-3 text-left font-medium">Refund</th>
                          <th className="px-4 py-3 text-left font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedOrders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-sm">
                              No orders match your search.
                            </td>
                          </tr>
                        ) : paginatedOrders.map((r) => (
                          <tr key={r._id} className="border-b border-slate-800/70 last:border-none hover:bg-slate-900/60 transition-colors">
                            <td className="px-4 py-3.5 font-mono text-xs text-slate-400 whitespace-nowrap">{r.orderNumber}</td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="text-white text-sm font-medium">{r.user?.name}</span>
                              <br />
                              <span className="text-slate-500 text-xs">{r.user?.email}</span>
                            </td>
                            <td className="px-4 py-3.5 text-white whitespace-nowrap">{r.productSnapshot?.name}</td>
                            <td className="px-4 py-3.5 text-right font-semibold text-violet-200 whitespace-nowrap">₹{r.amount}</td>
                            <td className="px-4 py-3.5 text-slate-400 text-xs capitalize whitespace-nowrap">{r.paymentDetails?.method || 'wallet'}</td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize
                                ${STATUS_STYLES[r.status] ?? 'bg-slate-500/15 text-slate-300 border-slate-500/40'}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {r.isRefunded
                                ? <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-amber-500/15 text-amber-300 border-amber-500/40">Refunded</span>
                                : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex gap-1 flex-wrap">
                                {r.status !== 'cancelled' && r.status !== 'delivered' && (
                                  <button onClick={() => handleOrderStatus(r._id, 'delivered')}
                                    className="text-xs px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 transition-colors flex items-center gap-1">
                                    <i className="pi pi-check-circle text-xs" /> Mark Complete
                                  </button>
                                )}
                                {r.status !== 'cancelled' && (
                                  <button onClick={() => handleOrderStatus(r._id, 'cancelled')}
                                    className="text-xs px-2.5 py-1 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-500/25 transition-colors">
                                    Cancel
                                  </button>
                                )}
                                {r.status === 'cancelled' && (
                                  <span className="text-xs text-slate-600 italic">Locked</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Admin orders pagination */}
                  <div className="flex items-center justify-end gap-1 mt-4 text-xs text-slate-400">
                    <button onClick={() => setOrderPage(1)} disabled={orderPage === 1}
                      className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
                    <button onClick={() => setOrderPage((p) => Math.max(1, p - 1))} disabled={orderPage === 1}
                      className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
                    <span className="px-3 py-1 rounded-lg bg-slate-800/60 text-slate-200 font-medium min-w-[60px] text-center">
                      {orderPage} / {orderTotalPages}
                    </span>
                    <button onClick={() => setOrderPage((p) => Math.min(orderTotalPages, p + 1))} disabled={orderPage === orderTotalPages}
                      className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
                    <button onClick={() => setOrderPage(orderTotalPages)} disabled={orderPage === orderTotalPages}
                      className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Users ── */}
          {activeTab === 'Users' && (
            <div className="space-y-4">
              <LiveUsersPanel externalUsers={onlineUsers} />

              <div className="glass rounded-2xl p-6 border border-white/10">
                {/* Header + search */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h3 className="text-white font-semibold text-lg">All Users</h3>
                    <p className="text-white/40 text-xs mt-0.5">
                      {userSearch
                        ? `${users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())).length} of ${users.length} users`
                        : `${users.length} total users`}
                    </p>
                  </div>
                  {/* Search input */}
                  <div className="relative">
                    <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name or email…"
                      className="pl-9 pr-8 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all w-64"
                    />
                    {userSearch && (
                      <button
                        onClick={() => setUserSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        <i className="pi pi-times text-xs" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-white/30">
                    <i className="pi pi-spin pi-spinner text-2xl mr-3" /> Loading users…
                  </div>
                ) : (() => {
                  const q = userSearch.trim().toLowerCase();
                  const filtered = q
                    ? users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
                    : users;
                  return filtered.length === 0 ? (
                    <div className="text-center py-16 text-white/30">
                      <i className="pi pi-search text-4xl mb-3 block" />
                      <p className="text-sm">No users match "{userSearch}"</p>
                      <button onClick={() => setUserSearch('')} className="text-indigo-400 text-xs mt-2 hover:text-indigo-300">Clear search</button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                      <table className="w-full text-sm min-w-[900px]">
                        <thead>
                          <tr className="border-b border-slate-700/60 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left font-medium">User</th>
                            <th className="px-4 py-3 text-right font-medium">Wallet</th>
                            <th className="px-4 py-3 text-right font-medium">Orders</th>
                            <th className="px-4 py-3 text-right font-medium">Spent</th>
                            <th className="px-4 py-3 text-left font-medium">Online</th>
                            <th className="px-4 py-3 text-left font-medium">Joined</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((r) => {
                            const onlineUser = onlineUsers.find((o) => o.userId === r._id);
                            const status = onlineUser?.status;
                            const pageStr = onlineUser?.page
                              ? onlineUser.page.startsWith('/shop') ? 'Shop'
                              : onlineUser.page.startsWith('/checkout') ? 'Checkout'
                              : onlineUser.page.startsWith('/dashboard') ? 'Dashboard'
                              : onlineUser.page.startsWith('/tickets') ? 'Support'
                              : onlineUser.page.replace('/', '') || 'Home'
                              : null;
                            return (
                              <tr key={r._id} className="border-b border-slate-800/70 last:border-none hover:bg-white/5 transition-colors">
                                {/* User */}
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="relative flex-shrink-0">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                                        <span className="text-white text-xs font-bold">{r.name?.[0]?.toUpperCase()}</span>
                                      </div>
                                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black ${
                                        status === 'active' ? 'bg-green-400' : status === 'idle' ? 'bg-yellow-400' : 'bg-gray-600'
                                      }`} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-white text-sm font-semibold leading-tight">{r.name}</p>
                                        {r.googleId && (
                                          <span title="Signed up with Google" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white flex-shrink-0" style={{ padding: '2px' }}>
                                            <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12">
                                              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                                              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                                              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                                              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                                            </svg>
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-slate-500 text-xs truncate">{r.email}</p>
                                    </div>
                                  </div>
                                </td>
                                {/* Wallet */}
                                <td className="px-4 py-3.5 text-right">
                                  <span className="text-indigo-400 font-bold">₹{(r.walletBalance ?? r.wallet ?? 0).toFixed(2)}</span>
                                </td>
                                {/* Orders */}
                                <td className="px-4 py-3.5 text-right text-white/70">{r.orderCount}</td>
                                {/* Spent */}
                                <td className="px-4 py-3.5 text-right text-emerald-400 font-medium">₹{(r.totalSpent || 0).toFixed(2)}</td>
                                {/* Online */}
                                <td className="px-4 py-3.5">
                                  {!onlineUser ? (
                                    <span className="text-white/25 text-xs">Offline</span>
                                  ) : (
                                    <div>
                                      <span className={`text-xs font-medium ${status === 'active' ? 'text-emerald-400' : status === 'idle' ? 'text-yellow-400' : 'text-white/30'}`}>
                                        {status === 'active' ? '🟢 Active' : status === 'idle' ? '🟡 Idle' : '⚫ Offline'}
                                      </span>
                                      {pageStr && <p className="text-white/30 text-xs">{pageStr}</p>}
                                    </div>
                                  )}
                                </td>
                                {/* Joined */}
                                <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                                  {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                {/* Status */}
                                <td className="px-4 py-3.5">
                                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                    r.isActive
                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                                  }`}>
                                    {r.isActive ? 'Active' : 'Banned'}
                                  </span>
                                </td>
                                {/* Actions */}
                                <td className="px-4 py-3.5">
                                  <div className="flex gap-1.5">
                                    <button onClick={() => setEditUserTarget(r)}
                                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg transition-colors font-medium border border-indigo-500/20"
                                      title="Edit user">
                                      <i className="pi pi-pencil text-xs" /> Edit
                                    </button>
                                    <button onClick={() => handleDeleteUser(r._id, r.name)}
                                      className="text-xs px-2 py-1.5 rounded-lg bg-rose-900/30 text-rose-400 hover:bg-rose-500/30 transition-colors border border-rose-500/20"
                                      title="Delete user">
                                      <i className="pi pi-trash text-xs" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── Payments ── */}
          {activeTab === 'Payments' && (() => {
            const q = paymentSearch.trim().toLowerCase();
            const filteredPayments = q
              ? payments.filter(p =>
                  p.userName?.toLowerCase().includes(q) ||
                  p.userEmail?.toLowerCase().includes(q) ||
                  p.method?.toLowerCase().includes(q)
                )
              : payments;

            const TYPE_STYLE: Record<string, string> = {
              purchase: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
              topup:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
              refund:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
              fund:     'bg-violet-500/15 text-violet-400 border-violet-500/30',
            };
            const STATUS_STYLE: Record<string, string> = {
              completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
              refunded:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
              failed:    'bg-red-500/15 text-red-400 border-red-500/30',
            };

            return (
              <div className="space-y-5">
                {/* ── Pending Topup Approvals ── */}
                <div className="glass rounded-2xl border border-amber-500/20 overflow-hidden">
                  <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <i className="pi pi-clock text-amber-400" />
                      <h3 className="text-white font-semibold">Pending Wallet Top-ups</h3>
                      {pendingTopups.length > 0 && (
                        <span className="min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold flex items-center justify-center text-white bg-amber-500">
                          {pendingTopups.length}
                        </span>
                      )}
                    </div>
                    <button onClick={fetchPendingTopups} className="text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
                      <i className="pi pi-refresh text-sm" />
                    </button>
                  </div>
                  {pendingLoading ? (
                    <div className="flex items-center justify-center py-10 text-white/30">
                      <i className="pi pi-spin pi-spinner text-xl mr-2" /> Loading…
                    </div>
                  ) : pendingTopups.length === 0 ? (
                    <div className="text-center py-10 text-white/30">
                      <i className="pi pi-check-circle text-3xl mb-2 block text-emerald-500/40" />
                      <p className="text-sm">No pending top-ups — all clear</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {pendingTopups.map((p) => (
                        <div key={p._id} className="flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">{p.user?.name?.[0]?.toUpperCase() || '?'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-semibold text-sm">{p.user?.name}</p>
                              <span className="text-white/40 text-xs">{p.user?.email}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="text-emerald-400 font-bold text-sm">₹{p.amount?.toFixed(2)}</span>
                              <span className="text-white/50 text-xs font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                Txn: {p.transactionId}
                              </span>
                              <span className="text-white/30 text-xs capitalize">{p.method}</span>
                              {p.paymentTimestamp && (
                                <span className="text-white/30 text-xs">
                                  Paid: {new Date(p.paymentTimestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleApproveTopup(p._id)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-colors font-semibold"
                            >
                              <i className="pi pi-check text-xs" /> Approve
                            </button>
                            <button
                              onClick={() => { setRejectModal({ paymentId: p._id, userName: p.user?.name, amount: p.amount }); setRejectReason(''); }}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors font-semibold"
                            >
                              <i className="pi pi-times text-xs" /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                  <div>
                    <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                      <i className="pi pi-credit-card text-indigo-400" /> All Payments
                    </h3>
                    <p className="text-white/40 text-xs mt-0.5">
                      {q ? `${filteredPayments.length} of ${payments.length} payments` : `${payments.length} total payments`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                      <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none" />
                      <input
                        type="text"
                        value={paymentSearch}
                        onChange={(e) => setPaymentSearch(e.target.value)}
                        placeholder="Search by name, email or method…"
                        className="pl-9 pr-8 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all w-64"
                      />
                      {paymentSearch && (
                        <button onClick={() => setPaymentSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                          <i className="pi pi-times text-xs" />
                        </button>
                      )}
                    </div>
                    {/* Add Funds */}
                    <button
                      onClick={() => setActiveTab('Users')}
                      className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold text-white transition-all whitespace-nowrap"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    >
                      💰 Add Funds to User
                    </button>
                  </div>
                </div>

                {/* Table */}
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-white/30">
                    <i className="pi pi-spin pi-spinner text-2xl mr-3" /> Loading payments…
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="text-center py-16 text-white/30">
                    <i className="pi pi-search text-4xl mb-3 block" />
                    <p className="text-sm">{q ? `No payments match "${paymentSearch}"` : 'No payments yet'}</p>
                    {q && <button onClick={() => setPaymentSearch('')} className="text-indigo-400 text-xs mt-2 hover:text-indigo-300">Clear search</button>}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                    <table className="w-full text-sm min-w-[860px]">
                      <thead>
                        <tr className="border-b border-slate-700/60 text-slate-400 text-xs uppercase tracking-wider">
                          <th className="px-4 py-3 text-left font-medium">User</th>
                          <th className="px-4 py-3 text-right font-medium">Amount</th>
                          <th className="px-4 py-3 text-left font-medium">Type</th>
                          <th className="px-4 py-3 text-left font-medium">Method</th>
                          <th className="px-4 py-3 text-left font-medium">Status</th>
                          <th className="px-4 py-3 text-left font-medium">Note</th>
                          <th className="px-4 py-3 text-left font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((r) => (
                          <tr key={r._id} className="border-b border-slate-800/70 last:border-none hover:bg-white/5 transition-colors">
                            {/* User */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-xs font-bold">{r.userName?.[0]?.toUpperCase() || '?'}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-white text-sm font-semibold leading-tight">{r.userName}</p>
                                  <p className="text-slate-500 text-xs truncate">{r.userEmail}</p>
                                </div>
                              </div>
                            </td>
                            {/* Amount */}
                            <td className="px-4 py-3.5 text-right">
                              <span className={`font-bold tabular-nums ${r.type === 'purchase' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {r.type === 'purchase' ? '−' : '+'}₹{r.amount?.toFixed(2)}
                              </span>
                            </td>
                            {/* Type */}
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${TYPE_STYLE[r.type] ?? TYPE_STYLE.purchase}`}>
                                {r.type}
                              </span>
                            </td>
                            {/* Method */}
                            <td className="px-4 py-3.5">
                              <span className="text-white/60 text-xs capitalize px-2 py-0.5 rounded-lg bg-white/5 border border-white/10">
                                {r.method}
                              </span>
                            </td>
                            {/* Status */}
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_STYLE[r.status] ?? STATUS_STYLE.completed}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-400' : r.status === 'refunded' ? 'bg-amber-400' : 'bg-red-400'}`} />
                                {r.status}
                              </span>
                            </td>
                            {/* Note */}
                            <td className="px-4 py-3.5 max-w-[200px]">
                              <span className="text-slate-500 text-xs truncate block">{r.note || '—'}</span>
                            </td>
                            {/* Date */}
                            <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                              {new Date(r.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Tickets ── */}
          {activeTab === 'Tickets' && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                    <i className="pi pi-ticket text-indigo-400" /> Support Tickets
                  </h3>
                  <p className="text-white/40 text-xs mt-0.5">
                    {ticketSearch.trim()
                      ? `${tickets.filter(t => t.ticketNumber.toLowerCase().includes(ticketSearch.toLowerCase()) || t.user?.name?.toLowerCase().includes(ticketSearch.toLowerCase()) || t.user?.email?.toLowerCase().includes(ticketSearch.toLowerCase())).length} of ${tickets.length} tickets`
                      : `${tickets.length} total tickets`}
                  </p>
                </div>
                {/* Search */}
                <div className="relative">
                  <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none" />
                  <input
                    type="text"
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    placeholder="Search by ticket ID, name or email…"
                    className="pl-9 pr-8 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all w-72"
                  />
                  {ticketSearch && (
                    <button onClick={() => setTicketSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      <i className="pi pi-times text-xs" />
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-white/30">
                  <i className="pi pi-spin pi-spinner text-2xl mr-3" /> Loading tickets…
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-16 text-white/30">
                  <i className="pi pi-inbox text-4xl mb-3 block" />
                  <p className="text-sm">No tickets yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-700/60 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left font-medium">Ticket #</th>
                        <th className="px-4 py-3 text-left font-medium">From</th>
                        <th className="px-4 py-3 text-left font-medium">Subject</th>
                        <th className="px-4 py-3 text-left font-medium">Priority</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const q = ticketSearch.trim().toLowerCase();
                        const filtered = q
                          ? tickets.filter(t =>
                              t.ticketNumber.toLowerCase().includes(q) ||
                              t.user?.name?.toLowerCase().includes(q) ||
                              t.user?.email?.toLowerCase().includes(q)
                            )
                          : tickets;
                        if (filtered.length === 0) return (
                          <tr>
                            <td colSpan={7} className="px-4 py-14 text-center text-slate-500 text-sm">
                              <i className="pi pi-search text-3xl mb-3 block opacity-40" />
                              No tickets match "{ticketSearch}"
                              <button onClick={() => setTicketSearch('')} className="block mx-auto mt-2 text-indigo-400 text-xs hover:text-indigo-300">Clear search</button>
                            </td>
                          </tr>
                        );
                        return filtered.map((t) => {
                        const priorityStyle: Record<string, string> = {
                          high:   'bg-red-500/15 text-red-400 border-red-500/30',
                          medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                          low:    'bg-sky-500/15 text-sky-400 border-sky-500/30',
                        };
                        const statusStyle: Record<string, string> = {
                          open:        'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                          'in-progress':'bg-blue-500/15 text-blue-400 border-blue-500/30',
                          closed:      'bg-slate-500/15 text-slate-400 border-slate-500/30',
                        };
                        const initials = t.user?.name
                          ? t.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                          : '?';
                        return (
                          <tr
                            key={t._id}
                            onClick={() => { markRead('support', t._id); navigate(`/admin/tickets/${t._id}`); }}
                            className="border-b border-slate-800/70 last:border-none hover:bg-white/5 transition-colors cursor-pointer group"
                          >
                            {/* Ticket # */}
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-xs text-slate-400">{t.ticketNumber}</span>
                            </td>

                            {/* From — avatar + name + email */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
                                  <span className="text-white text-xs font-bold">{initials}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-white text-sm font-semibold leading-tight truncate">
                                    {t.user?.name || 'Unknown User'}
                                  </p>
                                  <p className="text-slate-500 text-xs truncate">{t.user?.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* Subject */}
                            <td className="px-4 py-3.5 max-w-[220px]">
                              <span className="text-white/80 text-sm truncate block">{t.subject}</span>
                            </td>

                            {/* Priority */}
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${priorityStyle[t.priority] ?? priorityStyle.low}`}>
                                {t.priority}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${statusStyle[t.status] ?? statusStyle.closed}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'open' ? 'bg-emerald-400 animate-pulse' : t.status === 'in-progress' ? 'bg-blue-400' : 'bg-slate-500'}`} />
                                {t.status}
                              </span>
                            </td>

                            {/* Date */}
                            <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                              {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>

                            {/* Arrow */}
                            <td className="px-4 py-3.5">
                              <i className="pi pi-chevron-right text-white/20 text-xs group-hover:text-white/50 transition-colors" />
                            </td>
                          </tr>
                        );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Broadcast ── */}
          {activeTab === 'Broadcast' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                    <span className="text-xl">📢</span> Broadcast History
                  </h3>
                  <p className="text-white/40 text-sm mt-0.5">{broadcasts.length} broadcasts sent</p>
                </div>
                <motion.button
                  onClick={() => setBroadcastModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)' }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {/* Pulse ring */}
                  <motion.span
                    className="absolute inset-0 rounded-xl border-2 border-orange-400"
                    animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <i className="pi pi-megaphone text-sm" /> New Broadcast
                </motion.button>
              </div>

              {/* Broadcast list */}
              {broadcastLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
                </div>
              ) : broadcasts.length === 0 ? (
                <div className="glass rounded-2xl border border-white/10 text-center py-16 text-white/30">
                  <div className="text-5xl mb-3">📭</div>
                  <p>No broadcasts sent yet</p>
                  <p className="text-xs mt-1">Click "New Broadcast" to notify your users</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {broadcasts.map((b, i) => (
                    <motion.div
                      key={b._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="glass rounded-2xl border border-white/10 p-5 flex items-start gap-4"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xl flex-shrink-0">
                        📢
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white font-semibold text-sm">{b.subject}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 capitalize">{b.type}</span>
                        </div>
                        <p className="text-white/50 text-sm line-clamp-1">{b.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                          <span><i className="pi pi-send mr-1" />{b.sentCount} sent</span>
                          <span><i className="pi pi-eye mr-1" />{b.readCount} read</span>
                          <span>{b.sentCount > 0 ? Math.round((b.readCount / b.sentCount) * 100) : 0}% open rate</span>
                          <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteBroadcast(b._id)}
                        className="p-2 text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <i className="pi pi-trash text-sm" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AI Chat Analytics ── */}
          {activeTab === 'AI Chat' && <ChatbotAnalytics />}

          {/* ── Reports ── */}
          {activeTab === 'Reports' && <AdminReports />}

          {/* ── Settings ── */}
          {activeTab === 'Settings' && (
            <div className="max-w-2xl space-y-6">
              {/* Payment Methods */}
              <div className="glass rounded-2xl border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <i className="pi pi-credit-card text-indigo-400" />
                    <h2 className="text-white font-semibold">Payment Methods</h2>
                    <span className="text-white/30 text-xs">({payMethods.length})</span>
                  </div>
                  <button
                    onClick={() => setShowAddPay(!showAddPay)}
                    className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"
                  >
                    <i className={`pi ${showAddPay ? 'pi-times' : 'pi-plus'} text-xs`} />
                    {showAddPay ? 'Cancel' : 'Add Payment Method'}
                  </button>
                </div>

                {/* Add form */}
                <AnimatePresence>
                  {showAddPay && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-5 border-b border-white/10 space-y-4">
                        <p className="text-white/60 text-sm font-medium">Select payment type:</p>

                        {/* Type grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {PAYMENT_TYPES.map((pt) => (
                            <button
                              key={pt.value}
                              onClick={() => setPayForm((f) => ({ ...f, type: pt.value, label: pt.label }))}
                              className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${
                                payForm.type === pt.value
                                  ? 'border-indigo-500 bg-indigo-500/20'
                                  : 'border-white/10 bg-white/5 hover:border-white/30'
                              }`}
                            >
                              <div className="text-2xl mb-1">{pt.icon}</div>
                              <div className="text-white text-xs font-medium">{pt.label}</div>
                            </button>
                          ))}
                        </div>

                        {payForm.type && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3 pt-2"
                          >
                            {(() => {
                              const selectedType = PAYMENT_TYPES.find((p) => p.value === payForm.type);
                              return (
                                <>
                                  <div>
                                    <label className="text-white/60 text-xs block mb-1">Display Label *</label>
                                    <input
                                      value={payForm.label}
                                      onChange={(e) => setPayForm((f) => ({ ...f, label: e.target.value }))}
                                      placeholder={`e.g. My ${selectedType?.label}`}
                                      className="input-field text-sm"
                                    />
                                  </div>

                                  {['paytm', 'phonepe', 'gpay', 'bharatpe'].includes(payForm.type) && (
                                    <div>
                                      <label className="text-white/60 text-xs block mb-1">UPI ID</label>
                                      <input
                                        value={payForm.upiId}
                                        onChange={(e) => setPayForm((f) => ({ ...f, upiId: e.target.value }))}
                                        placeholder="yourname@upi"
                                        className="input-field text-sm"
                                      />
                                    </div>
                                  )}

                                  {payForm.type === 'paytm' && (
                                    <div>
                                      <label className="text-white/60 text-xs block mb-1">
                                        Paytm Merchant ID
                                        <span className="text-white/30 ml-1">(from Paytm Business dashboard)</span>
                                      </label>
                                      <input
                                        value={payForm.merchantId}
                                        onChange={(e) => setPayForm((f) => ({ ...f, merchantId: e.target.value }))}
                                        placeholder="e.g. ABCDE12345678901"
                                        className="input-field text-sm font-mono"
                                      />
                                    </div>
                                  )}

                                  {payForm.type === 'paytm_business' && (
                                    <div className="space-y-3">
                                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
                                        <i className="pi pi-info-circle mr-1" />
                                        Paytm Business QR — users scan your QR and pay. Enter your Merchant ID so payments can be verified.
                                      </div>
                                      <div>
                                        <label className="text-white/60 text-xs block mb-1">
                                          Paytm Business Merchant ID *
                                          <span className="text-white/30 ml-1">(from Paytm for Business dashboard)</span>
                                        </label>
                                        <input
                                          value={payForm.merchantId}
                                          onChange={(e) => setPayForm((f) => ({ ...f, merchantId: e.target.value.trim() }))}
                                          placeholder="e.g. ABCDE12345678901"
                                          className="input-field text-sm font-mono"
                                        />
                                        <p className="text-white/30 text-xs mt-1">
                                          Find this in Paytm for Business → Settings → Business Profile
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-white/60 text-xs block mb-1">QR Code (optional)</label>
                                    {/* Upload */}
                                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 border-dashed border-white/20 hover:border-indigo-500/60 transition-colors bg-white/5 mb-2">
                                      <i className="pi pi-upload text-indigo-400 text-sm" />
                                      <span className="text-white/50 text-xs">Upload QR image</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            setPayForm((f) => ({ ...f, qrCodeUrl: ev.target?.result as string }));
                                          };
                                          reader.readAsDataURL(file);
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="flex-1 h-px bg-white/10" />
                                      <span className="text-white/30 text-xs">or paste URL</span>
                                      <div className="flex-1 h-px bg-white/10" />
                                    </div>
                                    <input
                                      value={payForm.qrCodeUrl.startsWith('data:') ? '' : payForm.qrCodeUrl}
                                      onChange={(e) => setPayForm((f) => ({ ...f, qrCodeUrl: e.target.value }))}
                                      placeholder="https://... (link to QR image)"
                                      className="input-field text-sm"
                                    />
                                    {/* Preview */}
                                    {payForm.qrCodeUrl && (
                                      <div className="relative mt-2 w-24 h-24 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                                        <img src={payForm.qrCodeUrl} alt="QR Preview" className="w-full h-full object-contain p-1" />
                                        <button
                                          type="button"
                                          onClick={() => setPayForm((f) => ({ ...f, qrCodeUrl: '' }))}
                                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white/70 hover:text-red-400 flex items-center justify-center text-xs"
                                        >
                                          <i className="pi pi-times" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {['bank', 'cashfree', 'other'].includes(payForm.type) && (
                                    <div>
                                      <label className="text-white/60 text-xs block mb-1">Account Details</label>
                                      <textarea
                                        value={payForm.accountDetails}
                                        onChange={(e) => setPayForm((f) => ({ ...f, accountDetails: e.target.value }))}
                                        placeholder={payForm.type === 'cashfree' ? 'Cashfree merchant info or notes' : 'Account number, IFSC, etc.'}
                                        rows={3}
                                        className="input-field text-sm resize-none"
                                      />
                                    </div>
                                  )}

                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={payForm.isDefault}
                                      onChange={(e) => setPayForm((f) => ({ ...f, isDefault: e.target.checked }))}
                                      className="w-4 h-4 accent-indigo-500"
                                    />
                                    <span className="text-white/60 text-sm">Set as default payment method</span>
                                  </label>

                                  <button
                                    onClick={handleAddPayMethod}
                                    disabled={paySaving}
                                    className="btn-primary w-full py-2.5 disabled:opacity-50"
                                  >
                                    {paySaving ? <><i className="pi pi-spin pi-spinner mr-2" />Saving...</> : 'Save Payment Method'}
                                  </button>
                                </>
                              );
                            })()}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Methods list */}
                <div className="p-4 space-y-3">
                  {payLoading ? (
                    [1, 2].map((i) => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)
                  ) : payMethods.length === 0 ? (
                    <div className="text-center py-10 text-white/30">
                      <i className="pi pi-credit-card text-4xl mb-3 block" />
                      <p>No payment methods added yet</p>
                      <p className="text-xs mt-1">Add methods so customers can top up their wallet</p>
                    </div>
                  ) : (
                    payMethods.map((m) => {
                      const pt = PAYMENT_TYPES.find((p) => p.value === m.type);
                      return (
                        <motion.div
                          key={m._id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 p-4 glass rounded-xl border border-white/10"
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ background: `${pt?.color || '#6366f1'}20`, border: `1px solid ${pt?.color || '#6366f1'}30` }}
                          >
                            {pt?.icon || '💳'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium text-sm">{m.label}</p>
                              {m.isDefault && (
                                <span className="text-xs px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">Default</span>
                              )}
                            </div>
                            {m.upiId && <p className="text-white/40 text-xs">{m.upiId}</p>}
                            {(m as any).merchantId && <p className="text-white/40 text-xs">Merchant ID: <span className="font-mono">{(m as any).merchantId}</span></p>}
                            {m.qrCodeUrl && <p className="text-white/40 text-xs truncate">QR: {m.qrCodeUrl}</p>}
                            {m.accountDetails && <p className="text-white/40 text-xs truncate">{m.accountDetails}</p>}
                          </div>
                          <button
                            onClick={() => handleDeletePayMethod(m._id)}
                            className="p-2 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                          >
                            <i className="pi pi-trash text-sm" />
                          </button>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── Password & Security ── */}
              <div className="glass rounded-2xl border border-white/10 overflow-hidden">
                <div className="flex items-center gap-2 p-5 border-b border-white/10">
                  <i className="pi pi-shield text-indigo-400" />
                  <h2 className="text-white font-semibold">Password &amp; Security</h2>
                  <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30 ml-1">Admin account</span>
                </div>
                <div className="p-5">
                  {adminUser && !adminUser.password && adminUser.googleId ? (
                    <div className="text-center py-6 text-white/40">
                      <i className="pi pi-google text-3xl mb-3 block text-white/20" />
                      <p className="text-sm">You signed in with Google. Password change is not available.</p>
                    </div>
                  ) : (
                    <form onSubmit={handlePwSubmit(onChangeAdminPassword)} className="space-y-4">
                      {/* Current */}
                      <div>
                        <label className="text-white/70 text-sm font-medium block mb-2">Current password</label>
                        <div className="relative">
                          <i className="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                          <input {...regPw('currentPassword', { required: 'Required' })}
                            type={showCurPw ? 'text' : 'password'} placeholder="••••••••"
                            className="input-field pl-10 pr-10" />
                          <button type="button" onClick={() => setShowCurPw(!showCurPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                            <i className={`pi ${showCurPw ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                          </button>
                        </div>
                        {pwErrors.currentPassword && <p className="text-red-400 text-xs mt-1">{pwErrors.currentPassword.message}</p>}
                      </div>
                      {/* New */}
                      <div>
                        <label className="text-white/70 text-sm font-medium block mb-2">New password</label>
                        <div className="relative">
                          <i className="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                          <input {...regPw('newPassword', {
                            required: 'Required',
                            minLength: { value: 8, message: 'At least 8 characters' },
                            pattern: { value: /(?=.*[a-zA-Z])(?=.*\d)/, message: 'Must contain letters and numbers' },
                          })}
                            type={showNewPw ? 'text' : 'password'} placeholder="••••••••"
                            className="input-field pl-10 pr-10" />
                          <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                            <i className={`pi ${showNewPw ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                          </button>
                        </div>
                        {pwErrors.newPassword && <p className="text-red-400 text-xs mt-1">{pwErrors.newPassword.message}</p>}
                        {newPwVal && (
                          <div className="mt-2 space-y-1">
                            {[
                              { label: 'At least 8 characters', ok: newPwVal.length >= 8 },
                              { label: 'Contains a letter', ok: /[a-zA-Z]/.test(newPwVal) },
                              { label: 'Contains a number', ok: /\d/.test(newPwVal) },
                            ].map(({ label, ok }) => (
                              <p key={label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-emerald-400' : 'text-white/30'}`}>
                                <i className={`pi ${ok ? 'pi-check-circle' : 'pi-circle'} text-xs`} />{label}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Confirm */}
                      <div>
                        <label className="text-white/70 text-sm font-medium block mb-2">Confirm new password</label>
                        <div className="relative">
                          <i className="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                          <input {...regPw('confirmPassword', { required: 'Required' })}
                            type={showConPw ? 'text' : 'password'} placeholder="••••••••"
                            className="input-field pl-10 pr-10" />
                          <button type="button" onClick={() => setShowConPw(!showConPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                            <i className={`pi ${showConPw ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                          </button>
                        </div>
                        {pwErrors.confirmPassword && <p className="text-red-400 text-xs mt-1">{pwErrors.confirmPassword.message}</p>}
                      </div>
                      <div className="flex justify-end pt-1">
                        <motion.button type="submit" disabled={changingPw}
                          className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                          whileTap={{ scale: 0.98 }}>
                          {changingPw
                            ? <span className="flex items-center gap-2"><i className="pi pi-spin pi-spinner" /> Saving...</span>
                            : 'Save changes'}
                        </motion.button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* ── Your Devices ── */}
              <YourDevices isAdmin />

            </div>
          )}

        </motion.div>
      </div>

      {/* Product Dialog */}
      <Dialog visible={productDialog} onHide={() => setProductDialog(false)}
        header={editProduct ? 'Edit Product' : 'Add Product'} style={{ width: '560px' }} className="glass">
        <form onSubmit={handleSubmit(handleProductSave)} className="space-y-4 p-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/70 text-sm block mb-1">Name</label>
              <input {...register('name', { required: true })} className="input-field text-sm" />
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Platform</label>
              <select {...register('platform', { required: true })} className="input-field text-sm">
                {['Netflix','Amazon Prime','YouTube Premium','Disney+','Spotify','Apple TV+','HBO Max','Hulu','Crunchyroll','Paramount+'].map((p) => (
                  <option key={p} value={p} className="bg-dark-800">{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Price (₹)</label>
              <input {...register('price', { required: true, valueAsNumber: true })} type="number" step="0.01" className="input-field text-sm" />
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Original Price (₹)</label>
              <input {...register('originalPrice', { required: true, valueAsNumber: true })} type="number" step="0.01" className="input-field text-sm" />
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Category</label>
              <select {...register('category')} className="input-field text-sm">
                {['Video', 'Music', 'Gaming', 'Bundle'].map((c) => (
                  <option key={c} value={c} className="bg-dark-800">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Duration</label>
              <input {...register('duration', { required: true })} placeholder="1 Month" className="input-field text-sm" />
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Stock</label>
              <input {...register('stock', { valueAsNumber: true })} type="number" className="input-field text-sm" />
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Gradient From</label>
              <input {...register('gradientFrom')} type="color" className="input-field text-sm h-10" />
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Gradient To</label>
              <input {...register('gradientTo')} type="color" className="input-field text-sm h-10" />
            </div>
          </div>

          {/* Services */}
          <div>
            <label className="text-white/70 text-sm block mb-1">Services (comma-separated)</label>
            <input
              value={servicesInput}
              onChange={(e) => setServicesInput(e.target.value)}
              placeholder="e.g. Prime Video, Prime Music"
              className="input-field text-sm"
            />
            <p className="text-white/30 text-xs mt-1">Auto-filled from platform if left empty</p>
          </div>

          {/* Badges */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input {...register('isHot')} type="checkbox" className="w-4 h-4 accent-orange-500" />
              <span className="text-white/70 text-sm">🔥 Hot Deal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input {...register('isLimited')} type="checkbox" className="w-4 h-4 accent-purple-500" />
              <span className="text-white/70 text-sm">⏰ Limited Time</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input {...register('isFeatured')} type="checkbox" className="w-4 h-4 accent-indigo-500" />
              <span className="text-white/70 text-sm">⭐ Featured</span>
            </label>
          </div>

          {/* Image */}
          <div className="space-y-2">
            <label className="text-white/70 text-sm block">Product Image (optional)</label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 border-dashed border-white/20 hover:border-indigo-500/60 transition-colors bg-white/5">
              <i className="pi pi-upload text-indigo-400" />
              <span className="text-white/60 text-sm">Click to upload image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const result = ev.target?.result as string;
                    setImagePreview(result);
                    setValue('imageUrl', result);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/30 text-xs">or paste URL</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <input
              {...register('imageUrl')}
              placeholder="https://..."
              className="input-field text-sm"
              onChange={(e) => { setImagePreview(e.target.value); setValue('imageUrl', e.target.value); }}
            />
            {imagePreview && (
              <div className="relative w-full h-32 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain"
                  onError={() => setImagePreview('')} />
                <button type="button" onClick={() => { setImagePreview(''); setValue('imageUrl', ''); }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/70 hover:text-red-400 flex items-center justify-center text-xs">
                  <i className="pi pi-times" />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1 py-2.5">💾 Save Product</button>
            <button type="button" onClick={() => setProductDialog(false)} className="btn-ghost flex-1 py-2.5">Cancel</button>
          </div>
        </form>
      </Dialog>

      <BroadcastModal
        isOpen={broadcastModalOpen}
        onClose={() => setBroadcastModalOpen(false)}
        onSent={() => { fetchBroadcasts(); setActiveTab('Broadcast'); }}
      />

      <FundWalletModal
        user={fundTarget}
        onClose={() => setFundTarget(null)}
        onSuccess={handleFundSuccess}
      />

      <AnimatePresence>
        {editUserTarget && (
          <EditUserModal
            user={editUserTarget}
            onClose={() => setEditUserTarget(null)}
            onUpdated={(updated) => {
              setUsers((prev) => prev.map((u) => u._id === updated._id ? updated : u));
              setEditUserTarget(updated);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Reject Topup Modal ── */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
            <motion.div
              className="relative glass rounded-2xl w-full max-w-sm border border-red-500/20 shadow-2xl p-6 space-y-4"
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <i className="pi pi-times-circle text-red-400 text-lg" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Reject Top-up</h3>
                  <p className="text-white/40 text-xs">₹{rejectModal.amount?.toFixed(2)} from {rejectModal.userName}</p>
                </div>
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">Reason for rejection</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Transaction ID not found in Paytm dashboard"
                  rows={3}
                  className="input-field text-sm resize-none w-full"
                />
                <p className="text-white/30 text-xs mt-1">This reason will be sent to the user via notification.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRejectModal(null)} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
                <button onClick={handleRejectTopup} className="flex-1 py-2.5 text-sm rounded-xl font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">
                  Reject &amp; Notify User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
