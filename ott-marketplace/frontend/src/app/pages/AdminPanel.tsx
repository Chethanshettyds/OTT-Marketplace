import { useState, useEffect } from 'react';
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

const TABS = ['Dashboard', 'Products', 'Orders', 'Users', 'Payments', 'Tickets', 'Broadcast', 'Settings'];

interface PaymentMethod {
  _id: string; type: string; label: string;
  upiId: string; qrCodeUrl: string; accountDetails: string; isDefault: boolean;
}
interface AddMethodForm {
  type: string; label: string; upiId: string;
  qrCodeUrl: string; accountDetails: string; isDefault: boolean;
}
const EMPTY_FORM: AddMethodForm = { type: '', label: '', upiId: '', qrCodeUrl: '', accountDetails: '', isDefault: false };

interface Product {
  _id: string; name: string; platform: string; category: string;
  price: number; originalPrice: number; duration: string; stock: number;
  isActive: boolean; gradientFrom: string; gradientTo: string;
  imageUrl?: string; deletedAt?: string | null;
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
}
interface Payment {
  _id: string; userEmail: string; userName: string; orderId: string;
  orderNumber: string; amount: number; method: string; status: string;
  type: string; transactionId: string; timestamp: string;
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

  // ── Payment Methods (Settings tab) ──────────────────────────────────────────
  const [payMethods, setPayMethods] = useState<PaymentMethod[]>([]);
  const [payLoading, setPayLoading] = useState(false);
  const [showAddPay, setShowAddPay] = useState(false);
  const [payForm, setPayForm] = useState<AddMethodForm>(EMPTY_FORM);
  const [paySaving, setPaySaving] = useState(false);

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
  const { counts, markRead } = useNotifications();

  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    if (activeTab === 'Products') fetchProducts();
    else if (activeTab === 'Orders') fetchOrders();
    else if (activeTab === 'Users') fetchUsers();
    else if (activeTab === 'Payments') fetchPayments();
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

  const handleAddPayMethod = async () => {
    if (!payForm.type) return toast.error('Select a payment type');
    if (!payForm.label.trim()) return toast.error('Enter a label');
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
    setProductDialog(true);
  };

