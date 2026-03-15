const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    amount: { type: Number, required: true },
    method: { type: String, default: 'wallet' }, // wallet | paytm | phonepe | gpay | bharatpe | binance | upi | bank | other
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed',
    },
    transactionId: { type: String, default: '' },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
    type: {
      type: String,
      enum: ['topup', 'purchase', 'refund'],
      required: true,
    },
    note: { type: String, default: '' },
    // For manual topup verification
    screenshotUrl: { type: String, default: '' },
    verifiedByAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
