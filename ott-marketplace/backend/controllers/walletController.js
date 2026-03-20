const User = require('../models/User');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');

// ── Balance ──────────────────────────────────────────────────────────────────
exports.getBalance = async (req, res) => {
  res.json({ balance: req.user.wallet });
};

// ── Manual Topup (any amount + transaction ID) ────────────────────────────────
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

    // Sanitize transaction ID — alphanumeric only to prevent injection
    const cleanTxnId = transactionId.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
    if (cleanTxnId.length < 6) {
      return res.status(400).json({ error: 'Transaction ID must be at least 6 characters' });
    }

    // Check duplicate transaction ID (anti-spam: one txn ID can only be used once globally)
    const existing = await Payment.findOne({ transactionId: cleanTxnId, type: 'topup' });
    if (existing) {
      return res.status(409).json({ error: 'This transaction ID has already been used' });
    }

    // Rate limit: max 5 topup attempts per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await Payment.countDocuments({
      user: req.user._id,
      type: 'topup',
      createdAt: { $gte: oneHourAgo },
    });
    if (recentAttempts >= 5) {
      return res.status(429).json({ error: 'Too many topup attempts. Please wait before trying again.' });
    }

    // ── 48-hour check ──────────────────────────────────────────────────────────
    // paymentTimestamp is when the user claims they made the payment
    const paymentTime = paymentTimestamp ? new Date(paymentTimestamp) : null;
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Reject future-dated timestamps (anti-fraud)
    if (paymentTime && paymentTime > now) {
      return res.status(400).json({ error: 'Payment timestamp cannot be in the future' });
    }

    if (paymentTime && paymentTime < fortyEightHoursAgo) {
      // Payment is older than 48 hours — create a ticket and notify user
      const ticket = await Ticket.create({
        user: req.user._id,
        subject: `Old Payment Verification — ₹${parsed} (Txn: ${cleanTxnId})`,
        category: 'Payment',
        priority: 'medium',
        messages: [{
          sender: req.user._id,
          senderName: req.user.name,
          senderRole: 'user',
          content: `I made a payment of ₹${parsed} via ${method || 'Paytm Business QR'} on ${paymentTime.toLocaleString('en-IN')}.\n\nTransaction ID: ${cleanTxnId}\n\nPlease verify and credit my wallet.`,
        }],
      });

      // Save a pending payment record for admin reference
      await Payment.create({
        user: req.user._id,
        amount: parsed,
        method: method || 'paytm_business',
        status: 'pending',
        type: 'topup',
        transactionId: cleanTxnId,
        paymentTimestamp: paymentTime,
        note: `Old payment (>48h) — awaiting admin verification. Ticket: ${ticket.ticketNumber}`,
      });

      // Notify the user
      await Notification.create({
        userId: req.user._id,
        type: 'wallet_topup',
        ticketId: ticket._id,
        data: {
          title: 'Payment Too Old',
          message: `Your payment of ₹${parsed} is older than 48 hours. A support ticket (${ticket.ticketNumber}) has been created. Our team will verify and credit your wallet.`,
        },
      });

      return res.status(202).json({
        oldPayment: true,
        ticketNumber: ticket.ticketNumber,
        ticketId: ticket._id,
        message: `Your payment is older than 48 hours. A ticket (${ticket.ticketNumber}) has been created — our team will verify and credit your wallet shortly.`,
      });
    }

    // ── Normal topup (within 48 hours) ────────────────────────────────────────
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { wallet: parsed } },
      { new: true }
    );

    await Payment.create({
      user: req.user._id,
      amount: parsed,
      method: method || 'paytm_business',
      status: 'completed',
      type: 'topup',
      transactionId: cleanTxnId,
      paymentTimestamp: paymentTime || now,
      note: note || `Wallet top-up of ₹${parsed} via ${method || 'Paytm Business'}`,
    });

    res.json({ balance: user.wallet, message: `₹${parsed} added to wallet successfully` });
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
