/**
 * Admin REST API Routes — Full backend for the dashboard
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const { uploadFile, getReadStream, downloadFile, deleteFile } = require('../utils/fileStorage');

const authMiddleware = require('./auth');
const { superAdminOnly } = require('./auth');
const Settings = require('../models/Settings');
const Commission = require('../models/Commission');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Rating = require('../models/Rating');
const Transaction = require('../models/Transaction');
const DeliveryGroup = require('../models/DeliveryGroup');
const Driver = require('../models/Driver');
const Handoff = require('../models/Handoff');
const QRCodeItem = require('../models/QRCode');
const DashboardStats = require('../models/DashboardStats');
const statsManager = require('../utils/statsManager');
const PDFDocument = require('pdfkit');
const { auth, restaurant, campay } = require('../config/env');

const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── AUTH ──────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Super admin check (platform owner)
  if (
    auth.superAdminEmail &&
    email === auth.superAdminEmail &&
    password === auth.superAdminPassword
  ) {
    const token = jwt.sign({ email, role: 'superAdmin' }, auth.jwtSecret, { expiresIn: '12h' });
    return res.json({ success: true, token, role: 'superAdmin' });
  }

  // Regular admin check
  if (email !== auth.adminEmail || password !== auth.adminPassword) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  const token = jwt.sign({ email, role: 'admin' }, auth.jwtSecret, { expiresIn: '12h' });
  res.json({ success: true, token, role: 'admin' });
});

// ── PUBLIC SETTINGS ────────────────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  let logoUrl = '';
  try {
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'assets' });
    const files = await bucket.find({ filename: 'restaurant-logo.png' }).sort({ uploadDate: -1 }).limit(1).toArray();
    if (files.length > 0) {
      logoUrl = `/api/files/name/restaurant-logo.png?t=${Date.now()}`;
    }
  } catch (err) {
    console.error('Error checking logo in GridFS:', err.message);
  }

  res.json({
    success: true,
    data: {
      whatsappNumber: restaurant.phone,
      restaurantName: restaurant.name,
      currency: 'FCFA',
      logoUrl
    }
  });
});

// ── Apply auth to all routes below ────────────────────────────────────────────
router.use(authMiddleware);

// ── PROTECTED SETTINGS ─────────────────────────────────────────────────────────
router.post('/settings/qr-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    const fileId = await uploadFile(req.file.buffer, 'restaurant-logo.png', req.file.mimetype);
    res.json({ success: true, data: { logoUrl: `/api/files/name/restaurant-logo.png?t=${Date.now()}` } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/settings/remove-logo', async (req, res) => {
  try {
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'assets' });
    const files = await bucket.find({ filename: 'restaurant-logo.png' }).toArray();
    
    for (const file of files) {
      await deleteFile(file._id.toString());
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── SAVED QR CODES ────────────────────────────────────────────────────────────
router.get('/qrcodes', async (req, res) => {
  const codes = await QRCodeItem.find().sort({ number: 1 });
  res.json({ success: true, data: codes });
});

router.post('/qrcodes', upload.single('image'), async (req, res) => {
  try {
    const number = Number(req.body.number);
    if (!req.file) throw new Error('No file uploaded');
    const fileId = await uploadFile(req.file.buffer, `qr-${number}.png`, req.file.mimetype);
    const imageUrl = `/api/files/${fileId}`;
    
    // Upsert logic: if table number already exists, replace it
    const existing = await QRCodeItem.findOne({ number });
    if (existing) {
      existing.imageUrl = imageUrl;
      await existing.save();
      return res.json({ success: true, data: existing });
    }
    
    const qr = await QRCodeItem.create({ number, imageUrl });
    res.json({ success: true, data: qr });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/qrcodes/:id', async (req, res) => {
  try {
    const qr = await QRCodeItem.findById(req.params.id);
    if (!qr) return res.status(404).json({ success: false, message: 'Not found' });
    
    const filePath = path.join(__dirname, '../../public', qr.imageUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await QRCodeItem.findByIdAndDelete(req.params.id);
    
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/qrcodes/:id/pdf', async (req, res) => {
  try {
    const qr = await QRCodeItem.findById(req.params.id);
    if (!qr) return res.status(404).json({ success: false, message: 'Not found' });
    
    const imagePath = path.join(__dirname, '../../public', qr.imageUrl);
    if (!fs.existsSync(imagePath)) return res.status(404).send('Image file missing');

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Table_${qr.number}_QRCode.pdf"`);
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(36).text(`Table ${qr.number}`, { align: 'center' });
    doc.moveDown(1);
    
    // Center the image
    const imgSize = 350;
    const x = (doc.page.width - imgSize) / 2;
    doc.image(imagePath, x, doc.y, { width: imgSize });
    
    doc.moveDown(15);
    doc.font('Helvetica').fontSize(14).text("Scan this code to order from our menu!", { align: 'center' });
    
    doc.end();
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    // 1. Shallow Check (O(1))
    const stats = await DashboardStats.findOne({ _id: 'global_stats' });
    if (!stats) {
      return res.status(404).json({ success: false, message: 'Stats not initialized' });
    }

    const eTag = `W/"${stats.updatedAt.getTime()}"`;
    res.set('ETag', eTag);

    if (req.headers['if-none-match'] === eTag) {
      return res.status(304).end();
    }

    // 2. Return pre-computed data
    res.json({
      success: true,
      data: {
        totalOrders: stats.totalOrders,
        todayOrders: stats.todayOrders,
        pendingOrders: stats.pendingOrders,
        totalRevenue: stats.totalRevenue,
        todayRevenue: stats.todayRevenue,
        totalUsers: stats.totalUsers,
        avgRating: stats.ratingCount > 0 ? parseFloat((stats.ratingSum / stats.ratingCount).toFixed(1)) : 0,
        activeBookings: stats.activeBookings,
        pendingHandoffs: stats.pendingHandoffs,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── REVENUE CHART DATA ─────────────────────────────────────────────────────────
router.get('/analytics/revenue', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '7', 10);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await Order.aggregate([
      { $match: { status: { $in: ['PAID', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] }, createdAt: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Douala' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POPULAR ITEMS ──────────────────────────────────────────────────────────────
router.get('/analytics/popular-items', async (req, res) => {
  try {
    const data = await Order.aggregate([
      { $match: { status: { $ne: 'CANCELLED' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.nameEn',
          count: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PERFORMANCE REPORTS ──────────────────────────────────────────────────────────
const generateReportStream = require('../pdf/report');

router.get('/analytics/report', async (req, res) => {
  try {
    const { type = 'daily' } = req.query; // 'daily' or 'monthly'
    
    let startDate = new Date();
    let endDate = new Date();
    
    if (type === 'daily') {
      const todayDouala = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' });
      startDate = new Date(`${todayDouala}T00:00:00+01:00`);
      endDate = new Date(`${todayDouala}T23:59:59.999+01:00`);
    } else if (type === 'monthly') {
      startDate.setDate(1);
      startDate.setHours(0,0,0,0);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const matchQuery = { createdAt: { $gte: startDate, $lte: endDate } };
    
    const [orders, topItemsRaw, ratingsCount, customers] = await Promise.all([
      Order.find(matchQuery),
      Order.aggregate([
        { $match: { ...matchQuery, status: { $ne: 'CANCELLED' } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.nameEn', qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
        { $sort: { qty: -1 } },
        { $limit: 5 }
      ]),
      Rating.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, avg: { $avg: '$score' } } }
      ]),
      User.countDocuments(matchQuery)
    ]);

    let revenue = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    const fulfillment = { delivery: 0, pickup: 0, in_restaurant: 0 };
    
    orders.forEach(o => {
      if (o.status === 'CANCELLED') {
        cancelledOrders++;
      } else {
        completedOrders++;
        revenue += o.total;
      }
      if (fulfillment[o.fulfillmentType] !== undefined) {
        fulfillment[o.fulfillmentType]++;
      } else {
        fulfillment[o.fulfillmentType] = 1;
      }
    });

    const stats = {
      revenue,
      totalOrders: orders.length,
      completedOrders,
      cancelledOrders,
      fulfillment,
      newCustomers: customers,
      avgRating: ratingsCount.length > 0 ? ratingsCount[0].avg.toFixed(1) : 'No Ratings',
      topItems: topItemsRaw.map(t => ({ name: t._id, qty: t.qty, revenue: t.revenue }))
    };

    const dateStrOpts = { timeZone: 'Africa/Douala', day: '2-digit', month: 'short', year: 'numeric' };
    await generateReportStream(res, {
      type,
      startDate: startDate.toLocaleDateString('en-GB', dateStrOpts),
      endDate: endDate.toLocaleDateString('en-GB', dateStrOpts),
      stats
    });

  } catch (err) {
    res.status(500).send("Error generating report");
  }
});

// ── MENU ITEMS ────────────────────────────────────────────────────────────────
router.get('/menu', async (req, res) => {
  const items = await MenuItem.find().sort({ sortOrder: 1 });
  res.json({ success: true, data: items });
});

router.post('/menu', upload.single('image'), async (req, res) => {
  try {
    const { nameEn, nameFr, descriptionEn, descriptionFr, price, category, sortOrder } = req.body;
    let imageUrl = '';
    if (req.file) {
      const fileId = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      imageUrl = `/api/files/${fileId}`;
    }
    const item = await MenuItem.create({ nameEn, nameFr, descriptionEn, descriptionFr, price: Number(price), category, imageUrl, sortOrder: Number(sortOrder || 0) });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/menu/:id', upload.single('image'), async (req, res) => {
  try {
    const updates = { ...req.body, price: Number(req.body.price) };
    if (req.file) {
      const fileId = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      updates.imageUrl = `/api/files/${fileId}`;
    }
    const item = await MenuItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/menu/:id', async (req, res) => {
  await MenuItem.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

router.patch('/menu/:id/toggle', async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  item.available = !item.available;
  await item.save();
  res.json({ success: true, data: item });
});

// ── ORDERS ─────────────────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  const { status, search, page, limit } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 20);
  
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    filter.$expr = {
      $regexMatch: {
        input: { $toString: '$_id' },
        regex: search,
        options: 'i'
      }
    };
  }

  // 1. Shallow Check (O(1) lookup)
  // We check the last updated order matching our filter to see if we can skip the full fetch.
  const latestOrder = await Order.findOne(filter)
    .sort({ updatedAt: -1 })
    .select('updatedAt');

  if (latestOrder) {
    const eTag = `W/"${latestOrder.updatedAt.getTime()}"`;
    res.set('ETag', eTag);

    if (req.headers['if-none-match'] === eTag) {
      return res.status(304).end();
    }
  }

  // 2. Full Fetch (O(N) or O(Log N) depending on indexes)
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate('groupId')
    .lean();

  const total = await Order.countDocuments(filter);
  res.json({ success: true, data: orders, total, page: Number(page) });
});

router.patch('/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  
  // Optimization: use { new: false } to get the original state and update in 1 atomic call
  const oldOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: false });
  if (!oldOrder) return res.status(404).json({ success: false, message: 'Order not found' });

  // Materialized Stats: Record transition
  // We use the old status from the result and the new status from req.body
  await statsManager.onOrderStatusChange(oldOrder.status, status, oldOrder.total);
  
  // Fetch the updated doc to return to client (or manually merge)
  const order = await Order.findById(req.params.id).populate('groupId'); 
  res.json({ success: true, data: order });
});

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
router.get('/bookings', async (req, res) => {
  const { date, status } = req.query;
  const filter = {};
  if (date) filter.date = date;
  if (status) filter.status = status;
  const bookings = await Booking.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: bookings });
});

router.patch('/bookings/:id/status', async (req, res) => {
  const oldBooking = await Booking.findById(req.params.id);
  if (!oldBooking) return res.status(404).json({ success: false, message: 'Booking not found' });

  const booking = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  
  // Materialized Stats: Update activeBookings if status flipped to/from CONFIRMED
  if (oldBooking.status !== 'CONFIRMED' && booking.status === 'CONFIRMED') {
    await statsManager.onBookingStatusChange(1);
  } else if (oldBooking.status === 'CONFIRMED' && booking.status !== 'CONFIRMED') {
    await statsManager.onBookingStatusChange(-1);
  }

  res.json({ success: true, data: booking });
});

router.get('/bookings/availability', async (req, res) => {
  const { date } = req.query;
  const booked = await Booking.countDocuments({ date, status: 'CONFIRMED' });
  const totalTables = await QRCodeItem.countDocuments();
  const available = totalTables - booked;
  res.json({ success: true, data: { booked, available, total: totalTables } });
});

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  const { page, limit } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 30);

  // 1. Shallow Check (O(1) with index)
  const latestUser = await User.findOne().sort({ updatedAt: -1 }).select('updatedAt');
  if (latestUser) {
    const eTag = `W/"${latestUser.updatedAt.getTime()}"`;
    res.set('ETag', eTag);

    if (req.headers['if-none-match'] === eTag) {
      return res.status(304).end();
    }
  }

  // 2. Paginated Fetch
  const customers = await User.find()
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);
    
  const total = await User.countDocuments();
  res.json({ success: true, data: customers, total });
});

// ── RATINGS ───────────────────────────────────────────────────────────────────
router.get('/ratings', async (req, res) => {
  const ratings = await Rating.find().sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: ratings });
});

// ── DELIVERY GROUPS ───────────────────────────────────────────────────────────
router.get('/delivery-groups', async (req, res) => {
  const groups = await DeliveryGroup.find({ status: { $ne: 'COMPLETED' } })
    .sort({ createdAt: -1 })
    .populate('orderIds');
  res.json({ success: true, data: groups });
});

router.patch('/delivery-groups/:id/assign', async (req, res) => {
  const { riderEmail, riderName } = req.body;
  const riderId = req.body.riderId ? req.body.riderId.toUpperCase().trim() : '';
  const group = await DeliveryGroup.findByIdAndUpdate(
    req.params.id,
    { riderId, riderName, status: 'ASSIGNED' },
    { new: true }
  );
  res.json({ success: true, data: group });
});

// ── HANDOFFS ──────────────────────────────────────────────────────────────────
router.get('/handoffs', async (req, res) => {
  const handoffs = await Handoff.find({ resolved: false }).sort({ createdAt: -1 });
  res.json({ success: true, data: handoffs });
});

router.patch('/handoffs/:id/resolve', async (req, res) => {
  const handoff = await Handoff.findByIdAndUpdate(
    req.params.id,
    { resolved: true, resolvedAt: new Date(), agentNote: req.body.note || '' },
    { new: true }
  );
  
  // Materialized Stats: Resolution
  await statsManager.onHandoffChange(-1);

  res.json({ success: true, data: handoff });
});

// ── DRIVERS ──────────────────────────────────────────────────────────────────
router.get('/drivers', async (req, res) => {
  const drivers = await Driver.find().sort({ createdAt: -1 });
  res.json({ success: true, data: drivers });
});

router.post('/drivers', async (req, res) => {
  try {
    const { name, riderId, phone } = req.body;
    const upperId = riderId.toUpperCase().trim();
    const driver = await Driver.create({
      name,
      riderId: upperId,
      driverCode: `DRIVER_${upperId}`,
      phone,
    });
    res.json({ success: true, data: driver });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/drivers/:id', async (req, res) => {
  await Driver.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ── SUPER ADMIN — COMMISSION STATS ───────────────────────────────────────────
router.get('/commissions/stats', superAdminOnly, async (req, res) => {
  try {
    const now = new Date();

    // Today boundaries (Africa/Douala = UTC+1)
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' });
    const todayStart = new Date(`${todayStr}T00:00:00+01:00`);
    const todayEnd   = new Date(`${todayStr}T23:59:59.999+01:00`);

    // This month boundaries
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [totalAgg, todayAgg, monthAgg, orderCount] = await Promise.all([
      Commission.aggregate([{ $match: { status: 'EARNED' } }, { $group: { _id: null, sum: { $sum: '$commissionAmount' } } }]),
      Commission.aggregate([{ $match: { status: 'EARNED', earnedAt: { $gte: todayStart, $lte: todayEnd } } }, { $group: { _id: null, sum: { $sum: '$commissionAmount' } } }]),
      Commission.aggregate([{ $match: { status: 'EARNED', earnedAt: { $gte: monthStart, $lte: monthEnd } } }, { $group: { _id: null, sum: { $sum: '$commissionAmount' } } }]),
      Commission.countDocuments({ status: 'EARNED' }),
    ]);

    res.json({
      success: true,
      data: {
        totalEarned:   totalAgg[0]?.sum  || 0,
        todayEarned:   todayAgg[0]?.sum  || 0,
        monthEarned:   monthAgg[0]?.sum  || 0,
        totalOrders:   orderCount,
        commissionRate: 1.5,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── SUPER ADMIN — COMMISSION LIST ────────────────────────────────────────────
router.get('/commissions', superAdminOnly, async (req, res) => {
  try {
    const { page, limit, from, to } = req.query;
    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.max(1, parseInt(limit) || 30);

    const filter = { status: 'EARNED' };
    if (from || to) {
      filter.earnedAt = {};
      if (from) filter.earnedAt.$gte = new Date(from);
      if (to)   filter.earnedAt.$lte = new Date(to);
    }

    const [commissions, total] = await Promise.all([
      Commission.find(filter)
        .sort({ earnedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('orderId', 'phone total fulfillmentType createdAt')
        .lean(),
      Commission.countDocuments(filter),
    ]);

    res.json({ success: true, data: commissions, total, page: pageNum });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────

router.get('/settings', authMiddleware, async (req, res) => {
  try {
    let settings = await Settings.findOne({ type: 'global' }).lean();
    if (!settings) {
      settings = { campayUsername: '', campayPassword: '', campayAppName: '', campayBaseUrl: '', campayWebhookUrl: '' };
    }
    // Never send the password fully visible for security
    const sanitizedPassword = settings.campayPassword ? '********' : '';
    res.json({
      success: true,
      data: {
        campayUsername: settings.campayUsername || '',
        campayPassword: sanitizedPassword,
        campayAppName: settings.campayAppName || '',
        campayBaseUrl: settings.campayBaseUrl || '',
        campayWebhookUrl: settings.campayWebhookUrl || '',
        brandColor: settings.brandColor || '#00ed64',
        logoUrl: settings.logoUrl || '',
        restaurantName: settings.restaurantName || '',
        whatsappNumber: settings.whatsappNumber || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/settings/campay', authMiddleware, async (req, res) => {
  try {
    const { campayUsername, campayPassword, campayAppName, campayBaseUrl, campayWebhookUrl } = req.body;
    let settings = await Settings.findOne({ type: 'global' });
    
    if (!settings) {
      settings = new Settings({ type: 'global' });
    }

    if (campayUsername !== undefined) settings.campayUsername = campayUsername.trim();
    // Only update password if a new one is explicitly provided (not just '********')
    if (campayPassword && campayPassword !== '********') {
      settings.campayPassword = campayPassword.trim();
    }
    if (campayAppName !== undefined) settings.campayAppName = campayAppName.trim();
    if (campayBaseUrl !== undefined) settings.campayBaseUrl = campayBaseUrl.trim();
    if (campayWebhookUrl !== undefined) settings.campayWebhookUrl = campayWebhookUrl.trim();

    await settings.save();
    
    // Invalidate the active token immediately to ensure next payment uses new keys
    const { clearTokenCache } = require('../payments/campay');
    clearTokenCache();

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/settings/brand-color', authMiddleware, async (req, res) => {
  try {
    const { brandColor } = req.body;
    if (!brandColor || !/^#[0-9a-fA-F]{3,6}$/.test(brandColor)) {
      return res.status(400).json({ success: false, message: 'Invalid color format. Use a hex color like #00ed64' });
    }
    let settings = await Settings.findOne({ type: 'global' });
    if (!settings) settings = new Settings({ type: 'global' });
    settings.brandColor = brandColor;
    await settings.save();
    res.json({ success: true, message: 'Brand color updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
