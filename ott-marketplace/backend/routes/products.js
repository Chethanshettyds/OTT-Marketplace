const router = require('express').Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { authJWT, isAdmin } = require('../middleware/authJWT');

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', authJWT, isAdmin, createProduct);
router.put('/:id', authJWT, isAdmin, updateProduct);
router.delete('/:id', authJWT, isAdmin, deleteProduct);

module.exports = router;
