const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

// Throttle lastActiveAt updates to once per minute per session
const lastActiveCache = new Map(); // sessionId -> timestamp

const authJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // If token carries a sessionId, validate the session is still active
    if (decoded.sessionId) {
      const session = await Session.findOne({ sessionId: decoded.sessionId, userId: user._id });
      if (!session || session.revoked) {
        return res.status(401).json({ error: 'Session has been revoked' });
      }

      // Throttled lastActiveAt update (max once per 60s per session)
      const now = Date.now();
      const last = lastActiveCache.get(decoded.sessionId) || 0;
      if (now - last > 60_000) {
        lastActiveCache.set(decoded.sessionId, now);
        Session.updateOne({ sessionId: decoded.sessionId }, { lastActiveAt: new Date() }).catch(() => {});
      }

      req.sessionId = decoded.sessionId;
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin access required' });
};

module.exports = { authJWT, isAdmin };
