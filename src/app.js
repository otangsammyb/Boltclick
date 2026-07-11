/**
 * Restaurant WhatsApp SalesBot — Express Application Entry Point
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const { port, nodeEnv, baseUrl } = require('./config/env');
const logger = require('./utils/logger');

const webhookRouter = require('./bot/webhook');
const adminRouter = require('./admin/routes');
const deliveryRouter = require('./delivery/routes');
const campayWebhook = require('./payments/webhook');
const { getReadStream } = require('./utils/fileStorage');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const { rehydrateFollowUps } = require('./scheduler/followUp');
const fileCache = require('./utils/cache');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ── Trust proxy (nginx sits in front in production) ──────────────────────────
if (nodeEnv === 'production') app.set('trust proxy', 1);

// ── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
const corsAllowList = nodeEnv === 'production'
  ? [baseUrl, baseUrl.replace('https://', 'https://www.')]
  : '*';
app.use(cors({ origin: corsAllowList, credentials: true }));
app.use(morgan(
  nodeEnv === 'production' ? 'combined' : 'dev',
  { stream: { write: (msg) => logger.info(msg.trim()) } }
));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── File Serving (GridFS) - Bypasses Rate Limiting ────────────────────────────
const getFileFromGridFS = (id) => new Promise((resolve, reject) => {
  const chunks = [];
  const stream = getReadStream(id);
  stream.on('data', chunk => chunks.push(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(Buffer.concat(chunks)));
});

app.get('/api/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Hybrid Storage Check (Disk shortcut for large migrated files)
    const possibleDiskPathPng = path.join(__dirname, '../public/uploads', `${id}.png`);
    const possibleDiskPathPdf = path.join(__dirname, '../public/uploads', `${id}.pdf`);
    
    if (fs.existsSync(possibleDiskPathPng)) {
      res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', 'ETag': `W/"${id}-disk"` });
      if (req.fresh) return res.status(304).end();
      return fs.createReadStream(possibleDiskPathPng).pipe(res);
    }
    
    if (fs.existsSync(possibleDiskPathPdf)) {
      res.set({ 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400', 'ETag': `W/"${id}-disk"` });
      if (req.fresh) return res.status(304).end();
      return fs.createReadStream(possibleDiskPathPdf).pipe(res);
    }
    
    // 2. Check in-memory Cache
    const cachedFile = fileCache.get(id);

    if (cachedFile) {
      res.set({
        'Content-Type': cachedFile.contentType,
        'Cache-Control': 'public, max-age=86400',
        'ETag': `W/"${id}"`
      });
      // Client-side caching validation
      if (req.fresh) return res.status(304).end();
      return res.send(cachedFile.buffer);
    }

    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'assets' });
    const _id = new mongoose.Types.ObjectId(id);
    const files = await bucket.find({ _id }).toArray();
    
    if (!files.length) return res.status(404).send('File not found');

    const contentType = files[0].contentType;
    const buffer = await getFileFromGridFS(id);

    // Save to Cache
    fileCache.set(id, { buffer, contentType });

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'ETag': `W/"${id}"`
    });
    res.send(buffer);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/files/name/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    // Check Cache by name
    const cachedFile = fileCache.get(`name:${name}`);

    if (cachedFile) {
      res.set({
        'Content-Type': cachedFile.contentType,
        'Cache-Control': 'public, max-age=86400',
        'ETag': `W/"name:${name}"`
      });
      if (req.fresh) return res.status(304).end();
      return res.send(cachedFile.buffer);
    }

    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'assets' });
    const files = await bucket.find({ filename: name }).sort({ uploadDate: -1 }).limit(1).toArray();
    
    if (!files.length) return res.status(404).send('File not found');

    const id = files[0]._id.toString();
    const contentType = files[0].contentType;
    const buffer = await getFileFromGridFS(id);

    // Save to Cache using both keys
    fileCache.set(`name:${name}`, { buffer, contentType });
    fileCache.set(id, { buffer, contentType });

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'ETag': `W/"name:${name}"`
    });
    res.send(buffer);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Rate limiter for API (not for webhook — Meta needs instant 200)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
});
app.use('/api', apiLimiter);

// ── Static files ──────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/receipts', express.static(path.join(__dirname, '../public/receipts')));
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.use('/delivery', express.static(path.join(__dirname, '../public/delivery')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/webhook', webhookRouter);
app.use('/api/admin', adminRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/payments/webhook', campayWebhook);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), env: nodeEnv });
});

// ── Public client config (non-secret keys needed by browser) ─────────────────
app.get('/api/config', (req, res) => {
  res.json({
    mapboxToken: process.env.MAPBOX_TOKEN || ''
  });
});

// Routes moved up for performance optimization

// ── Root Redirect ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect(301, '/admin');
});

// ── SPA fallbacks ─────────────────────────────────────────────────────────────
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});
app.get('/delivery/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/delivery/index.html'));
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Socket.IO — real-time dashboard updates ───────────────────────────────────
io.on('connection', (socket) => {
  logger.debug('Dashboard connected: ' + socket.id);
  
  socket.on('driverLocation', (data) => {
    // Relay to connected Admin interfaces
    io.emit('driverLocationUpdate', data);
  });

  socket.on('disconnect', () => logger.debug('Dashboard disconnected: ' + socket.id));
});

// Export io so other modules can emit events
app.set('io', io);

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  server.listen(port, () => {
    logger.info(`🚀 Restaurant bot running on port ${port} [${nodeEnv}]`);
    logger.info(`📊 Admin dashboard: http://localhost:${port}/admin`);
    logger.info(`🚗 Delivery app:    http://localhost:${port}/delivery`);
  });

  // Re-schedule any pending follow-ups after restart
  await rehydrateFollowUps();
}

start().catch((err) => {
  logger.error('Startup failed: ' + err.message);
  process.exit(1);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully…`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting.');
    process.exit(0);
  });
  // Force-exit after 10 s if requests don't finish
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

module.exports = { app, io };
