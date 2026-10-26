require('dotenv').config();

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  HOST: process.env.HOST || '0.0.0.0',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/printpass',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_key_change_in_production_printpass_2026',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'dev_cookie_secret_1234567890',
  AGENT_SIGNING_SECRET: process.env.AGENT_SIGNING_SECRET || 'dev_agent_signing_secret_987654321',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'PrintPass <no-reply@printpass.local>',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};

module.exports = config;
