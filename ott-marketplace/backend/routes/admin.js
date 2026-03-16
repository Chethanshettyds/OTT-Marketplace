const router = require('express').Router();
const { authJWT } = require('../middleware/authJWT');
const adminGuard = require('../middleware/adminGuard');
const ctrl = require('../controllers/adminController');

// All admin routes require JWT + email-based admin guard
router.use(authJWT, adminGuard);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/dashboard', ctrl.getDashboard);

// ── Products ───────────────────────────────────────────────────────────────
router.get('/products', ctrl.listProducts);
router.post('/products', ctrl.productValidators, ctrl.createProduct);
router.put('/products/:id', ctrl.updateProduct);
router.delete('/products/:id', ctrl.deleteProduct);

// ── Users ──────────────────────────────────────────────────────────────────
router.get('/users', ctrl.listUsers);
router.get('/users/:id', ctrl.getUser);
router.put('/users/:id/toggle', ctrl.toggleUserActive);
router.delete('/users/:id', ctrl.deleteUser);
router.post('/users/:userId/fund', ctrl.fundUserWallet);

// ── Orders ─────────────────────────────────────────────────────────────────
router.get('/orders', ctrl.listOrders);
router.put('/orders/:id/status', ctrl.updateOrderStatus);

// ── Payments ───────────────────────────────────────────────────────────────
router.get('/payments', ctrl.listPayments);

module.exports = router;
