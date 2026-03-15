const router = require('express').Router();
const {
  createTicket, getMyTickets, getTicket, replyTicket, getAllTickets, updateTicketStatus, deleteTicket,
} = require('../controllers/ticketController');
const { authJWT, isAdmin } = require('../middleware/authJWT');

router.post('/', authJWT, createTicket);
router.get('/my', authJWT, getMyTickets);
router.get('/all', authJWT, isAdmin, getAllTickets);
router.get('/:id', authJWT, getTicket);
router.post('/:id/reply', authJWT, replyTicket);
router.put('/:id/status', authJWT, isAdmin, updateTicketStatus);
router.delete('/:id', authJWT, isAdmin, deleteTicket);

module.exports = router;
