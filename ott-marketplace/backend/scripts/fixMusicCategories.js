/**
 * One-time script: fix products whose category defaulted to 'Video'
 * but belong to music platforms (Spotify, Apple Music, etc.)
 *
 * Run: node scripts/fixMusicCategories.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const MUSIC_PLATFORMS = ['Spotify', 'Apple Music', 'YouTube Music'];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await Product.updateMany(
    { platform: { $in: MUSIC_PLATFORMS }, category: 'Video', deletedAt: null },
    { $set: { category: 'Music' } }
  );

  console.log(`Updated ${result.modifiedCount} product(s) to category "Music"`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
