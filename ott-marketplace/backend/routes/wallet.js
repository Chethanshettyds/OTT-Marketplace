const router = require('express').Router();
const ctrl = require('../controllers/walletController');
const { authJWT } = require('../middleware/authJWT');
const { isAdmin } = require('../middleware/authJWT');

router.get('/balance', authJWT, ctrl.getBalance);
router.post('/topup', authJWT, ctrl.topup);

// Admin topup approval
router.get('/pending-topups', authJWT, isAdmin, ctrl.getPendingTopups);
router.post('/topup/:paymentId/approve', authJWT, isAdmin, ctrl.approveTopup);
router.post('/topup/:paymentId/reject', authJWT, isAdmin, ctrl.rejectTopup);

// Payment methods — read is public (authenticated), write is admin-only
router.get('/payment-methods', authJWT, ctrl.getPaymentMethods);
router.post('/payment-methods', authJWT, isAdmin, ctrl.addPaymentMethod);
router.delete('/payment-methods/:methodId', authJWT, isAdmin, ctrl.deletePaymentMethod);

// Admin
router.get('/all-payments', authJWT, isAdmin, ctrl.getAllPayments);

module.exports = router;
