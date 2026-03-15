const router = require('express').Router();
const ctrl = require('../controllers/walletController');
const { authJWT } = require('../middleware/authJWT');
const { isAdmin } = require('../middleware/authJWT');

router.get('/balance', authJWT, ctrl.getBalance);
router.post('/topup', authJWT, ctrl.topup);

// Payment methods — read is public (authenticated), write is admin-only
router.get('/payment-methods', authJWT, ctrl.getPaymentMethods);
router.post('/payment-methods', authJWT, isAdmin, ctrl.addPaymentMethod);
router.delete('/payment-methods/:methodId', authJWT, isAdmin, ctrl.deletePaymentMethod);

// Admin
router.get('/all-payments', authJWT, isAdmin, ctrl.getAllPayments);

module.exports = router;
