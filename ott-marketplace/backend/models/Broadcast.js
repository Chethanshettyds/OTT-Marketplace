const mongoose = require('mongoose');

const readReceiptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  readAt: { type: Date, default: Date.now },
}, { _id: false });

const broadcastSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminName: { type: String },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['all', 'selected', 'group', 'specific'],
    default: 'all',
  },
  // group target: 'active' | 'inactive' | 'vip'
  group: { type: String, default: null },
  // explicit recipient list (for 'selected' / 'specific')
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // resolved list of all users actually sent to
  sentTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  readBy: [readReceiptSchema],
  template: { type: String, default: null },
  sentAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Broadcast', broadcastSchema);
