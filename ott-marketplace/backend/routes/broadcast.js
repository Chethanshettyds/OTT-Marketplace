const router = require('express').Router();
const { authJWT } = require('../middleware/authJWT');
const adminGuard = require('../middleware/adminGuard');
const ctrl = require('../controllers/broadcastController');

// ── User routes (must be before /:id to avoid param collision) ────────────────
router.get('/my/inbox', authJWT, ctrl.getMyBroadcasts);
router.post('/:id/read', authJWT, ctrl.markRead);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.post('/', authJWT, adminGuard, ctrl.broadcastLimiter, ctrl.sendBroadcast);
router.get('/', authJWT, adminGuard, ctrl.listBroadcasts);
router.get('/:id', authJWT, adminGuard, ctrl.getBroadcast);
router.delete('/:id', authJWT, adminGuard, ctrl.deleteBroadcast);

module.exports = router;
