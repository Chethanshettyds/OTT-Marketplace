const router = require('express').Router();
const User = require('../models/User');
const { authJWT } = require('../middleware/authJWT');

// GET active subscriptions
router.get('/subscriptions/active', authJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const now = new Date();
    // Auto-expire any that have passed
    let changed = false;
    user.activeSubscriptions.forEach((sub) => {
      if (sub.status === 'active' && new Date(sub.expiryDate) <= now) {
        sub.status = 'expired';
        changed = true;
      }
    });
    if (changed) await user.save({ validateBeforeSave: false });

    const activeSubs = user.activeSubscriptions.filter((s) => s.status === 'active');
    const expiredSubs = user.activeSubscriptions.filter((s) => s.status === 'expired');
    const cancelledSubs = user.activeSubscriptions.filter((s) => s.status === 'cancelled');
    res.json({ count: activeSubs.length, subscriptions: [...activeSubs, ...expiredSubs, ...cancelledSubs] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH cancel a subscription
router.patch('/subscriptions/:subId/cancel', authJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const sub = user.activeSubscriptions.id(req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    sub.status = 'cancelled';
    await user.save({ validateBeforeSave: false });
    res.json({ message: 'Subscription cancelled', subscription: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', authJWT, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, avatar },
      { new: true, runValidators: true }
    );
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
