/**
 * Follow-up Scheduler — 30-min post-delivery rating prompt
 */
const cron = require('node-cron');
const Order = require('../models/Order');
const wa = require('../bot/whatsapp');
const sm = require('../bot/stateManager');
const strings = require('../bot/language/strings');
const logger = require('../utils/logger');

// Map of pending follow-up timers
const pendingFollowUps = new Map();

async function scheduleFollowUp(phone, lang, order) {
  const orderId = order._id.toString();

  if (pendingFollowUps.has(orderId)) return; // Already scheduled

  logger.info(`⏰ Follow-up scheduled for order ${orderId} in 30 min`);

  const timer = setTimeout(async () => {
    try {
      const latestOrder = await Order.findById(orderId);
      if (!latestOrder || latestOrder.followUpSent) return;

      const s = strings[lang];
      const firstItem = order.items?.[0];
      const itemName = lang === 'fr' ? firstItem?.nameFr : firstItem?.nameEn;

      await wa.sendButtons(
        phone,
        s.followUp(itemName || 'meal'),
        [
          { id: 'RATE_5', title: '⭐⭐⭐⭐⭐ (5)' },
          { id: 'RATE_4', title: '⭐⭐⭐⭐ (4)' },
          { id: 'RATE_3', title: '⭐⭐⭐ (3)' },
        ]
      );
      // Second button message (max 3 per message)
      await wa.sendButtons(phone, '‎', [
        { id: 'RATE_2', title: '⭐⭐ (2)' },
        { id: 'RATE_1', title: '⭐ (1)' },
      ]);

      await sm.updateSession(phone, {
        state: 'RATING',
        'data.pendingOrderId': orderId,
      });

      await Order.findByIdAndUpdate(orderId, { followUpSent: true });
    } catch (err) {
      logger.error('Follow-up error: ' + err.message);
    } finally {
      pendingFollowUps.delete(orderId);
    }
  }, 30 * 60 * 1000); // 30 minutes

  pendingFollowUps.set(orderId, timer);
}

/**
 * On startup: re-queue follow-ups for orders delivered < 30 min ago
 */
async function rehydrateFollowUps() {
  try {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const orders = await Order.find({
      status: { $in: ['PAID', 'DELIVERED'] },
      followUpSent: false,
      createdAt: { $gte: thirtyMinsAgo },
    });

    for (const order of orders) {
      const elapsed = Date.now() - new Date(order.createdAt).getTime();
      const remaining = Math.max(0, 30 * 60 * 1000 - elapsed);

      if (remaining > 0) {
        await scheduleFollowUp(order.phone, order.lang || 'en', order);
        logger.info(`Rehydrated follow-up for order ${order._id} (${Math.round(remaining / 60000)}min remaining)`);
      }
    }
  } catch (err) {
    logger.error('Follow-up rehydration error: ' + err.message);
  }
}

module.exports = { scheduleFollowUp, rehydrateFollowUps };
