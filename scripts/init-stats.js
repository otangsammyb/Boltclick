const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const Booking = require('../src/models/Booking');
const Rating = require('../src/models/Rating');
const Handoff = require('../src/models/Handoff');
const DashboardStats = require('../src/models/DashboardStats');
const connectDB = require('../src/config/db');

async function initializeStats() {
  await connectDB();

  console.log('Computing initial stats...');

  const nowDouala = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' });
  const today = new Date(`${nowDouala}T00:00:00+01:00`);

  const [
    totalOrders,
    todayOrders,
    pendingOrders,
    totalRevenueRaw,
    todayRevenueRaw,
    totalUsers,
    ratings,
    activeBookings,
    pendingHandoffs,
  ] = await Promise.all([
    Order.countDocuments({ status: { $ne: 'CANCELLED' } }),
    Order.countDocuments({ createdAt: { $gte: today }, status: { $ne: 'CANCELLED' } }),
    Order.countDocuments({ status: { $in: ['PAID', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } }),
    Order.aggregate([{ $match: { status: { $in: ['PAID', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.aggregate([{ $match: { status: { $in: ['PAID', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] }, createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    User.countDocuments(),
    Rating.find(),
    Booking.countDocuments({ status: 'CONFIRMED' }),
    Handoff.countDocuments({ resolved: false }),
  ]);

  const ratingSum = ratings.reduce((acc, curr) => acc + curr.score, 0);
  const ratingCount = ratings.length;

  const stats = {
    _id: 'global_stats',
    totalOrders,
    todayOrders,
    pendingOrders,
    totalRevenue: totalRevenueRaw[0]?.total || 0,
    todayRevenue: todayRevenueRaw[0]?.total || 0,
    totalUsers,
    ratingSum,
    ratingCount,
    activeBookings,
    pendingHandoffs,
    lastDate: nowDouala,
  };

  await DashboardStats.findOneAndUpdate(
    { _id: 'global_stats' },
    stats,
    { upsert: true, new: true }
  );

  console.log('✅ Stats initialized:', stats);
  process.exit(0);
}

initializeStats().catch(err => {
  console.error(err);
  process.exit(1);
});
