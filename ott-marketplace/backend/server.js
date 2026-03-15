require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const walletRoutes = require('./routes/wallet');
const orderRoutes = require('./routes/orders');
const ticketRoutes = require('./routes/tickets');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const broadcastRoutes = require('./routes/broadcast');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Rate limiting — only apply to auth endpoints to prevent brute force.
// Admin and general API routes are NOT rate-limited to avoid 429 errors.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development', // disable in dev
  message: { error: 'Too many login attempts, please try again in 15 minutes.' },
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes — NO blanket rate limiter on /api/
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/broadcast', broadcastRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// Socket.io for real-time tickets
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join_ticket', ({ ticketId, userId }) => {
    socket.join(`ticket_${ticketId}`);
    connectedUsers.set(socket.id, { userId, ticketId });
  });

  // User joins their personal room for broadcast notifications
  socket.on('join_user', ({ userId }) => {
    if (userId) socket.join(`user_${userId}`);
  });

  socket.on('send_message', (data) => {
    io.to(`ticket_${data.ticketId}`).emit('receive_message', data);
  });

  socket.on('typing', (data) => {
    socket.to(`ticket_${data.ticketId}`).emit('user_typing', data);
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    console.log('Socket disconnected:', socket.id);
  });
});

// Make io accessible in routes
app.set('io', io);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = { app, io };
