const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Payment = require('../models/Payment');

exports.createOrder = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId);
    if (!product || !product.isActive) return res.status(404).json({ error: 'Product not found' });
    if (product.stock < 1) return res.status(400).json({ error: 'Out of stock' });

    const user = await User.findById(req.user._id);
    if (user.wallet < product.price) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please top up.' });
    }

    // Deduct wallet
    user.wallet -= product.price;
    await user.save({ validateBeforeSave: false });

    // Reduce stock
    product.stock -= 1;
    await product.save();

    const transactionId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();

    const order = await Order.create({
      user: user._id,
      product: product._id,
      productSnapshot: {
        name: product.name,
        platform: product.platform,
        price: product.price,
        duration: product.duration,
        logo: product.logo || product.imageUrl || '',
      },
      amount: product.price,
      paymentDetails: {
        method: 'wallet',
        transactionId,
        amount: product.price,
        date: new Date(),
      },
    });

    // Record payment
    await Payment.create({
      user: user._id,
      order: order._id,
      amount: product.price,
      method: 'wallet',
      status: 'completed',
      type: 'purchase',
      transactionId,
      note: `Purchase: ${product.name}`,
    });

    res.status(201).json({ order, newBalance: user.wallet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('product', 'name platform logo')
      .sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('product', 'name platform')
      .sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, credentials } = req.body;

    const order = await Order.findById(req.params.id).populate('user', 'name email wallet');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled orders cannot be modified' });
    }

    const update = { status };
    if (credentials) update.credentials = credentials;

    if (status === 'refunded' && !order.isRefunded) {
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
        note: `Refund for order ${order.orderNumber}`,
      });
    }

    const updated = await Order.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'name email')
      .populate('product', 'name platform');

    res.json({ order: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
