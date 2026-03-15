const Broadcast = require('../models/Broadcast');
const User = require('../models/User');
const Order = require('../models/Order');
const rateLimit = require('express-rate-limit');

// ── Rate limit: max 5 broadcasts per hour per admin ──────────────────────────
exports.broadcastLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { error: 'Broadcast limit reached. Max 5 per hour.' },
  skip: () => process.env.NODE_ENV === 'development',
});

// ── Resolve recipients from type ─────────────────────────────────────────────
async function resolveRecipients(type, group, recipients) {
  if (type === 'all') {
    const users = await User.find({ role: 'user', isActive: true }).select('_id').lean();
    return users.map((u) => u._id);
  }
  if (type === 'selected' || type === 'specific') {
    return recipients || [];
  }
  if (type === 'group') {
    if (group === 'inactive') {
      const users = await User.find({ role: 'user', isActive: false }).select('_id').lean();
      return users.map((u) => u._id);
    }
    if (group === 'vip') {
      // VIP = users with totalSpent > 100
      const agg = await Order.aggregate([
        { $group: { _id: '$user', spent: { $sum: '$amount' } } },
        { $match: { spent: { $gt: 100 } } },
      ]);
      return agg.map((a) => a._id);
    }
    // default: all active
    const users = await User.find({ role: 'user', isActive: true }).select('_id').lean();
    return users.map((u) => u._id);
  }
  return [];
}

// ── POST /api/admin/broadcast ─────────────────────────────────────────────────
exports.sendBroadcast = async (req, res) => {
  try {
    const { type, group, recipients, subject, message, template } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const sentTo = await resolveRecipients(type || 'all', group, recipients);
    if (!sentTo.length) {
      return res.status(400).json({ error: 'No recipients found for this broadcast' });
    }

    const broadcast = await Broadcast.create({
      admin: req.user._id,
      adminName: req.user.name,
      subject,
      message,
      type: type || 'all',
      group: group || null,
      recipients: recipients || [],
      sentTo,
      template: template || null,
    });

    // Push real-time notification via socket to each recipient
    const io = req.app.get('io');
    sentTo.forEach((userId) => {
      io.to(`user_${userId}`).emit('broadcast', {
        _id: broadcast._id,
        subject: broadcast.subject,
        message: broadcast.message,
        adminName: broadcast.adminName,
        sentAt: broadcast.sentAt,
      });
    });

    res.status(201).json({
      broadcast,
      sentCount: sentTo.length,
      message: `Broadcast sent to ${sentTo.length} user${sentTo.length !== 1 ? 's' : ''}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/admin/broadcast ──────────────────────────────────────────────────
exports.listBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .sort({ createdAt: -1 })
      .select('-sentTo -recipients -readBy')
      .lean();

    // attach read count
    const withStats = await Promise.all(
      broadcasts.map(async (b) => {
        const full = await Broadcast.findById(b._id).select('sentTo readBy').lean();
        return {
          ...b,
          sentCount: full.sentTo.length,
          readCount: full.readBy.length,
        };
      })
    );

    res.json({ broadcasts: withStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/admin/broadcast/:id ──────────────────────────────────────────────
exports.getBroadcast = async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id)
      .populate('sentTo', 'name email')
      .populate('readBy.user', 'name email')
      .lean();
    if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
    res.json({ broadcast });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/admin/broadcast/:id ──────────────────────────────────────────
exports.deleteBroadcast = async (req, res) => {
  try {
    await Broadcast.findByIdAndDelete(req.params.id);
    res.json({ message: 'Broadcast deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/broadcast/my  (user side) ───────────────────────────────────────
exports.getMyBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find({ sentTo: req.user._id })
      .sort({ createdAt: -1 })
      .select('subject message adminName sentAt readBy template')
      .lean();

    const userId = req.user._id.toString();
    const result = broadcasts.map((b) => ({
      ...b,
      isRead: b.readBy.some((r) => r.user?.toString() === userId),
    }));

    res.json({ broadcasts: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/broadcast/:id/read  (user marks as read) ───────────────────────
exports.markRead = async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) return res.status(404).json({ error: 'Not found' });

    const alreadyRead = broadcast.readBy.some(
      (r) => r.user?.toString() === req.user._id.toString()
    );
    if (!alreadyRead) {
      broadcast.readBy.push({ user: req.user._id });
      await broadcast.save();
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
