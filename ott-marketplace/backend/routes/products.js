const router = require('express').Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct, updateStock, joinWaitlist } = require('../controllers/productController');
const { authJWT, isAdmin } = require('../middleware/authJWT');

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', authJWT, isAdmin, createProduct);
router.put('/:id', authJWT, isAdmin, updateProduct);
router.patch('/:id/stock', authJWT, isAdmin, updateStock);
router.delete('/:id', authJWT, isAdmin, deleteProduct);
router.post('/:id/waitlist', authJWT, joinWaitlist);

module.exports = router;