  const handleProductSave = async (data: Partial<Product>) => {
    try {
      if (editProduct) {
        await api.put(`/admin/products/${editProduct._id}`, data);
        toast.success('Product updated');
      } else {
        await api.post('/admin/products', data);
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

  const handleFundSuccess = (userId: string, newBalance: number) => {
    setUsers((prev) => prev.map((u) =>
      u._id === userId ? { ...u, wallet: newBalance, walletBalance: newBalance } : u
    ));
    fetchPayments(); // refresh payments table
  };

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: 'pi-users', color: 'from-blue-500 to-cyan-500' },
    { label: 'Total Orders', value: stats.totalOrders, icon: 'pi-shopping-bag', color: 'from-indigo-500 to-purple-600' },
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toFixed(2)}`, icon: 'pi-dollar', color: 'from-yellow-500 to-orange-500' },
    { label: 'Low Stock', value: stats.lowStockProducts.length, icon: 'pi-exclamation-triangle', color: 'from-red-500 to-pink-500' },
    { label: 'Pending Payments', value: stats.pendingPayments.length, icon: 'pi-clock', color: 'from-orange-500 to-red-500' },
  ] : [];

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4">
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
        <div className="flex gap-1 mb-6 glass rounded-xl p-1 w-fit overflow-x-auto">
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
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">Products</h3>
                <button onClick={() => openProductDialog()} className="btn-primary text-sm py-2 px-4">
                  <i className="pi pi-plus mr-1 text-xs" /> Add Product
                </button>
              </div>
              <DataTable value={products} loading={loading} paginator rows={10} emptyMessage="No products">
                <Column field="name" header="Name" style={{ minWidth: '180px' }} />
                <Column field="platform" header="Platform" />
                <Column field="price" header="Price" body={(r) => <span className="text-indigo-400 font-bold">₹{r.price}</span>} />
                <Column field="duration" header="Duration" />
                <Column field="stock" header="Stock" body={(r) => <span className={r.stock < 10 ? 'text-red-400 font-bold' : ''}>{r.stock}</span>} />
                <Column field="isActive" header="Status" body={(r) => (
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
              <DataTable value={orders} loading={loading} paginator rows={10} emptyMessage="No orders">
                <Column field="orderNumber" header="Order #" style={{ minWidth: '160px' }} />
                <Column header="User" body={(r) => <span>{r.user?.name}<br /><span className="text-white/40 text-xs">{r.user?.email}</span></span>} />
                <Column header="Product" body={(r) => <span>{r.productSnapshot?.name}</span>} />
                <Column header="Amount" body={(r) => <span className="text-indigo-400 font-bold">₹{r.amount}</span>} />
                <Column header="Method" body={(r) => <span className="text-white/60 text-xs capitalize">{r.paymentDetails?.method || 'wallet'}</span>} />
                <Column header="Status" body={(r) => (
                  <Tag value={r.status} severity={r.status === 'delivered' ? 'success' : r.status === 'cancelled' ? 'danger' : r.status === 'refunded' ? 'warning' : 'info'} />
                )} />
                <Column header="Refund" body={(r) => r.isRefunded ? <Tag value="Refunded" severity="warning" /> : <span className="text-white/30 text-xs">—</span>} />
                <Column header="Actions" body={(r) => (
                  <div className="flex gap-1 flex-wrap">
                    {r.status !== 'cancelled' && r.status !== 'delivered' && (
                      <button onClick={() => handleOrderStatus(r._id, 'delivered')} className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">
                        Deliver
                      </button>
                    )}
                    {r.status !== 'cancelled' && (
                      <button onClick={() => handleOrderStatus(r._id, 'cancelled')} className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">
                        Cancel
                      </button>
                    )}
                    {r.status === 'cancelled' && (
                      <span className="text-xs text-white/30 italic">Locked</span>
                    )}
                  </div>
                )} />
              </DataTable>
            </div>
          )}

          {/* ── Users ── */}
          {activeTab === 'Users' && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-white font-semibold text-lg">All Users</h3>
                <div className="flex items-center gap-2 text-white/40 text-xs">
                  <i className="pi pi-info-circle" /> Click 💰 to add funds to a user's wallet
                </div>
              </div>
              <DataTable value={users} loading={loading} paginator rows={10} emptyMessage="No users">
                <Column field="name" header="Name" />
                <Column field="email" header="Email" />
                <Column header="Wallet" body={(r) => <span className="text-indigo-400 font-bold">₹{(r.walletBalance ?? r.wallet ?? 0).toFixed(2)}</span>} />
                <Column header="Orders" body={(r) => <span className="text-white/70">{r.orderCount}</span>} />
                <Column header="Spent" body={(r) => <span className="text-green-400">₹{(r.totalSpent || 0).toFixed(2)}</span>} />
                <Column header="Joined" body={(r) => <span className="text-white/50 text-sm">{new Date(r.createdAt).toLocaleDateString()}</span>} />
                <Column header="Status" body={(r) => <Tag value={r.isActive ? 'Active' : 'Banned'} severity={r.isActive ? 'success' : 'danger'} />} />
                <Column header="Actions" body={(r) => (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setFundTarget(r)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors font-medium"
                      title="Add funds to wallet"
                    >
                      💰 Fund
                    </button>
                    <button onClick={() => handleToggleUser(r._id)}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${r.isActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                      {r.isActive ? 'Ban' : 'Unban'}
                    </button>
                  </div>
                )} />
              </DataTable>
            </div>
          )}

          {/* ── Payments ── */}
          {activeTab === 'Payments' && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-white font-semibold text-lg">All Payments</h3>
                <button
                  onClick={() => setActiveTab('Users')}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  💰 Add Funds to User
                </button>
              </div>
              <DataTable value={payments} loading={loading} paginator rows={10} emptyMessage="No payments">
                <Column header="User" body={(r) => <span>{r.userName}<br /><span className="text-white/40 text-xs">{r.userEmail}</span></span>} />
                <Column header="Amount" body={(r) => (
                  <span className={`font-bold ${r.type === 'topup' || r.type === 'refund' ? 'text-green-400' : 'text-red-400'}`}>
                    {r.type === 'purchase' ? '-' : '+'}₹{r.amount?.toFixed(2)}
                  </span>
                )} />
                <Column header="Type" body={(r) => <Tag value={r.type} severity={r.type === 'topup' ? 'success' : r.type === 'refund' ? 'warning' : 'info'} />} />
                <Column header="Method" body={(r) => <span className="text-white/60 text-xs capitalize">{r.method}</span>} />
                <Column header="Status" body={(r) => <Tag value={r.status} severity={r.status === 'completed' ? 'success' : r.status === 'refunded' ? 'warning' : 'danger'} />} />
                <Column header="Note" body={(r) => <span className="text-white/40 text-xs">{r.note || '—'}</span>} style={{ maxWidth: '200px' }} />
                <Column header="Date" body={(r) => <span className="text-white/50 text-sm">{new Date(r.timestamp).toLocaleString()}</span>} />
              </DataTable>
            </div>
          )}

          {/* ── Tickets ── */}
          {activeTab === 'Tickets' && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h3 className="text-white font-semibold text-lg mb-4">Support Tickets</h3>
              <DataTable
                value={tickets}
                loading={loading}
                paginator
                rows={10}
                emptyMessage="No tickets"
                rowClassName={() => 'cursor-pointer hover:bg-white/5 transition-colors'}
                onRowClick={(e) => {
                  markRead('support', e.data._id);
                  navigate(`/admin/tickets/${e.data._id}`);
                }}
              >
                <Column field="ticketNumber" header="Ticket #" />
                <Column header="User" body={(r) => <span>{r.user?.name}<br /><span className="text-white/40 text-xs">{r.user?.email}</span></span>} />
                <Column field="subject" header="Subject" style={{ minWidth: '200px' }} />
                <Column header="Priority" body={(r) => <Tag value={r.priority} severity={r.priority === 'high' ? 'danger' : r.priority === 'medium' ? 'warning' : 'info'} />} />
                <Column header="Status" body={(r) => <Tag value={r.status} severity={r.status === 'open' ? 'success' : r.status === 'in-progress' ? 'warning' : 'secondary'} />} />
                <Column header="Date" body={(r) => <span className="text-white/50 text-sm">{new Date(r.createdAt).toLocaleDateString()}</span>} />
                <Column header="" body={() => <i className="pi pi-chevron-right text-white/30 text-xs" />} style={{ width: '40px' }} />
              </DataTable>
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

                                  {['paytm', 'phonepe', 'gpay', 'bharatpe', 'upi'].includes(payForm.type) && (
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

                                  <div>
                                    <label className="text-white/60 text-xs block mb-1">QR Code URL (optional)</label>
                                    <input
                                      value={payForm.qrCodeUrl}
                                      onChange={(e) => setPayForm((f) => ({ ...f, qrCodeUrl: e.target.value }))}
                                      placeholder="https://... (link to your QR image)"
                                      className="input-field text-sm"
                                    />
                                  </div>

                                  {['bank', 'binance', 'other'].includes(payForm.type) && (
                                    <div>
                                      <label className="text-white/60 text-xs block mb-1">Account Details</label>
                                      <textarea
                                        value={payForm.accountDetails}
                                        onChange={(e) => setPayForm((f) => ({ ...f, accountDetails: e.target.value }))}
                                        placeholder={payForm.type === 'binance' ? 'Binance Pay ID or wallet address' : 'Account number, IFSC, etc.'}
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
            </div>
          )}

        </motion.div>
      </div>

      {/* Product Dialog */}
      <Dialog visible={productDialog} onHide={() => setProductDialog(false)}
        header={editProduct ? 'Edit Product' : 'Add Product'} style={{ width: '520px' }} className="glass">
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
              <label className="text-white/70 text-sm block mb-1">Price ($)</label>
              <input {...register('price', { required: true, valueAsNumber: true })} type="number" step="0.01" className="input-field text-sm" />
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Original Price ($)</label>
              <input {...register('originalPrice', { required: true, valueAsNumber: true })} type="number" step="0.01" className="input-field text-sm" />
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
              <label className="text-white/70 text-sm block mb-1">Color From</label>
              <input {...register('gradientFrom')} type="color" className="input-field text-sm h-10" />
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-1">Color To</label>
              <input {...register('gradientTo')} type="color" className="input-field text-sm h-10" />
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <label className="text-white/70 text-sm block">Product Image</label>

            {/* Upload button */}
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

            {/* OR paste URL */}
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

            {/* Preview */}
            {imagePreview && (
              <div className="relative w-full h-32 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                  onError={() => setImagePreview('')}
                />
                <button
                  type="button"
                  onClick={() => { setImagePreview(''); setValue('imageUrl', ''); }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/70 hover:text-red-400 flex items-center justify-center text-xs"
                >
                  <i className="pi pi-times" />
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1 py-2.5">Save</button>
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
    </div>
  );
}
