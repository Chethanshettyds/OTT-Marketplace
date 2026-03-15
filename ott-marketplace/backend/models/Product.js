const mongoose = require('mongoose');

const PLATFORMS = [
  'Netflix', 'Amazon Prime', 'YouTube Premium', 'Disney+', 'Spotify',
  'Apple TV+', 'HBO Max', 'Hulu', 'Crunchyroll', 'Paramount+',
];

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    platform: { type: String, required: true, enum: PLATFORMS },
    category: { type: String, enum: ['Video', 'Music', 'Gaming', 'Bundle'], default: 'Video' },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, required: true },
    duration: { type: String, required: true },
    // durationDays is optional — defaults to 30 so admin form doesn't need to send it
    durationDays: { type: Number, default: 30 },
    stock: { type: Number, default: 100, min: 0 },
    waitlist: [{ type: String }], // user emails for out-of-stock notifications
    imageUrl: { type: String, default: '' },
    logo: { type: String, default: '' },
    color: { type: String, default: '#6366f1' },
    gradientFrom: { type: String, default: '#6366f1' },
    gradientTo: { type: String, default: '#8b5cf6' },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    features: [{ type: String }],
    deliveryMethod: { type: String, default: 'Account credentials via email' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Soft-delete: exclude deleted products by default on all find queries.
// Admin bypasses this by explicitly passing { deletedAt: { $exists: true } } or using Model directly.
productSchema.pre(/^find/, function (next) {
  if (this.getFilter().deletedAt === undefined) {
    this.where({ deletedAt: null });
  }
  next();
});

// Virtual: auto-compute stockStatus from stock qty
productSchema.virtual('stockStatus').get(function () {
  if (this.stock === 0) return 'out_of_stock';
  if (this.stock <= 5) return 'low_stock';
  return 'in_stock';
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
