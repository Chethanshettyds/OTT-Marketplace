const router = require('express').Router();
const { authJWT, isAdmin } = require('../middleware/authJWT');
const adminGuard = require('../middleware/adminGuard');
const ctrl = require('../controllers/broadcastController');

// ── Admin routes ──────────────────────────────────────────────────────────────
router.post('/', authJWT, adminGuard, ctrl.broadcastLimiter, ctrl.sendBroadcast);
router.get('/', authJWT, adminGuard, ctrl.listBroadcasts);
router.get('/:id', authJWT, adminGuard, ctrl.getBroadcast);
router.delete('/:id', authJWT, adminGuard, ctrl.deleteBroadcast);

// ── User routes ───────────────────────────────────────────────────────────────
router.get('/my/inbox', authJWT, ctrl.getMyBroadcasts);
router.post('/:id/read', authJWT, ctrl.markRead);

module.exports = router;
