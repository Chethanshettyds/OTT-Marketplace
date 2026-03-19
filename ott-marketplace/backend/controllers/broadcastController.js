const Broadcast = require('../models/Broadcast');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Order = require('../models/Order');
const rateLimit = require('express-rate-limit');

// ── POST /api/broadcast/generate (admin only) ─────────────────────────────────
exports.generateBroadcast = async (req, res) => {
  const { broadcastType, hint } = req.body;

  if (!hint || !hint.trim()) {
    return res.status(400).json({ error: 'A short hint or topic is required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI generation is not configured. Add GEMINI_API_KEY to your environment.' });
  }

  const typeDescriptions = {
    promo:       'a promotional offer or discount announcement',
    maintenance: 'a scheduled maintenance or downtime notice',
    update:      'a new feature or product update announcement',
    alert:       'an important account or security alert',
    general:     'a general informational message',
  };

  const typeDesc = typeDescriptions[broadcastType] || typeDescriptions.general;

  const prompt = `You are a professional marketing copywriter for OTHub, a premium OTT subscription marketplace where users buy Netflix, Spotify, Amazon Prime, and other streaming subscriptions at discounted prices.

Write a broadcast notification for the admin to send to users. The tone should be warm, engaging, and professional — not spammy.

Rules:
- Subject: max 60 characters, punchy and clear
- Message: 2–4 sentences, friendly tone, ends with a clear call to action
- Do NOT use placeholder text like [DATE] or [NAME]
- Do NOT use markdown formatting in the message
- Return ONLY valid JSON in this exact format: {"subject":"...","message":"..."}

Broadcast type: ${typeDesc}
Topic/hint from admin: "${hint.trim()}"

Write the subject and message for this broadcast.`;

  // Use Gemini if key starts with AI... pattern, otherwise fall back to OpenAI
  const useGemini = process.env.GEMINI_API_KEY && apiKey === process.env.GEMINI_API_KEY;

  try {
    let subject, message;

    if (useGemini) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 300,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error?.message || `Gemini returned ${response.status}`);
      }

      const data = await response.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw);
      subject = parsed.subject;
      message = parsed.message;
    } else {
      // OpenAI fallback
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.75,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error?.message || `OpenAI returned ${response.status}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      subject = parsed.subject;
      message = parsed.message;
    }

    if (!subject || !message) {
      throw new Error('AI response was incomplete. Please try again.');
    }

    return res.json({ subject: subject.trim(), message: message.trim() });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'AI generation failed. Please try again.' });
  }
};

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

    // Create Notification records for each recipient
    const notifDocs = sentTo.map((userId) => ({
      userId,
      type: 'broadcast',
      broadcastId: broadcast._id,
      data: { title: broadcast.subject, message: broadcast.message.slice(0, 100) },
    }));
    await Notification.insertMany(notifDocs);

    // Emit notification_update to each user's socket room
    sentTo.forEach((userId) => {
      io.to(`user_${userId}`).emit('notification_update', { broadcasts: 1 });
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
