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

const { initDatabaseSchema } = require('./services/dbInit.service');

// Health check with DB status
app.get('/health', async (req, res) => {
  let dbStatus = 'connected';
  let dbError = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'disconnected';
    dbError = err.message;
  }
  res.json({
    status: dbStatus === 'connected' ? 'healthy' : 'database_error',
    database: dbStatus,
    error: dbError,
    timestamp: new Date()
  });
});

// Manual / diagnostic database initialization endpoint
app.get('/api/init-db', async (req, res) => {
  try {
    const result = await initDatabaseSchema();
    res.json(result);
  } catch (error) {
    console.error('[API Init DB Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
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

// Ensure any unmatched /api route returns JSON, never HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler (always returns JSON)
app.use((err, req, res, next) => {
  console.error('[Global Error Logger]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? String(err) : undefined
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Start listening immediately so Hostinger and Passenger detect the live server
    server.listen(PORT, () => {
      console.log(`[Server] Live on http://localhost:${PORT}`);
    });

    // Test database connection in background and auto-create tables if missing
    prisma.$connect()
      .then(async () => {
        console.log('[Database] Connected to MySQL via Prisma ORM.');
        try {
          await initDatabaseSchema();
        } catch (initErr) {
          console.error('[Database Init Warning]:', initErr.message);
        }
        startCron();
      })
      .catch((error) => {
        console.error('[Database Warning] Failed to connect to MySQL on startup:', error.message);
        console.error('[Database Warning] Please check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.');
      });
  } catch (error) {
    console.error('[Startup Error] Failed to initialize HTTP server:', error);
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
