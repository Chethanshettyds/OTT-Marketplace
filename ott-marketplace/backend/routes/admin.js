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
router.put('/users/:id', ctrl.editUser);
router.put('/users/:id/toggle', ctrl.toggleUserActive);
router.delete('/users/:id', ctrl.deleteUser);
router.post('/users/:userId/fund', ctrl.fundUserWallet);
router.post('/users/:id/reset-password', ctrl.resetUserPassword);
router.get('/users/:id/signin-history', ctrl.getUserSigninHistory);
router.get('/users/:id/payments', ctrl.getUserPayments);
router.post('/users/:id/payments', ctrl.addUserPayment);
router.put('/users/:id/payments/:paymentId', ctrl.updateUserPayment);
router.delete('/users/:id/payments/:paymentId', ctrl.deleteUserPayment);

// ── Orders ─────────────────────────────────────────────────────────────────
router.get('/orders', ctrl.listOrders);
router.put('/orders/:id/status', ctrl.updateOrderStatus);

// ── Payments ───────────────────────────────────────────────────────────────
router.get('/payments', ctrl.listPayments);

// ── Reports ────────────────────────────────────────────────────────────────
router.get('/reports/payments', ctrl.reportPayments);
router.get('/reports/orders',   ctrl.reportOrders);
router.get('/reports/tickets',  ctrl.reportTickets);

module.exports = router;
