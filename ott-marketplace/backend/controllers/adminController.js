const User = require('../models/User');
const Product = require('../models/Product');
const { PLATFORM_THEMES, PLATFORM_SERVICES } = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { body, validationResult } = require('express-validator');
const { sendMail, walletTopupMail, orderDeliveredMail } = require('../utils/mailer');

// Apply auto-theme + default services if not manually provided
function applyAutoTheme(body) {
  const key = (body.platform || '').toLowerCase();
  const theme = PLATFORM_THEMES[key];
  if (theme) {
    if (!body.gradientFrom || body.gradientFrom === '#6366f1') body.gradientFrom = theme.gradientFrom;
    if (!body.gradientTo || body.gradientTo === '#8b5cf6') body.gradientTo = theme.gradientTo;
    if (!body.priceColor) body.priceColor = theme.priceColor;
    body.color = body.gradientFrom;
  }
  // Auto-fill services if empty
  if (!body.services || body.services.length === 0) {
    body.services = PLATFORM_SERVICES[key] || [];
  }
  return body;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

exports.getDashboard = async (req, res) => {
  try {
    const [totalUsers, totalOrders, revenueAgg, recentOrders, lowStockProducts, pendingPayments] =
      await Promise.all([
        User.countDocuments({ role: 'user' }),
        Order.countDocuments(),
        Order.aggregate([
          { $match: { status: { $in: ['delivered', 'processing', 'pending'] } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Order.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('user', 'name email')
          .lean(),
        // bypass soft-delete hook by passing deletedAt filter explicitly
        Product.find({ deletedAt: null, stock: { $lt: 10 } }).lean(),
        Payment.find({ status: 'pending' })
          .populate('user', 'name email')
          .sort({ createdAt: -1 })
          .lean(),
      ]);

    res.json({
      totalUsers,
      totalOrders,
      totalRevenue: revenueAgg[0]?.total || 0,
      recentOrders,
      lowStockProducts,
      pendingPayments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Products ────────────────────────────────────────────────────────────────

exports.productValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('platform').notEmpty().withMessage('Platform is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be >= 0'),
  body('originalPrice').isFloat({ min: 0 }).withMessage('Original price must be >= 0'),
  body('duration').notEmpty().withMessage('Duration is required'),
];

exports.listProducts = async (req, res) => {
  try {
    // Admin sees ALL products including soft-deleted.
    // Pass deletedAt filter explicitly to bypass the pre-find hook's default null filter.
    const products = await Product.find({ $or: [{ deletedAt: null }, { deletedAt: { $ne: null } }] })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: 'Validation failed', details: errors.array() });
  }
  try {
    let body = { ...req.body };
    if (body.price !== undefined) body.price = Number(body.price);
    if (body.originalPrice !== undefined) body.originalPrice = Number(body.originalPrice);
    if (body.stock !== undefined) body.stock = Number(body.stock);
    if (body.durationDays !== undefined) body.durationDays = Number(body.durationDays);
    body = applyAutoTheme(body);
    const product = await Product.create(body);
    res.status(201).json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    let body = { ...req.body };
    if (body.price !== undefined) body.price = Number(body.price);
    if (body.originalPrice !== undefined) body.originalPrice = Number(body.originalPrice);
    if (body.stock !== undefined) body.stock = Number(body.stock);
    body = applyAutoTheme(body);

    // Bypass soft-delete hook by passing deletedAt explicitly
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, $or: [{ deletedAt: null }, { deletedAt: { $ne: null } }] },
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { deletedAt: new Date(), isActive: false } },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found or already deleted' });
    res.json({ message: 'Product deleted', product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Users ───────────────────────────────────────────────────────────────────

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('_id name email wallet isActive createdAt lastLogin')
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((u) => u._id);
    const orderCounts = await Order.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 }, spent: { $sum: '$amount' } } },
    ]);
    const countMap = Object.fromEntries(
      orderCounts.map((o) => [o._id.toString(), { count: o.count, spent: o.spent }])
    );

    const enriched = users.map((u) => ({
      ...u,
      walletBalance: u.wallet,
      signupDate: u.createdAt,
      orderCount: countMap[u._id.toString()]?.count || 0,
      totalSpent: countMap[u._id.toString()]?.spent || 0,
    }));

    res.json({ users: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [orders, payments] = await Promise.all([
      Order.find({ user: user._id }).sort({ createdAt: -1 }).lean(),
      Payment.find({ user: user._id }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json({
      user: { ...user, walletBalance: user.wallet, signupDate: user.createdAt },
      orders,
      payments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleUserActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ user, message: `User ${user.isActive ? 'activated' : 'deactivated'}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Cannot delete admin accounts' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: `User ${user.name} deleted permanently` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Orders ──────────────────────────────────────────────────────────────────

exports.listOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email wallet')
      .populate('product', 'name platform')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, credentials } = req.body;
    const allowed = ['pending', 'processing', 'delivered', 'cancelled', 'refunded'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const order = await Order.findById(req.params.id).populate('user', 'name email wallet');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled orders cannot be modified' });
    }

    const update = { status };
    if (credentials) update.credentials = credentials;

    if (status === 'cancelled' && !order.isRefunded) {
      await User.findByIdAndUpdate(order.user._id, { $inc: { wallet: order.amount } });
      update.isRefunded = true;
      update.refundStatus = 'completed';

      await Payment.create({
        user: order.user._id,
        order: order._id,
        amount: order.amount,
        method: 'wallet',
        status: 'refunded',
        type: 'refund',
        transactionId: 'REFUND-' + order.orderNumber,
        note: `Auto-refund for cancelled order ${order.orderNumber}`,
      });
    }

    const updated = await Order.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'name email wallet')
      .populate('product', 'name platform');

    res.json({ order: updated });

    // Send activation email when admin marks delivered (non-blocking)
    if (status === 'delivered' && updated?.user?.email) {
      sendMail({
        to: updated.user.email,
        ...orderDeliveredMail({
          userName: updated.user.name,
          orderNumber: updated.orderNumber,
          productName: updated.productSnapshot?.name,
          amount: updated.amount,
          duration: updated.productSnapshot?.duration,
          credentials: credentials
            ? `${credentials.email ? 'Email: ' + credentials.email + '\n' : ''}${credentials.password ? 'Password: ' + credentials.password : ''}${credentials.notes ? '\nNotes: ' + credentials.notes : ''}`.trim()
            : null,
        }),
      }).catch(() => {});
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Admin: Fund User Wallet ─────────────────────────────────────────────────

exports.fundUserWallet = async (req, res) => {
  try {
    const { amount, reason, reference, note } = req.body;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return res.status(400).json({ error: 'Enter a valid amount > 0' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.wallet = parseFloat((user.wallet + parsed).toFixed(2));
    await user.save({ validateBeforeSave: false });

    const txnId = 'ADMIN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
    await Payment.create({
      user: user._id,
      amount: parsed,
      method: 'admin',
      status: 'completed',
      type: 'topup',
      transactionId: txnId,
      note: note || `Admin credit: ${reason || 'Manual Adjustment'}${reference ? ' · Ref: ' + reference : ''}`,
    });

    // Real-time push
    const io = req.app.get('io');
    if (io) io.to(`user_${user._id}`).emit('walletUpdate', { balance: user.wallet });

    res.json({
      message: `₹${parsed} added to ${user.name}'s wallet`,
      newBalance: user.wallet,
      transactionId: txnId,
    });

    // Send topup email (non-blocking)
    sendMail({
      to: user.email,
      ...walletTopupMail({
        userName: user.name,
        amount: parsed,
        newBalance: user.wallet,
        transactionId: txnId,
      }),
    }).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Payments ────────────────────────────────────────────────────────────────
exports.listPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate('order', 'orderNumber amount status')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = payments.map((p) => ({
      _id: p._id,
      userId: p.user?._id,
      userEmail: p.user?.email,
      userName: p.user?.name,
      orderId: p.order?._id,
      orderNumber: p.order?.orderNumber,
      amount: p.amount,
      method: p.method,
      status: p.status,
      type: p.type,
      transactionId: p.transactionId,
      timestamp: p.createdAt,
      note: p.note,
    }));

    res.json({ payments: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
