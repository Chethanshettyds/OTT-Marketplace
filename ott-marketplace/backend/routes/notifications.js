const router = require('express').Router();
const { authJWT } = require('../middleware/authJWT');
const { getCounts, markRead } = require('../controllers/notificationController');

router.get('/counts', authJWT, getCounts);
router.post('/mark-read', authJWT, markRead);

module.exports = router;
