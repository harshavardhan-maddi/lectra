/**
 * Root Server Entry Point
 * Designed for Hostinger Node.js Application Manager, CloudLinux Passenger, and VPS PM2
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env if available, then fallback to root .env
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

// Automatically construct DATABASE_URL from individual DB_* environment variables if provided
if (process.env.DB_HOST && process.env.DB_USER && !process.env.DATABASE_URL) {
  const host = process.env.DB_HOST.trim();
  const port = process.env.DB_PORT ? String(process.env.DB_PORT).trim() : '3306';
  const user = encodeURIComponent(process.env.DB_USER.trim());
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  const database = process.env.DB_NAME ? process.env.DB_NAME.trim() : 'lectra';
  process.env.DATABASE_URL = `mysql://${user}:${password}@${host}:${port}/${database}`;
}

// Start the Express backend application
const app = require('./backend/src/index.js');

module.exports = app;
