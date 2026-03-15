const router = require('express').Router();
const { register, login, getMe } = require('../controllers/authController');
const { authJWT } = require('../middleware/authJWT');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authJWT, getMe);

module.exports = router;
