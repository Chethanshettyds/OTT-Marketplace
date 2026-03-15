const router = require('express').Router();
const { createOrder, getMyOrders, getAllOrders, updateOrderStatus } = require('../controllers/orderController');
const { authJWT, isAdmin } = require('../middleware/authJWT');

router.post('/', authJWT, createOrder);
router.get('/my', authJWT, getMyOrders);
router.get('/', authJWT, isAdmin, getAllOrders);
router.put('/:id', authJWT, isAdmin, updateOrderStatus);

module.exports = router;
