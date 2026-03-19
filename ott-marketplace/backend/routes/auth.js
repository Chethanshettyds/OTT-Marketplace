const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const {
  register, login, getMe, googleAuth,
  forgotPassword, validateResetToken, resetPassword, changePassword,
} = require('../controllers/authController');
const { authJWT } = require('../middleware/authJWT');

// Rate limit forgot-password: max 5 per 15 min per IP
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', authJWT, getMe);

router.post('/forgot-password', forgotLimiter, forgotPassword);
router.post('/validate-reset-token', validateResetToken);
router.post('/reset-password', resetPassword);
router.post('/change-password', authJWT, changePassword);

module.exports = router;
