const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  type:        { type: String, enum: ['ticket_reply', 'broadcast', 'ticket_user_message'], required: true },
  ticketId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
  broadcastId: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast', default: null },
  isRead:      { type: Boolean, default: false },
  data:        { title: String, message: String },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
