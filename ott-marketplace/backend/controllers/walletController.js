const User = require('../models/User');
const Payment = require('../models/Payment');

// ── Balance ──────────────────────────────────────────────────────────────────
exports.getBalance = async (req, res) => {
  res.json({ balance: req.user.wallet });
};

// ── Manual Topup (any amount + transaction ID) ────────────────────────────────
exports.topup = async (req, res) => {
  try {
    const { amount, method, transactionId, note } = req.body;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount greater than 0' });
    }
    if (!transactionId || !transactionId.trim()) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // Check duplicate transaction ID
    const existing = await Payment.findOne({ transactionId: transactionId.trim(), type: 'topup' });
    if (existing) {
      return res.status(409).json({ error: 'This transaction ID has already been used' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { wallet: parsed } },
      { new: true }
    );

    await Payment.create({
      user: req.user._id,
      amount: parsed,
      method: method || 'other',
      status: 'completed',
      type: 'topup',
      transactionId: transactionId.trim(),
      note: note || `Wallet top-up of ₹${parsed} via ${method || 'manual'}`,
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
    const { type, label, upiId, qrCodeUrl, accountDetails, isDefault } = req.body;
    if (!type || !label) return res.status(400).json({ error: 'Type and label are required' });

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    if (isDefault) {
      admin.paymentMethods.forEach((m) => { m.isDefault = false; });
    }

    admin.paymentMethods.push({ type, label, upiId, qrCodeUrl, accountDetails, isDefault: !!isDefault });
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
