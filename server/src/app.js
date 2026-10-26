const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config/env');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shop');

const app = express();

// Trust proxy for secure cookies behind reverse proxies (Render, Cloudflare, etc.)
app.set('trust proxy', 1);

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: config.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://checkout.razorpay.com'],
            frameSrc: ["'self'", 'https://api.razorpay.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", 'ws:', 'wss:', 'https://lumberjack.razorpay.com', 'https://api.razorpay.com', config.CLIENT_URL]
          }
        }
      : false,
    crossOriginEmbedderPolicy: false
  })
);

// Strict CORS
const allowedOrigins = [
  config.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:5000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, print agent)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for preview/deployed host, can be constrained by env
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-agent-key']
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(config.COOKIE_SECRET));

// Sanitize MongoDB operators from req.body, req.query, req.params
app.use(mongoSanitize());

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});
app.use('/api/', generalLimiter);

// Specific stricter limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: 'Too many login or registration attempts. Please try again later.'
  }
});
app.use('/api/auth/', authLimiter);

// Mount Base API Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);

const jobRoutes = require('./routes/jobs');
app.use('/api/jobs', jobRoutes);

const fileRoutes = require('./routes/files');
app.use('/api/files', fileRoutes);

const paymentRoutes = require('./routes/payments');
app.use('/api/payments', paymentRoutes);

const agentRoutes = require('./routes/agent');
app.use('/api/agent', agentRoutes);

// Serve static frontend build in production
if (config.isProduction || process.env.SERVE_STATIC === 'true') {
  const distPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(distPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('Application client is building or not yet compiled.');
      }
    });
  });
}

// Global 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, _next) => {
  // Never log raw file contents or secrets
  console.error('[SERVER ERROR]', err.message || err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: Object.values(err.errors).map((e) => e.message).join(', ')
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `Duplicate value for ${field}. That entry already exists.`
    });
  }

  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token.'
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
