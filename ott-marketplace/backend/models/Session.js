const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userAgent: { type: String, default: '' },
  // Parsed from userAgent: "Chrome on Windows", "Safari on iPhone", etc.
  deviceName: { type: String, default: 'Unknown device' },
  // desktop | mobile | tablet | unknown
  deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'], default: 'unknown' },
  ipAddress:  { type: String, default: '' },
  // Approximate location — populated lazily (city, country or null)
  location:   { type: String, default: null },
  lastActiveAt: { type: Date, default: Date.now },
  revoked:    { type: Boolean, default: false },
}, { timestamps: true });

// Auto-delete sessions inactive for 30 days
sessionSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Session', sessionSchema);
