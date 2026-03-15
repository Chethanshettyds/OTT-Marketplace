const router = require('express').Router();
const User = require('../models/User');
const { authJWT } = require('../middleware/authJWT');

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
