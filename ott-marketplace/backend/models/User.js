const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const paymentMethodSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['paytm', 'phonepe', 'gpay', 'bharatpe', 'binance', 'upi', 'bank', 'other'],
      required: true,
    },
    label: { type: String, required: true }, // display name e.g. "My Paytm"
    upiId: { type: String, default: '' },
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
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    wallet: { type: Number, default: 0, min: 0 },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    paymentMethods: [paymentMethodSchema],
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
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
