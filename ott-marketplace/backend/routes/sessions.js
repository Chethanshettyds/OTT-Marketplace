const router = require('express').Router();
const { authJWT } = require('../middleware/authJWT');
const { getSessions, revokeSession, revokeOtherSessions } = require('../controllers/sessionController');

router.get('/', authJWT, getSessions);
router.post('/revoke', authJWT, revokeSession);
router.post('/revoke-others', authJWT, revokeOtherSessions);

module.exports = router;
