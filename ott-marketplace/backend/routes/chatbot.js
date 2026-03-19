const express = require('express');
const router = express.Router();
const { chat, getAnalytics, lookupOrder, createTicketFromChat } = require('../controllers/chatbotController');
const { authJWT } = require('../middleware/authJWT');
const adminGuard = require('../middleware/adminGuard');

// POST /api/chatbot/chat — authenticated users only
router.post('/chat', authJWT, chat);

// POST /api/chatbot/order-status — look up a specific order by number
router.post('/order-status', authJWT, lookupOrder);

// POST /api/chatbot/create-ticket — create a real support ticket from chat
router.post('/create-ticket', authJWT, createTicketFromChat);

// GET /api/chatbot/analytics — admin only
router.get('/analytics', authJWT, adminGuard, getAnalytics);

module.exports = router;
