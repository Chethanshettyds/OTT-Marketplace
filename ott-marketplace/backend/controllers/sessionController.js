const Session = require('../models/Session');

// GET /api/account/sessions
// Returns all active sessions for the current user + currentSessionId
exports.getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      userId: req.user._id,
      revoked: false,
    }).sort({ lastActiveAt: -1 });

    res.json({
      sessions,
      currentSessionId: req.sessionId, // injected by authJWT middleware
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/account/sessions/revoke  { sessionId }
exports.revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    // Ensure the session belongs to this user
    const session = await Session.findOne({ sessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.revoked = true;
    await session.save();

    res.json({ message: 'Session revoked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/account/sessions/revoke-others
// Revokes every session except the current one
exports.revokeOtherSessions = async (req, res) => {
  try {
    await Session.updateMany(
      { userId: req.user._id, sessionId: { $ne: req.sessionId }, revoked: false },
      { revoked: true }
    );
    res.json({ message: 'All other sessions revoked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
