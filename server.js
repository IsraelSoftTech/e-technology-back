const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();

app.use(cors());
// Increase body size limit to handle base64-encoded uploads (certificates)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static serving for uploaded materials
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const routes = require('./src/routes');
const authRoutes = require('./src/routes/auth');
const coursesRoutes = require('./src/routes/courses');
const teachersRoutes = require('./src/routes/teachers');
const enrollmentsRoutes = require('./src/routes/enrollments');
const usersRoutes = require('./src/routes/users');
const paymentsRoutes = require('./src/routes/payments');
const { attachUserOptional } = require('./src/routes/middleware');

app.use('/api', routes);
app.use('/api/auth', authRoutes);
app.use('/api/courses', attachUserOptional, coursesRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payments', paymentsRoutes);

const PORT = process.env.PORT || 4000;

// Create HTTP server and attach Socket.IO for signaling
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// In-memory room membership registry
const roomIdToSockets = new Map(); // roomId -> Set(socket.id)
const roomIdToMessages = new Map(); // roomId -> Array<{ id, user, text, ts }>

io.on('connection', (socket) => {
  let joinedRooms = new Set();

  socket.on('join-room', ({ roomId, userId, role }) => {
    if (!roomId) return;
    socket.join(roomId);
    joinedRooms.add(roomId);
    if (!roomIdToSockets.has(roomId)) roomIdToSockets.set(roomId, new Set());
    // Send existing peers to the newly joined socket BEFORE adding them
    const existing = Array.from(roomIdToSockets.get(roomId));
    socket.emit('room-users', { roomId, peers: existing });
    // Send recent chat history (last 100)
    const history = roomIdToMessages.get(roomId) || [];
    socket.emit('chat-history', { roomId, messages: history.slice(-100) });
    roomIdToSockets.get(roomId).add(socket.id);
    // Broadcast presence list to room
    io.to(roomId).emit('broadcast', { event: 'presence', payload: { ids: Array.from(roomIdToSockets.get(roomId)) }, from: socket.id });
    socket.to(roomId).emit('user-joined', { socketId: socket.id, userId, role });
  });

  // Respond with current users in a room when asked
  socket.on('who', ({ roomId }) => {
    if (!roomId) return;
    const set = roomIdToSockets.get(roomId) || new Set();
    socket.emit('room-users', { roomId, peers: Array.from(set) });
  });

  socket.on('leave-room', ({ roomId }) => {
    if (!roomId) return;
    socket.leave(roomId);
    if (roomIdToSockets.has(roomId)) {
      roomIdToSockets.get(roomId).delete(socket.id);
      if (roomIdToSockets.get(roomId).size === 0) roomIdToSockets.delete(roomId);
    }
    socket.to(roomId).emit('user-left', { socketId: socket.id });
    if (roomIdToSockets.has(roomId)) {
      io.to(roomId).emit('broadcast', { event: 'presence', payload: { ids: Array.from(roomIdToSockets.get(roomId)) }, from: socket.id });
    }
  });

  // WebRTC signaling passthrough
  socket.on('offer', ({ to, description, roomId }) => {
    if (!to || !description) return;
    io.to(to).emit('offer', { from: socket.id, description, roomId });
  });

  socket.on('answer', ({ to, description, roomId }) => {
    if (!to || !description) return;
    io.to(to).emit('answer', { from: socket.id, description, roomId });
  });

  socket.on('ice-candidate', ({ to, candidate, roomId }) => {
    if (!to || !candidate) return;
    io.to(to).emit('ice-candidate', { from: socket.id, candidate, roomId });
  });

  socket.on('broadcast', ({ roomId, event, payload }) => {
    if (!roomId || !event) return;
    if (event === 'chat' && payload && typeof payload.text === 'string') {
      if (!roomIdToMessages.has(roomId)) roomIdToMessages.set(roomId, []);
      const arr = roomIdToMessages.get(roomId);
      const msgId = payload.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      arr.push({ id: msgId, user: payload.user || 'User', text: payload.text, ts: Date.now() });
      if (arr.length > 500) arr.splice(0, arr.length - 500);
    }
    socket.to(roomId).emit('broadcast', { event, payload, from: socket.id });
  });

  // Teacher removes a user from room
  socket.on('kick-user', ({ roomId, targetId }) => {
    if (!roomId || !targetId) return;
    // notify target
    io.to(targetId).emit('kicked', { roomId });
    // forcefully remove target from room membership
    try {
      const targetSock = io.sockets.sockets.get(targetId);
      if (targetSock) {
        targetSock.leave(roomId);
      }
    } catch { /* ignore */ }
    if (roomIdToSockets.has(roomId)) {
      roomIdToSockets.get(roomId).delete(targetId);
      io.to(roomId).emit('broadcast', { event: 'presence', payload: { ids: Array.from(roomIdToSockets.get(roomId)) }, from: socket.id });
    }
  });

  socket.on('disconnect', () => {
    for (const roomId of joinedRooms) {
      if (roomIdToSockets.has(roomId)) {
        roomIdToSockets.get(roomId).delete(socket.id);
        if (roomIdToSockets.get(roomId).size === 0) roomIdToSockets.delete(roomId);
      }
      socket.to(roomId).emit('user-left', { socketId: socket.id });
      if (roomIdToSockets.has(roomId)) {
        io.to(roomId).emit('broadcast', { event: 'presence', payload: { ids: Array.from(roomIdToSockets.get(roomId)) }, from: socket.id });
      }
    }
    joinedRooms.clear();
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
