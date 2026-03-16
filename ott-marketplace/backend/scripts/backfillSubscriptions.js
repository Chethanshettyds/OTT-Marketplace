/**
 * Backfill subscriptions for existing orders.
 * Run once: node scripts/backfillSubscriptions.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');

function parseDurationDays(duration = '') {
  const d = duration.toLowerCase();
  const num = parseInt(d) || 1;
  if (d.includes('year')) return num * 365;
  if (d.includes('month')) return num * 30;
  if (d.includes('week')) return num * 7;
  if (d.includes('day')) return num;
  return 30;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Get all non-cancelled, non-refunded orders
  const orders = await Order.find({
    status: { $nin: ['cancelled', 'refunded'] },
  }).sort({ createdAt: 1 });

  console.log(`📦 Found ${orders.length} orders to process`);

  let created = 0;
  let skipped = 0;

  for (const order of orders) {
    const user = await User.findById(order.user);
    if (!user) { skipped++; continue; }

    // Skip if subscription for this order already exists
    const alreadyExists = user.activeSubscriptions.some(
      (s) => s.orderId?.toString() === order._id.toString()
    );
    if (alreadyExists) { skipped++; continue; }

    const duration = order.productSnapshot?.duration || '1 Month';
    const durationDays = parseDurationDays(duration);
    const startDate = order.createdAt || new Date();
    const expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    const status = expiryDate > now ? 'active' : 'expired';

    user.activeSubscriptions.push({
      productId: order.product || null,
      orderId: order._id,
      productName: order.productSnapshot?.name || 'Unknown Product',
      platform: order.productSnapshot?.platform || '',
      duration,
      durationDays,
      startDate,
      expiryDate,
      status,
    });

    await user.save({ validateBeforeSave: false });
    console.log(`  ✅ ${user.name} ← ${order.productSnapshot?.name} (${status}, expires ${expiryDate.toDateString()})`);
    created++;
  }

  console.log(`\n🎉 Done! Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
