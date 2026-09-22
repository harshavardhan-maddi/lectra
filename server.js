/**
 * Root Server Entry Point
 * Designed for Hostinger Node.js Application Manager, CloudLinux Passenger, and VPS PM2
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env if available, then fallback to root .env
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

// Start the Express backend application
const app = require('./backend/src/index.js');

module.exports = app;
