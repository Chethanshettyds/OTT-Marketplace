const mongoose = require('mongoose');

// Stores hashed reset tokens — raw token is only ever in the email link
const passwordResetTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
}, { timestamps: true });

// Auto-delete expired tokens after 2 hours
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7200 });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
