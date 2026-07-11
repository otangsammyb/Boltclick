const mongoose = require('mongoose');

const dashboardStatsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global_stats' },
    totalOrders: { type: Number, default: 0 },
    todayOrders: { type: Number, default: 0 },
    pendingOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    todayRevenue: { type: Number, default: 0 },
    totalUsers: { type: Number, default: 0 },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    activeBookings: { type: Number, default: 0 },
    pendingHandoffs: { type: Number, default: 0 },
    lastDate: { type: String, required: true }, // "YYYY-MM-DD" in Africa/Douala
  },
  { timestamps: true }
);

module.exports = mongoose.model('DashboardStats', dashboardStatsSchema);
