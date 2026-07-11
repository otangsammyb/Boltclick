/**
 * Smart Delivery Routing — Groups nearby delivery orders for a single rider
 */
const Order = require('../models/Order');
const DeliveryGroup = require('../models/DeliveryGroup');
const { haversine } = require('../utils/haversine');
const logger = require('../utils/logger');

const GROUPING_RADIUS_KM = 2;
const GROUPING_WINDOW_MINUTES = 15;

async function checkAndGroup(newOrder) {
  if (newOrder.fulfillmentType !== 'delivery') return;
  if (!newOrder.deliveryLat || !newOrder.deliveryLng) return;

  const windowStart = new Date(Date.now() - GROUPING_WINDOW_MINUTES * 60 * 1000);

  // Find other ungrouped paid delivery orders in the last 15 minutes
  const candidates = await Order.find({
    _id: { $ne: newOrder._id },
    status: 'PAID',
    fulfillmentType: 'delivery',
    groupId: null,
    deliveryLat: { $ne: null },
    deliveryLng: { $ne: null },
    createdAt: { $gte: windowStart },
  });

  const nearby = candidates.filter((order) => {
    const dist = haversine(newOrder.deliveryLat, newOrder.deliveryLng, order.deliveryLat, order.deliveryLng);
    return dist <= GROUPING_RADIUS_KM;
  });

  const orderIds = [newOrder._id, ...nearby.map((o) => o._id)];

  // Calculate center of group
  const allLats = [newOrder.deliveryLat, ...nearby.map((o) => o.deliveryLat)];
  const allLngs = [newOrder.deliveryLng, ...nearby.map((o) => o.deliveryLng)];
  const centerLat = allLats.reduce((a, b) => a + b, 0) / allLats.length;
  const centerLng = allLngs.reduce((a, b) => a + b, 0) / allLngs.length;

  if (orderIds.length > 1) {
    const group = await DeliveryGroup.create({
      orderIds,
      center: { lat: centerLat, lng: centerLng },
      status: 'PENDING',
    });

    await Order.updateMany({ _id: { $in: orderIds } }, { $set: { groupId: group._id } });

    logger.info(`🗺️  Smart routing: grouped ${orderIds.length} orders into group ${group._id}`);
    return group;
  } else {
    // Single order — create its own group
    const group = await DeliveryGroup.create({
      orderIds: [newOrder._id],
      center: { lat: newOrder.deliveryLat, lng: newOrder.deliveryLng },
      status: 'PENDING',
    });
    await Order.findByIdAndUpdate(newOrder._id, { groupId: group._id });
    return group;
  }
}

module.exports = { checkAndGroup };
