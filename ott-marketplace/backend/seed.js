require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');

const products = [
  {
    name: 'Netflix Premium 1 Month',
    platform: 'Netflix',
    category: 'Video',
    description: '4K Ultra HD + HDR, 4 screens simultaneously, download on 6 devices',
    price: 5.99,
    originalPrice: 22.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 50,
    color: '#E50914',
    gradientFrom: '#E50914',
    gradientTo: '#B20710',
    isFeatured: true,
    features: ['4K Ultra HD', '4 Screens', 'Download 6 Devices', 'All Content'],
  },
  {
    name: 'Netflix Premium 3 Months',
    platform: 'Netflix',
    category: 'Video',
    description: '4K Ultra HD + HDR, 4 screens, best value bundle',
    price: 14.99,
    originalPrice: 68.97,
    duration: '3 Months',
    durationDays: 90,
    stock: 30,
    color: '#E50914',
    gradientFrom: '#E50914',
    gradientTo: '#831010',
    isFeatured: true,
    features: ['4K Ultra HD', '4 Screens', '3 Month Bundle', 'Save 78%'],
  },
  {
    name: 'Amazon Prime Video 1 Month',
    platform: 'Amazon Prime',
    category: 'Video',
    description: 'Prime Video + Prime Delivery + Prime Music included',
    price: 3.99,
    originalPrice: 14.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 60,
    color: '#00A8E0',
    gradientFrom: '#00A8E0',
    gradientTo: '#FF9900',
    isFeatured: true,
    features: ['Prime Video', 'Prime Music', 'Prime Delivery', 'Exclusive Shows'],
  },
  {
    name: 'YouTube Premium 1 Month',
    platform: 'YouTube Premium',
    category: 'Video',
    description: 'Ad-free YouTube + YouTube Music + Background play',
    price: 4.49,
    originalPrice: 13.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 80,
    color: '#FF0000',
    gradientFrom: '#FF0000',
    gradientTo: '#CC0000',
    isFeatured: false,
    features: ['Ad-Free', 'Background Play', 'YouTube Music', 'Offline Downloads'],
  },
  {
    name: 'Disney+ 1 Month',
    platform: 'Disney+',
    category: 'Video',
    description: 'Disney, Marvel, Star Wars, Pixar, National Geographic',
    price: 4.99,
    originalPrice: 13.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 45,
    color: '#113CCF',
    gradientFrom: '#113CCF',
    gradientTo: '#0A1F8F',
    isFeatured: true,
    features: ['4K Ultra HD', 'Marvel & Star Wars', 'Disney Classics', '4 Screens'],
  },
  {
    name: 'Spotify Premium 1 Month',
    platform: 'Spotify',
    category: 'Music',
    description: 'Ad-free music, offline listening, unlimited skips',
    price: 2.99,
    originalPrice: 9.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 100,
    color: '#1DB954',
    gradientFrom: '#1DB954',
    gradientTo: '#158A3E',
    isFeatured: true,
    features: ['Ad-Free', 'Offline Mode', 'Unlimited Skips', 'High Quality Audio'],
  },
  {
    name: 'Spotify Premium 3 Months',
    platform: 'Spotify',
    category: 'Music',
    description: 'Best value Spotify bundle - 3 months ad-free',
    price: 7.99,
    originalPrice: 29.97,
    duration: '3 Months',
    durationDays: 90,
    stock: 60,
    color: '#1DB954',
    gradientFrom: '#1DB954',
    gradientTo: '#0D5C2E',
    isFeatured: false,
    features: ['Ad-Free', 'Offline Mode', '3 Month Bundle', 'Save 73%'],
  },
  {
    name: 'Apple TV+ 1 Month',
    platform: 'Apple TV+',
    category: 'Video',
    description: 'Award-winning Apple Originals in 4K HDR',
    price: 3.49,
    originalPrice: 9.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 40,
    color: '#555555',
    gradientFrom: '#555555',
    gradientTo: '#000000',
    isFeatured: false,
    features: ['4K HDR', 'Apple Originals', 'Dolby Atmos', 'Family Sharing'],
  },
  {
    name: 'HBO Max 1 Month',
    platform: 'HBO Max',
    category: 'Video',
    description: 'HBO Originals, Warner Bros movies, DC Universe',
    price: 5.49,
    originalPrice: 15.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 35,
    color: '#5822B4',
    gradientFrom: '#5822B4',
    gradientTo: '#3D1580',
    isFeatured: false,
    features: ['HBO Originals', 'DC Universe', '4K Streaming', 'Same-Day Releases'],
  },
  {
    name: 'Crunchyroll Premium 1 Month',
    platform: 'Crunchyroll',
    category: 'Video',
    description: 'Unlimited anime streaming, simulcasts, no ads',
    price: 2.49,
    originalPrice: 7.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 70,
    color: '#F47521',
    gradientFrom: '#F47521',
    gradientTo: '#C45A10',
    isFeatured: false,
    features: ['Unlimited Anime', 'Simulcasts', 'Ad-Free', 'Offline Downloads'],
  },
  {
    name: 'Hulu No Ads 1 Month',
    platform: 'Hulu',
    category: 'Video',
    description: 'Hulu No Ads plan - full library access',
    price: 4.99,
    originalPrice: 17.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 25,
    color: '#1CE783',
    gradientFrom: '#1CE783',
    gradientTo: '#0FA85E',
    isFeatured: false,
    features: ['No Ads', 'Full Library', 'Live TV Add-on', 'Offline Downloads'],
  },
  {
    name: 'Paramount+ 1 Month',
    platform: 'Paramount+',
    category: 'Video',
    description: 'CBS, MTV, Nickelodeon, BET, Comedy Central',
    price: 2.99,
    originalPrice: 9.99,
    duration: '1 Month',
    durationDays: 30,
    stock: 50,
    color: '#0064FF',
    gradientFrom: '#0064FF',
    gradientTo: '#0040CC',
    isFeatured: false,
    features: ['CBS Live', 'Paramount Movies', 'Nickelodeon', 'Sports'],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});

    // Create admin
    const adminPassword = await bcrypt.hash('admin123', 12);
    await User.create({
      name: 'Admin',
      email: 'admin@site.com',
      password: adminPassword,
      role: 'admin',
      wallet: 9999,
    });

    // Create test user
    const userPassword = await bcrypt.hash('user123', 12);
    await User.create({
      name: 'John Doe',
      email: 'user@site.com',
      password: userPassword,
      role: 'user',
      wallet: 50,
    });

    // Create products
    await Product.insertMany(products);

    console.log('✅ Seed complete!');
    console.log('Admin: admin@site.com / admin123');
    console.log('User:  user@site.com / user123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
