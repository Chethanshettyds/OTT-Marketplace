const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const activeSubscriptionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    productName: { type: String, required: true },
    platform: { type: String, default: '' },
    duration: { type: String, default: '1 Month' },
    durationDays: { type: Number, default: 30 },
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  },
  { _id: true, timestamps: true }
);

const paymentMethodSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['paytm', 'phonepe', 'gpay', 'bharatpe', 'binance', 'upi', 'bank', 'other'],
      required: true,
    },
    label: { type: String, required: true }, // display name e.g. "My Paytm"
    upiId: { type: String, default: '' },
    merchantId: { type: String, default: '' }, // Paytm merchant ID
    qrCodeUrl: { type: String, default: '' },
    accountDetails: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    wallet: { type: Number, default: 0, min: 0 },
    avatar: { type: String, default: '' },
    googleId: { type: String, default: '' },
    welcomeEmailSent: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    passwordChangedAt: { type: Date },
    paymentMethods: [paymentMethodSchema],
    activeSubscriptions: [activeSubscriptionSchema],
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
