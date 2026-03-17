const express = require('express');
const router = express.Router();
const { chat, getAnalytics } = require('../controllers/chatbotController');
const { authJWT } = require('../middleware/authJWT');
const adminGuard = require('../middleware/adminGuard');

// POST /api/chatbot/chat — authenticated users only
router.post('/chat', authJWT, chat);

// GET /api/chatbot/analytics — admin only
router.get('/analytics', authJWT, adminGuard, getAnalytics);

module.exports = router;
