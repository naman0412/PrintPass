require('dotenv').config();

const config = {
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:5000',
  AGENT_KEY: process.env.AGENT_KEY || '',
  PRINTER_NAME: process.env.PRINTER_NAME || '',
  POLL_SECONDS: parseInt(process.env.POLL_SECONDS, 10) || 5,
  DRY_RUN: process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1' || !process.env.PRINTER_NAME
};

module.exports = config;
