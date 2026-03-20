const express = require('express');
const router = express.Router();
const { chat, getAnalytics, getDailyAnalytics, lookupOrder, createTicketFromChat } = require('../controllers/chatbotController');
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

// GET /api/chatbot/analytics/daily — admin only
router.get('/analytics/daily', authJWT, adminGuard, getDailyAnalytics);

module.exports = router;
