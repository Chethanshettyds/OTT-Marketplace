const mongoose = require('mongoose');

const PLATFORMS = [
  'Netflix', 'Amazon Prime', 'YouTube Premium', 'Disney+', 'Spotify',
  'Apple TV+', 'HBO Max', 'Hulu', 'Crunchyroll', 'Paramount+',
];

// Auto-theme presets — applied on create/update if gradients not manually set
const PLATFORM_THEMES = {
  'netflix':          { gradientFrom: '#E50914', gradientTo: '#B20710', priceColor: 'text-red-400' },
  'amazon prime':     { gradientFrom: '#FF9900', gradientTo: '#e05c00', priceColor: 'text-blue-400' },
  'youtube premium':  { gradientFrom: '#FF0000', gradientTo: '#FF6B00', priceColor: 'text-orange-400' },
  'disney+':          { gradientFrom: '#113CCF', gradientTo: '#0A1F8F', priceColor: 'text-blue-300' },
  'spotify':          { gradientFrom: '#1DB954', gradientTo: '#158A3E', priceColor: 'text-green-400' },
  'apple tv+':        { gradientFrom: '#555555', gradientTo: '#000000', priceColor: 'text-gray-300' },
  'hbo max':          { gradientFrom: '#5822B4', gradientTo: '#3D1580', priceColor: 'text-purple-400' },
  'hulu':             { gradientFrom: '#1CE783', gradientTo: '#0FA85E', priceColor: 'text-emerald-400' },
  'crunchyroll':      { gradientFrom: '#F47521', gradientTo: '#C45A10', priceColor: 'text-orange-400' },
  'paramount+':       { gradientFrom: '#0064FF', gradientTo: '#0040CC', priceColor: 'text-blue-400' },
};

// Default services per platform
const PLATFORM_SERVICES = {
  'amazon prime':    ['Prime Video', 'Prime Music'],
  'youtube premium': ['Premium Videos', 'YouTube Music'],
  'spotify':         ['Ad-Free Music', 'Offline Mode'],
  'netflix':         ['4K Streaming', 'Multiple Screens'],
  'disney+':         ['Disney Originals', 'Marvel & Star Wars'],
  'hulu':            ['No Ads', 'Full Library'],
  'crunchyroll':     ['Unlimited Anime', 'Simulcasts'],
  'hbo max':         ['HBO Originals', 'DC Universe'],
  'apple tv+':       ['Apple Originals', 'Dolby Atmos'],
  'paramount+':      ['CBS Live', 'Paramount Movies'],
};

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    platform: { type: String, required: true, enum: PLATFORMS },
    category: { type: String, enum: ['Video', 'Music', 'Gaming', 'Bundle'], default: 'Video' },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, required: true },
    duration: { type: String, required: true },
    durationDays: { type: Number, default: 30 },
    stock: { type: Number, default: 100, min: 0 },
    waitlist: [{ type: String }],
    imageUrl: { type: String, default: '' },
    logo: { type: String, default: '' },
    color: { type: String, default: '#6366f1' },
    gradientFrom: { type: String, default: '#6366f1' },
    gradientTo: { type: String, default: '#8b5cf6' },
    priceColor: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isHot: { type: Boolean, default: false },
    isLimited: { type: Boolean, default: false },
    services: [{ type: String }],
    features: [{ type: String }],
    deliveryMethod: { type: String, default: 'Account credentials via email' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.pre(/^find/, function (next) {
  if (this.getFilter().deletedAt === undefined) {
    this.where({ deletedAt: null });
  }
  next();
});

// Strip alpha from 8-digit hex colors before saving (#RRGGBBAA → #RRGGBB)
function stripAlpha(hex) {
  if (typeof hex === 'string' && hex.startsWith('#') && hex.length === 9) return hex.slice(0, 7);
  return hex;
}
productSchema.pre('save', function (next) {
  if (this.gradientFrom) this.gradientFrom = stripAlpha(this.gradientFrom);
  if (this.gradientTo) this.gradientTo = stripAlpha(this.gradientTo);
  if (this.color) this.color = stripAlpha(this.color);
  next();
});
productSchema.pre('findOneAndUpdate', function (next) {
  const u = this.getUpdate();
  if (u?.$set?.gradientFrom) u.$set.gradientFrom = stripAlpha(u.$set.gradientFrom);
  if (u?.$set?.gradientTo) u.$set.gradientTo = stripAlpha(u.$set.gradientTo);
  if (u?.gradientFrom) u.gradientFrom = stripAlpha(u.gradientFrom);
  if (u?.gradientTo) u.gradientTo = stripAlpha(u.gradientTo);
  next();
});

productSchema.virtual('stockStatus').get(function () {
  if (this.stock === 0) return 'out_of_stock';
  if (this.stock <= 5) return 'low_stock';
  return 'in_stock';
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
module.exports.PLATFORM_THEMES = PLATFORM_THEMES;
module.exports.PLATFORM_SERVICES = PLATFORM_SERVICES;
