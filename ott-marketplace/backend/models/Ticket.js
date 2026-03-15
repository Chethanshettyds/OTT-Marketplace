const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  filename: { type: String },
  mimetype: { type: String },
  size: { type: Number },
  data: { type: String }, // base64
}, { _id: false });

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String },
  senderRole: { type: String, enum: ['user', 'admin'] },
  content: { type: String, required: true },
  attachments: { type: [attachmentSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const ticketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Order Issue', 'Payment', 'Account', 'Technical', 'Other'],
      default: 'Other',
    },
    status: { type: String, enum: ['open', 'in-progress', 'closed'], default: 'open' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    messages: [messageSchema],
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    ticketNumber: { type: String, unique: true },
  },
  { timestamps: true }
);

ticketSchema.pre('save', function (next) {
  if (!this.ticketNumber) {
    this.ticketNumber = 'TKT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
