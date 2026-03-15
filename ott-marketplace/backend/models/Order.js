const mongoose = require('mongoose');

const paymentDetailsSchema = new mongoose.Schema(
  {
    method: { type: String, default: 'wallet' }, // wallet, stripe, etc.
    transactionId: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productSnapshot: {
      name: String,
      platform: String,
      price: Number,
      duration: String,
      logo: String,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'delivered', 'refunded', 'cancelled'],
      default: 'pending',
    },
    credentials: {
      email: { type: String, default: '' },
      password: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    paymentDetails: { type: paymentDetailsSchema, default: () => ({}) },
    isRefunded: { type: Boolean, default: false },
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'completed'],
      default: 'none',
    },
    orderNumber: { type: String, unique: true },
  },
  { timestamps: true }
);

orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    this.orderNumber =
      'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
