const Notification = require('../models/Notification');

// GET /api/notifications/counts
exports.getCounts = async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    if (isAdmin) {
      // Admin sees unread user messages across all tickets
      const tickets = await Notification.countDocuments({ type: 'ticket_user_message', isRead: false });
      return res.json({ support: tickets, broadcasts: 0 });
    }

    const support = await Notification.countDocuments({ userId, type: 'ticket_reply', isRead: false });
    const broadcasts = await Notification.countDocuments({ userId, type: 'broadcast', isRead: false });
    res.json({ support, broadcasts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/notifications/mark-read  body: { type: 'support'|'broadcasts', ticketId? }
exports.markRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';
    const { type, ticketId } = req.body;

    if (isAdmin) {
      // Admin marks a specific ticket's user messages as read
      if (ticketId) {
        await Notification.updateMany({ type: 'ticket_user_message', ticketId, isRead: false }, { isRead: true });
      } else if (type === 'support') {
        await Notification.updateMany({ type: 'ticket_user_message', isRead: false }, { isRead: true });
      }
    } else {
      if (type === 'support') {
        await Notification.updateMany({ userId, type: 'ticket_reply', isRead: false }, { isRead: true });
      } else if (type === 'broadcasts') {
        await Notification.updateMany({ userId, type: 'broadcast', isRead: false }, { isRead: true });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
