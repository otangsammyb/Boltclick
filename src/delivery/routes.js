const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const DeliveryGroup = require('../models/DeliveryGroup');
const Order = require('../models/Order');
const Driver = require('../models/Driver');
const { auth, restaurant } = require('../config/env');
const wa = require('../bot/whatsapp');
const strings = require('../bot/language/strings');

// ── Public: Restaurant config (lat/lng for routing) ──────────────────────────
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      lat: restaurant.lat,
      lng: restaurant.lng,
      name: restaurant.name,
      address: restaurant.address,
    }
  });
});

// ── Driver Auth ───────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { driverCode } = req.body;
  if (!driverCode) return res.status(400).json({ success: false, message: 'Missing driver code' });

  const driver = await Driver.findOne({ driverCode: driverCode.trim(), active: true });
  if (!driver) {
    return res.status(401).json({ success: false, message: 'Invalid or deactivated driver code' });
  }

  const token = jwt.sign({ riderId: driver.riderId, role: 'driver' }, auth.jwtSecret, { expiresIn: '8h' });
  res.json({ success: true, token, riderId: driver.riderId });
});

// ── Auth middleware for drivers ───────────────────────────────────────────────
function driverAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.driver = jwt.verify(token, auth.jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// ── Get assigned groups for driver ────────────────────────────────────────────
router.get('/my-groups', driverAuth, async (req, res) => {
  const groups = await DeliveryGroup.find({
    riderId: req.driver.riderId.toUpperCase(),
    status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
  }).populate({
    path: 'orderIds',
    select: 'items total deliveryAddress deliveryLat deliveryLng status phone',
  });
  res.json({ success: true, data: groups });
});

// ── Get delivery history for driver ──────────────────────────────────────────
router.get('/history', driverAuth, async (req, res) => {
  const groups = await DeliveryGroup.find({
    riderId: req.driver.riderId.toUpperCase(),
    status: 'COMPLETED',
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .populate({
      path: 'orderIds',
      select: 'items total deliveryAddress status phone createdAt',
    });
  res.json({ success: true, data: groups });
});

// ── Start delivery (IN_PROGRESS) ─────────────────────────────────────────────
router.patch('/groups/:id/start', driverAuth, async (req, res) => {
  const group = await DeliveryGroup.findByIdAndUpdate(
    req.params.id,
    { status: 'IN_PROGRESS' },
    { new: true }
  );
  // Update all orders to OUT_FOR_DELIVERY
  await Order.updateMany({ _id: { $in: group.orderIds }, status: 'PAID' }, { status: 'OUT_FOR_DELIVERY' });
  res.json({ success: true, data: group });
});

// ── Mark one order as delivered ───────────────────────────────────────────────
router.patch('/orders/:orderId/delivered', driverAuth, async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.orderId,
    { status: 'DELIVERED', deliveredAt: new Date() },
    { new: true }
  );
  if (!order) return res.status(404).json({ success: false });

  // Check if all orders in group are delivered
  const group = await DeliveryGroup.findById(order.groupId);
  if (group) {
    const allOrders = await Order.find({ _id: { $in: group.orderIds } });
    const allDelivered = allOrders.every((o) => o.status === 'DELIVERED');
    if (allDelivered) {
      await DeliveryGroup.findByIdAndUpdate(group._id, { status: 'COMPLETED' });
    }
  }

  res.json({ success: true, data: order });
});

module.exports = router;
