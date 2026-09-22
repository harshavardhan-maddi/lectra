require('dotenv').config();


const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const prisma = require('./db');
const { initSocket } = require('./services/socket.service');
const { startCron } = require('./services/cron.service');

const authRoutes = require('./routes/auth.routes');
const classroomRoutes = require('./routes/classroom.routes');
const timetableRoutes = require('./routes/timetable.routes');
const logRoutes = require('./routes/log.routes');
const reportRoutes = require('./routes/report.routes');
const settingRoutes = require('./routes/setting.routes');
const facultyRoutes = require('./routes/faculty.routes');
const studentAttendanceRoutes = require('./routes/studentAttendance.routes');
const backupRoutes = require('./routes/backup.routes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/student-attendance', studentAttendanceRoutes);
app.use('/api/backup', backupRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Serve frontend build in production / Hostinger deployment
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/socket.io')) {
      return next();
    }
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error Logger]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('[Database] Connected to MySQL via Prisma ORM.');

    // Start background auto-expiry cron
    startCron();

    server.listen(PORT, () => {
      console.log(`[Server] Live on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Startup Error] Failed to initialize server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n[Server] Shutting down gracefully...');
  await prisma.$disconnect();
  console.log('[Database] Disconnected Prisma.');
  process.exit(0);
};

if (!process.env.VERCEL) {
  startServer();
} else {
  console.warn('[Vercel Serverless] Running in serverless mode. WebSockets (Socket.IO) and background cron jobs are not supported.');
}

module.exports = app;
