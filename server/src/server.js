const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config/env');
const { connectDB } = require('./config/db');

const server = http.createServer(app);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: [
      config.CLIENT_URL,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://localhost:5000'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  // Join shop room (for shop dashboard live queue and agent status)
  socket.on('join:shop', (shopId) => {
    if (shopId) {
      socket.join(`shop:${shopId}`);
    }
  });

  // Join individual job room (for student tracking screen)
  socket.on('join:job', (jobId) => {
    if (jobId) {
      socket.join(`job:${jobId}`);
    }
  });

  socket.on('disconnect', () => {
    // client disconnected
  });
});

// Helper functions for pushing live updates
const emitJobUpdate = (job) => {
  if (!job) return;
  const jobId = job._id ? job._id.toString() : job.id;
  const shopId = job.shopId ? job.shopId.toString() : null;

  // Emit to job-specific room
  if (jobId) {
    io.to(`job:${jobId}`).emit('job:updated', job);
  }

  // Emit to shop dashboard queue
  if (shopId) {
    io.to(`shop:${shopId}`).emit('queue:updated', job);
  }
};

const emitAgentStatus = (shopId, isOnline) => {
  if (shopId) {
    io.to(`shop:${shopId}`).emit('agent:status', { shopId, isOnline, timestamp: new Date() });
  }
};

// Start server function
const startServer = async () => {
  try {
    await connectDB();
    console.log('[DB] Connected to MongoDB Atlas / Local MongoDB successfully');

    // Auto-seed demo shop if database is empty (e.g. fresh Render deployment)
    try {
      const Shop = require('./models/Shop');
      const shopCount = await Shop.countDocuments();
      if (shopCount === 0) {
        console.log('[Auto-Seed] No shops detected in database. Seeding demo shop & demo accounts...');
        const seed = require('./seed');
        await seed({ exitOnComplete: false });
      }
    } catch (seedErr) {
      console.warn('[Auto-Seed] Non-fatal auto-seed warning:', seedErr.message);
    }

    // Start cron jobs if configured
    try {
      const { initCronJobs } = require('./cron/cleanup');
      initCronJobs();
    } catch (e) {
      // Cron initialized when ready
    }

    server.listen(config.PORT, config.HOST, () => {
      console.log(`[PrintPass Server] Running on http://${config.HOST}:${config.PORT} (env: ${config.NODE_ENV})`);
    });
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  server,
  io,
  emitJobUpdate,
  emitAgentStatus
};
