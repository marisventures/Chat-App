 // Main server entry point
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import messageRoutes from './routes/messages.js';
import userRoutes from './routes/users.js';
import statusRoutes from './routes/status.js';
import { authenticateToken } from './middleware/auth.js';
import { connectDB } from './config/database.js';
import Status from './models/Status.js';
import Message from './models/Message.js';
import Chat from './models/Chat.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);

// Allowed CORS origins (for both Express and Socket.io)
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.APP_URL,
  'http://localhost:3000',
  'http://localhost:5173',  // Vite default
  'http://127.0.0.1:3000',
  'http://192.168.18.68:3000'
].filter(Boolean); // Remove undefined/null values

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Middleware - CORS for Express
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Attach io to app for access in routes
app.set('io', io);

// Connect to database
connectDB().then((conn) => {
  if (conn) {
    console.log('✓ Database connected successfully');
  } else {
    console.error('✗ Failed to connect to database');
  }
}).catch((err) => {
  console.error('✗ Database connection error:', err.message);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/status', authenticateToken, statusRoutes);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auto-delete expired statuses every hour
setInterval(async () => {
  try {
    const result = await Status.deleteMany({ expiresAt: { $lt: new Date() } });
    if (result.deletedCount > 0) {
      console.log(`Auto-deleted ${result.deletedCount} expired statuses`);
    }
  } catch (error) {
    console.error('Error auto-deleting expired statuses:', error);
  }
}, 3600000); // 1 hour

// Socket.io connection handling with JWT authentication and presence tracking
const activeUsers = new Map(); // socket.id -> userId
const userSockets = new Map(); // userId -> Set of socket.ids (for multiple tabs)
const userActivity = new Map(); // userId -> lastActivity timestamp
const HEARTBEAT_INTERVAL = 25000; // 25 seconds - server sends ping
const INACTIVITY_TIMEOUT = 60000; // 60 seconds - mark offline after no activity

// Helper: Update user presence in database
async function updatePresence(userId, isOnline) {
  try {
    const User = (await import('./models/User.js')).default;
    await User.findByIdAndUpdate(userId, {
      online: isOnline,
      lastSeen: new Date()
    });
  } catch (error) {
    console.error('Error updating presence:', error);
  }
}

// Helper: Broadcast user's presence to all connected sockets
function broadcastPresence(userId, isOnline) {
  io.emit('user-presence', { userId, isOnline });
}

// Helper: Check for inactive users and mark them offline
async function checkInactiveUsers() {
  const now = Date.now();
  for (const [userId, lastActivity] of userActivity) {
    if (now - lastActivity > INACTIVITY_TIMEOUT) {
      // User has been inactive for too long
      const sockets = userSockets.get(userId);
      if (!sockets || sockets.size === 0) {
        // No sockets - mark offline
        userActivity.delete(userId);
        await updatePresence(userId, false);
        broadcastPresence(userId, false);
      }
      // If sockets exist, user is still connected - don't mark offline
    }
  }
}

// Periodic check for inactive users
setInterval(checkInactiveUsers, 15000);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }
    const decoded = jwt.verify(token, jwtSecret);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  console.log(`User ${userId} connected with socket ${socket.id}`);

  // Join user's personal room
  socket.join(userId);
  activeUsers.set(socket.id, userId);

  // Track socket for this user (supports multiple tabs)
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);

  // Update activity timestamp
  userActivity.set(userId, Date.now());

  // Mark user as online
  updatePresence(userId, true).then(() => {
    broadcastPresence(userId, true);
  });

  // Heartbeat ping-pong mechanism
  socket.on('heartbeat', () => {
    // Client responds to ping - keep user online
    userActivity.set(userId, Date.now());
  });

  // Client activity events - reset inactivity timer
  socket.on('user-active', () => {
    userActivity.set(userId, Date.now());
  });

   // Handle status view tracking
   socket.on('status-viewed', ({ statusId, viewDuration }) => {
     console.log(`Status ${statusId} viewed by ${userId} for ${viewDuration}ms`);
   });

   // Handle joining chat room
   socket.on('join chat', (chatId) => {
     socket.join(chatId);
     console.log(`User ${userId} joined chat ${chatId}`);
   });

    // Handle message read receipt
    socket.on('message read', async ({ messageId, chatId }) => {
      try {
        const message = await Message.findById(messageId);

        if (message) {
          // Update status to read
          if (message.status !== 'read') {
            message.status = 'read';
            
            // Add to readBy if not already there
            if (!message.readBy.includes(userId)) {
              message.readBy.push(userId);
            }
            
            await message.save();

            // Broadcast updated message status to all users in the chat room
            io.to(chatId).emit('message-status-updated', {
              messageId,
              status: 'read',
              readBy: message.readBy
            });

            console.log(`Message ${messageId} marked as read by ${userId}`);
          }
        }
      } catch (error) {
        console.error('Error updating message status:', error);
      }
    });

    // Handle disconnect (tab close, refresh, logout)
  socket.on('disconnect', (reason) => {
    console.log(`Socket ${socket.id} disconnected: ${reason}`);

    activeUsers.delete(socket.id);

    // Remove socket from user's socket set
    const userSocketSet = userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);

      // If no more sockets for this user, mark as offline
      if (userSocketSet.size === 0) {
        userSockets.delete(userId);
        userActivity.delete(userId);
        updatePresence(userId, false).then(() => {
          broadcastPresence(userId, false);
        });
      }
    }
  });
});

// Periodic heartbeat ping to all connected sockets
setInterval(() => {
  io.emit('ping');
}, HEARTBEAT_INTERVAL);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { io };
