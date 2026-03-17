const router = require('express').Router();
const { register, login, getMe, googleAuth } = require('../controllers/authController');
const { authJWT } = require('../middleware/authJWT');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', authJWT, getMe);

module.exports = router;
