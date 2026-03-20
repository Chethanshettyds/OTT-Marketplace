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
