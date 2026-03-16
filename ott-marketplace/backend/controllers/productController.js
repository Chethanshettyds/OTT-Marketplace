const Product = require('../models/Product');
const { sendMail, backInStockMail } = require('../utils/mailer');

exports.getProducts = async (req, res) => {
  try {
    const { category, platform, minPrice, maxPrice, search, featured } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (platform) filter.platform = platform;
    if (featured === 'true') filter.isFeatured = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) filter.name = { $regex: search, $options: 'i' };

    const products = await Product.find(filter).sort({ isFeatured: -1, createdAt: -1 });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/products/:id/stock  (admin only)
exports.updateStock = async (req, res) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) return res.status(400).json({ error: 'Valid stock quantity required' });

    // Fetch before update so we know the previous stock
    const before = await Product.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Product not found' });

    const wasOutOfStock = before.stock === 0;
    const newStock = Number(stock);

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock: newStock },
      { new: true, runValidators: true }
    );

    res.json({ product });

    // If stock went from 0 → positive AND there's a waitlist, notify everyone
    if (wasOutOfStock && newStock > 0 && product.waitlist && product.waitlist.length > 0) {
      const shopUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/shop`;
      const mailData = backInStockMail({
        productName: product.name,
        platform: product.platform,
        price: product.price,
        duration: product.duration,
        shopUrl,
      });

      // Fire all emails in parallel, non-blocking
      Promise.allSettled(
        product.waitlist.map((email) => sendMail({ to: email, ...mailData }))
      ).then((results) => {
        const sent = results.filter((r) => r.status === 'fulfilled').length;
        console.log(`📧 Back-in-stock: notified ${sent}/${product.waitlist.length} waitlist emails for "${product.name}"`);
      });

      // Clear the waitlist after notifying
      Product.findByIdAndUpdate(product._id, { $set: { waitlist: [] } }).catch(() => {});
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// POST /api/products/:id/waitlist  (authenticated user)
exports.joinWaitlist = async (req, res) => {
  try {
    const { email } = req.body;
    const userEmail = email || req.user?.email;
    if (!userEmail) return res.status(400).json({ error: 'Email required' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock > 0) return res.status(400).json({ error: 'Product is in stock' });

    if (!product.waitlist.includes(userEmail)) {
      product.waitlist.push(userEmail);
      await product.save();
    }
    res.json({ message: 'Added to waitlist', position: product.waitlist.indexOf(userEmail) + 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
