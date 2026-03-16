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
const notificationRoutes = require('./routes/notifications');

// Init mailer (logs ✅ or ❌ on startup)
require('./utils/mailer');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, '')); // strip trailing slashes

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / curl
    const clean = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(clean)) return cb(null, true);
    // In development allow any localhost
    if (process.env.NODE_ENV !== 'production' && clean.startsWith('http://localhost')) return cb(null, true);
    console.warn(`CORS blocked: ${origin}`);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
};

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
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

app.use(cors(corsOptions));
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
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// ── Online user tracking (in-memory) ─────────────────────────────────────────
// Map<socketId, { userId, name, email, page, lastSeen }>
const onlineUsers = new Map();

function getOnlineList() {
  const now = Date.now();
  return Array.from(onlineUsers.values()).map((u) => {
    const diffMs = now - new Date(u.lastSeen).getTime();
    const diffMin = diffMs / 60000;
    const status = diffMin < 5 ? 'active' : diffMin < 15 ? 'idle' : 'offline';
    return { ...u, status, lastSeenMs: diffMs };
  });
}

function broadcastOnlineUsers() {
  io.to('admin_room').emit('online_users_update', {
    users: getOnlineList(),
    count: onlineUsers.size,
  });
}
// ─────────────────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  socket.on('join_ticket', ({ ticketId, userId }) => {
    socket.join(`ticket_${ticketId}`);
  });

  socket.on('join_user', ({ userId }) => {
    if (userId) socket.join(`user_${userId}`);
  });

  socket.on('join_admin', () => {
    socket.join('admin_room');
    // Send current snapshot immediately
    socket.emit('online_users_update', {
      users: getOnlineList(),
      count: onlineUsers.size,
    });
  });

  // User identifies themselves on connect
  socket.on('user_connect', ({ userId, name, email, page }) => {
    if (!userId) return;
    onlineUsers.set(socket.id, { userId, name, email, page: page || '/', lastSeen: new Date() });
    broadcastOnlineUsers();
  });

  // Heartbeat — keeps user alive and updates current page
  socket.on('heartbeat', ({ userId, page }) => {
    if (!userId) return;
    const existing = onlineUsers.get(socket.id);
    if (existing) {
      existing.page = page || existing.page;
      existing.lastSeen = new Date();
    } else {
      onlineUsers.set(socket.id, { userId, page: page || '/', lastSeen: new Date() });
    }
    broadcastOnlineUsers();
  });

  socket.on('send_message', (data) => {
    io.to(`ticket_${data.ticketId}`).emit('receive_message', data);
  });

  socket.on('typing', (data) => {
    socket.to(`ticket_${data.ticketId}`).emit('user_typing', data);
  });

  socket.on('disconnect', () => {
    if (onlineUsers.has(socket.id)) {
      onlineUsers.delete(socket.id);
      broadcastOnlineUsers();
    }
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
