const User = require('../models/User');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');

// ── Balance ──────────────────────────────────────────────────────────────────
exports.getBalance = async (req, res) => {
  res.json({ balance: req.user.wallet });
};

// ── Manual Topup — always goes PENDING, admin must approve ──────────────────
exports.topup = async (req, res) => {
  try {
    const { amount, method, transactionId, note, paymentTimestamp } = req.body;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount greater than 0' });
    }
    if (!transactionId || !transactionId.trim()) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // Sanitize — alphanumeric + dash/underscore only
    const cleanTxnId = transactionId.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
    if (cleanTxnId.length < 6) {
      return res.status(400).json({ error: 'Transaction ID must be at least 6 characters' });
    }

    // Duplicate check — one txn ID can only be submitted once globally
    const existing = await Payment.findOne({ transactionId: cleanTxnId, type: 'topup' });
    if (existing) {
      return res.status(409).json({ error: 'This transaction ID has already been submitted. If you believe this is an error, please raise a support ticket.' });
    }

    // Rate limit: max 3 pending topup submissions per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await Payment.countDocuments({
      user: req.user._id,
      type: 'topup',
      status: 'pending',
      createdAt: { $gte: oneHourAgo },
    });
    if (recentAttempts >= 3) {
      return res.status(429).json({ error: 'You have too many pending topup requests. Please wait for them to be reviewed before submitting another.' });
    }

    // Validate payment timestamp
    const paymentTime = paymentTimestamp ? new Date(paymentTimestamp) : null;
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    if (paymentTime && paymentTime > now) {
      return res.status(400).json({ error: 'Payment timestamp cannot be in the future' });
    }

    const isOldPayment = paymentTime && paymentTime < fortyEightHoursAgo;

    // Save as PENDING — admin must verify and approve before wallet is credited
    const payment = await Payment.create({
      user: req.user._id,
      amount: parsed,
      method: method || 'paytm_business',
      status: 'pending',
      type: 'topup',
      transactionId: cleanTxnId,
      paymentTimestamp: paymentTime || now,
      note: note || `Wallet top-up request of ₹${parsed} via ${method || 'Paytm Business'} — awaiting admin verification`,
    });

    // Notify user that their request is under review
    await Notification.create({
      userId: req.user._id,
      type: 'wallet_topup',
      data: {
        title: 'Top-up Request Received',
        message: `Your wallet top-up request of ₹${parsed} (Txn: ${cleanTxnId}) has been received and is pending admin verification. You will be notified once it is approved.`,
      },
    });

    // If payment is older than 48 hours, also create a support ticket
    if (isOldPayment) {
      const ticket = await Ticket.create({
        user: req.user._id,
        subject: `Old Payment Verification — ₹${parsed} (Txn: ${cleanTxnId})`,
        category: 'Payment',
        priority: 'medium',
        messages: [{
          sender: req.user._id,
          senderName: req.user.name,
          senderRole: 'user',
          content: `I made a payment of ₹${parsed} via ${method || 'Paytm Business QR'} on ${paymentTime.toLocaleString('en-IN')}.\n\nTransaction ID: ${cleanTxnId}\n\nThis payment is older than 48 hours. Please verify and credit my wallet.`,
        }],
      });

      return res.status(202).json({
        pending: true,
        oldPayment: true,
        paymentId: payment._id,
        ticketNumber: ticket.ticketNumber,
        ticketId: ticket._id,
        message: `Your payment is older than 48 hours. A support ticket (${ticket.ticketNumber}) has been created. Our team will verify and credit your wallet shortly.`,
      });
    }

    return res.status(202).json({
      pending: true,
      paymentId: payment._id,
      message: `Your top-up request of ₹${parsed} has been submitted. Our team will verify your transaction ID and credit your wallet shortly.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Approve a pending topup ───────────────────────────────────────────
exports.approveTopup = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId).populate('user', 'name email wallet');
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.type !== 'topup') return res.status(400).json({ error: 'Not a topup payment' });
    if (payment.status !== 'pending') return res.status(400).json({ error: `Payment is already ${payment.status}` });

    // Credit the wallet
    const updatedUser = await User.findByIdAndUpdate(
      payment.user._id,
      { $inc: { wallet: payment.amount } },
      { new: true }
    );

    payment.status = 'completed';
    payment.verifiedByAdmin = true;
    payment.note = `${payment.note || ''} | Approved by admin on ${new Date().toLocaleString('en-IN')}`.trim();
    await payment.save();

    // Notify user
    await Notification.create({
      userId: payment.user._id,
      type: 'wallet_topup',
      data: {
        title: '✅ Wallet Topped Up',
        message: `Your payment of ₹${payment.amount} (Txn: ${payment.transactionId}) has been verified and ₹${payment.amount} has been added to your wallet. New balance: ₹${updatedUser.wallet.toFixed(2)}.`,
      },
    });

    // Emit real-time notification if socket available
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${payment.user._id}`).emit('wallet_updated', { balance: updatedUser.wallet });
    }

    res.json({ message: `₹${payment.amount} credited to ${payment.user.name}'s wallet`, payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Reject a pending topup ────────────────────────────────────────────
exports.rejectTopup = async (req, res) => {
  try {
    const { reason } = req.body;
    const payment = await Payment.findById(req.params.paymentId).populate('user', 'name email');
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.type !== 'topup') return res.status(400).json({ error: 'Not a topup payment' });
    if (payment.status !== 'pending') return res.status(400).json({ error: `Payment is already ${payment.status}` });

    payment.status = 'failed';
    payment.note = `Rejected by admin: ${reason || 'Transaction ID could not be verified'} | ${new Date().toLocaleString('en-IN')}`;
    await payment.save();

    // Notify user
    await Notification.create({
      userId: payment.user._id,
      type: 'wallet_topup',
      data: {
        title: '❌ Top-up Request Rejected',
        message: `Your top-up request of ₹${payment.amount} (Txn: ${payment.transactionId}) was rejected. Reason: ${reason || 'Transaction ID could not be verified'}. If you believe this is an error, please raise a support ticket.`,
      },
    });

    res.json({ message: 'Payment rejected', payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Get all pending topups ─────────────────────────────────────────────
exports.getPendingTopups = async (req, res) => {
  try {
    const pending = await Payment.find({ type: 'topup', status: 'pending' })
      .populate('user', 'name email wallet')
      .sort({ createdAt: -1 });
    res.json({ payments: pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Payment Methods CRUD ──────────────────────────────────────────────────────
// Always read/write from the admin user so all users see the same methods
const getAdminUser = async () => {
  const admin = await User.findOne({ role: 'admin' }).select('paymentMethods');
  return admin;
};

exports.getPaymentMethods = async (req, res) => {
  try {
    const admin = await getAdminUser();
    res.json({ paymentMethods: admin ? admin.paymentMethods || [] : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addPaymentMethod = async (req, res) => {
  try {
    const { type, label, upiId, merchantId, qrCodeUrl, accountDetails, isDefault } = req.body;
    if (!type || !label) return res.status(400).json({ error: 'Type and label are required' });

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    if (isDefault) {
      admin.paymentMethods.forEach((m) => { m.isDefault = false; });
    }

    admin.paymentMethods.push({ type, label, upiId, merchantId: merchantId || '', qrCodeUrl, accountDetails, isDefault: !!isDefault });
    await admin.save({ validateBeforeSave: false });

    res.status(201).json({ paymentMethods: admin.paymentMethods });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePaymentMethod = async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    admin.paymentMethods = admin.paymentMethods.filter(
      (m) => m._id.toString() !== req.params.methodId
    );
    await admin.save({ validateBeforeSave: false });
    res.json({ paymentMethods: admin.paymentMethods });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: get all payments ───────────────────────────────────────────────────
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Cashfree Payment Gateway ──────────────────────────────────────────────────
const { Cashfree } = require('cashfree-pg');

// Configure Cashfree SDK (v5+ uses string constants directly)
Cashfree.XClientId = process.env.CASHFREE_APP_ID;
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
Cashfree.XEnvironment = process.env.CASHFREE_ENV === 'production'
  ? 'production'
  : 'sandbox';

// Create a Cashfree order and return the payment session ID
exports.createCashfreeOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount greater than 0' });
    }

    const orderId = `WALLET_${req.user._id}_${Date.now()}`;

    const orderRequest = {
      order_id: orderId,
      order_amount: parsed,
      order_currency: 'INR',
      customer_details: {
        customer_id: req.user._id.toString(),
        customer_name: req.user.name,
        customer_email: req.user.email,
        customer_phone: req.user.phone || '9999999999',
      },
      order_meta: {
        return_url: `${process.env.CLIENT_URL}/dashboard?cashfree_order_id={order_id}`,
        notify_url: `${process.env.BACKEND_URL || process.env.CLIENT_URL?.replace(':5173', ':5000')}/api/wallet/cashfree/webhook`,
      },
      order_note: `Wallet top-up for ${req.user.email}`,
    };

    const response = await Cashfree.PGCreateOrder('2023-08-01', orderRequest);
    const { payment_session_id, order_id } = response.data;

    // Save a pending payment record
    await Payment.create({
      user: req.user._id,
      amount: parsed,
      method: 'cashfree',
      status: 'pending',
      type: 'topup',
      transactionId: order_id,
      note: `Cashfree wallet top-up — awaiting payment`,
    });

    res.json({ payment_session_id, order_id });
  } catch (err) {
    console.error('Cashfree create order error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create payment order. Please try again.' });
  }
};

// Verify payment after user returns from Cashfree
exports.verifyCashfreePayment = async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });

    const response = await Cashfree.PGFetchOrder('2023-08-01', order_id);
    const order = response.data;

    if (order.order_status !== 'PAID') {
      return res.status(400).json({ error: `Payment not completed. Status: ${order.order_status}` });
    }

    // Find the pending payment
    const payment = await Payment.findOne({ transactionId: order_id, type: 'topup', user: req.user._id });
    if (!payment) return res.status(404).json({ error: 'Payment record not found' });
    if (payment.status === 'completed') {
      return res.json({ message: 'Already credited', balance: req.user.wallet });
    }

    // Credit wallet
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { wallet: payment.amount } },
      { new: true }
    );

    payment.status = 'completed';
    payment.verifiedByAdmin = true;
    payment.note = `Cashfree payment verified — ${order_id}`;
    await payment.save();

    await Notification.create({
      userId: req.user._id,
      type: 'wallet_topup',
      data: {
        title: '✅ Wallet Topped Up',
        message: `₹${payment.amount} has been added to your wallet via Cashfree. New balance: ₹${updatedUser.wallet.toFixed(2)}.`,
      },
    });

    const io = req.app.get('io');
    if (io) io.to(`user_${req.user._id}`).emit('wallet_updated', { balance: updatedUser.wallet });

    res.json({ message: `₹${payment.amount} credited successfully`, balance: updatedUser.wallet });
  } catch (err) {
    console.error('Cashfree verify error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Verification failed. Please contact support.' });
  }
};

// Webhook — Cashfree calls this automatically on payment events
exports.cashfreeWebhook = async (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    // Verify webhook signature
    try {
      Cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const { data, type } = req.body;
    if (type !== 'PAYMENT_SUCCESS_WEBHOOK') return res.sendStatus(200);

    const orderId = data?.order?.order_id;
    const paidAmount = data?.payment?.payment_amount;
    if (!orderId) return res.sendStatus(200);

    const payment = await Payment.findOne({ transactionId: orderId, type: 'topup' }).populate('user', 'name email wallet');
    if (!payment || payment.status === 'completed') return res.sendStatus(200);

    const updatedUser = await User.findByIdAndUpdate(
      payment.user._id,
      { $inc: { wallet: paidAmount || payment.amount } },
      { new: true }
    );

    payment.status = 'completed';
    payment.verifiedByAdmin = true;
    payment.note = `Cashfree webhook confirmed — ${orderId}`;
    await payment.save();

    await Notification.create({
      userId: payment.user._id,
      type: 'wallet_topup',
      data: {
        title: '✅ Wallet Topped Up',
        message: `₹${paidAmount || payment.amount} has been added to your wallet via Cashfree.`,
      },
    });

    res.sendStatus(200);
  } catch (err) {
    console.error('Cashfree webhook error:', err.message);
    res.sendStatus(500);
  }
};
