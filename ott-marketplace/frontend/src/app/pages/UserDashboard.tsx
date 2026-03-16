import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useWallet } from '../hooks/useWallet';
import WalletTopupModal from '../components/WalletTopupModal';
import OrderHistoryTable from '../components/OrderHistoryTable';
import ActiveSubsCard, { type Subscription } from '../components/ActiveSubsCard';
import SubscriptionsModal from '../components/SubscriptionsModal';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import { useCurrency } from '../hooks/useCurrency';

interface Order {
  _id: string;
  orderNumber: string;
  productSnapshot: { name: string; platform: string; logo: string; duration: string };
  amount: number;
  status: string;
  createdAt: string;
}

const tabs = ['Overview', 'Orders', 'Profile'];

export default function UserDashboard() {
  const { user } = useAuth();
  const { updateUser } = useAuthStore();
  const { format } = useCurrency();
  const [activeTab, setActiveTab] = useState('Overview');
  const [walletOpen, setWalletOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsCount, setSubsCount] = useState(0);
  const [subsLoading, setSubsLoading] = useState(true);
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { name: user?.name || '' } });

  const fetchSubs = useCallback(async () => {
    setSubsLoading(true);
    try {
      const { data } = await api.get('/user/subscriptions/active');
      setSubs(data.subscriptions || []);
      setSubsCount(data.count || 0);
    } catch {
      // silent
    } finally {
      setSubsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubs();
    fetchOrders();
  }, [fetchSubs]);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const { data } = await api.get('/orders/my');
      setOrders(data.orders);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleProfileUpdate = async (data: { name: string }) => {
    try {
      const res = await api.put('/user/profile', data);
      updateUser(res.data.user);
      toast.success('Profile updated');
    } catch {
      toast.error('Update failed');
    }
  };

  const stats = [
    { label: 'Wallet Balance', value: format(user?.wallet ?? 0), icon: 'pi-wallet', color: 'from-indigo-500 to-purple-600' },
    { label: 'Total Orders', value: orders.length || '—', icon: 'pi-shopping-bag', color: 'from-blue-500 to-cyan-500' },
    { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : '—', icon: 'pi-calendar', color: 'from-orange-500 to-pink-500' },
  ];

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-10">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-500/30">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-white font-bold text-2xl">Hey, {user?.name?.split(' ')[0]} 👋</h1>
              <p className="text-white/40 text-sm">{user?.email}</p>
            </div>
          </div>
          <button onClick={() => setWalletOpen(true)} className="btn-primary flex items-center gap-2">
            <i className="pi pi-plus text-sm" />
            Top Up
          </button>
        </motion.div>

        {/* Stats row + Active Subs card */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="glass rounded-2xl p-4 border border-white/10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <i className={`pi ${stat.icon} text-white text-sm`} />
              </div>
              <div className="text-white font-bold text-xl">{stat.value}</div>
              <div className="text-white/40 text-xs mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
          {/* Active Subs card spans full width on mobile, 1 col on lg */}
          <div className="col-span-2 lg:col-span-1">
            <ActiveSubsCard
              onClick={() => setSubsOpen(true)}
              subs={subs}
              count={subsCount}
              loading={subsLoading}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 glass rounded-xl p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-indigo-500 text-white shadow-lg'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'Overview' && (
            <div className="space-y-6">
              {/* Wallet card */}
              <div className="glass rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                    <i className="pi pi-wallet text-indigo-400" /> Wallet
                  </h3>
                  <button onClick={() => setWalletOpen(true)} className="btn-ghost text-sm py-1.5 px-3">
                    <i className="pi pi-plus mr-1 text-xs" /> Add Funds
                  </button>
                </div>
                <div className="text-4xl font-black text-white mb-1">{format(user?.wallet ?? 0)}</div>
                <p className="text-white/40 text-sm">Available balance</p>
              </div>

              {/* Recent orders preview */}
              <div className="glass rounded-2xl p-6 border border-white/10">
                <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                  <i className="pi pi-history text-indigo-400" /> Recent Activity
                </h3>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-white/30">
                    <i className="pi pi-inbox text-4xl mb-2 block" />
                    <p>No orders yet. <a href="/shop" className="text-indigo-400">Browse subscriptions</a></p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0, 3).map((order) => (
                      <div key={order._id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                        <div>
                          <p className="text-white text-sm font-medium">{order.productSnapshot?.name}</p>
                          <p className="text-white/40 text-xs">{order.orderNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-indigo-400 font-bold">{format(order.amount)}</p>
                          <span className={`text-xs ${order.status === 'delivered' ? 'text-green-400' : order.status === 'pending' ? 'text-yellow-400' : 'text-white/40'}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Orders' && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h3 className="text-white font-semibold text-lg mb-4">Order History</h3>
              <OrderHistoryTable orders={orders} loading={ordersLoading} />
            </div>
          )}

          {activeTab === 'Profile' && (
            <div className="glass rounded-2xl p-6 border border-white/10 max-w-lg">
              <h3 className="text-white font-semibold text-lg mb-6">Edit Profile</h3>
              <form onSubmit={handleSubmit(handleProfileUpdate)} className="space-y-4">
                <div>
                  <label className="text-white/70 text-sm font-medium block mb-2">Full Name</label>
                  <input
                    {...register('name', { required: 'Name required' })}
                    className="input-field"
                  />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium block mb-2">Email</label>
                  <input value={user?.email} disabled className="input-field opacity-50 cursor-not-allowed" />
                </div>
                <button type="submit" className="btn-primary py-2.5 px-6">
                  <i className="pi pi-save mr-2 text-sm" /> Save Changes
                </button>
              </form>
            </div>
          )}
        </motion.div>
      </div>

      <WalletTopupModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
      <SubscriptionsModal
        isOpen={subsOpen}
        onClose={() => setSubsOpen(false)}
        subs={subs}
        onRefresh={fetchSubs}
      />
    </div>
  );
}
