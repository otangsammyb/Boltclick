/**
 * CamPay Webhook — payment status callback
 */
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const generateReceipt = require('../pdf/receipt');
const smartRouting = require('../routing/smartRouting');
const { scheduleFollowUp } = require('../scheduler/followUp');
const wa = require('../bot/whatsapp');
const strings = require('../bot/language/strings');
const sm = require('../bot/stateManager');
const { baseUrl } = require('../config/env');
const logger = require('../utils/logger');
const path = require('path');

router.post('/', async (req, res) => {
  res.sendStatus(200); // Always ACK quickly

  const { reference, status, operator_tx_id, amount, operator } = req.body;
  logger.info(`CamPay webhook: ref=${reference} status=${status}`);

  if (!reference) return;

  const txn = await Transaction.findOne({ campayRef: reference });
  if (!txn) return logger.warn(`No transaction found for ref: ${reference}`);

  if (status === 'SUCCESSFUL') {
    const order = await Order.findByIdAndUpdate(txn.orderId, { status: 'PAID' }, { new: true });
    await Transaction.findByIdAndUpdate(txn._id, { status: 'SUCCESSFUL', campayTransactionId: operator_tx_id });

    if (!order) return;

    // Update user stats
    await User.findOneAndUpdate(
      { phone: order.phone },
      { $inc: { totalOrders: 1, totalSpent: order.total }, $set: { lastOrderId: order._id } }
    );

    // Notify customer
    const lang = order.lang || 'en';
    const s = strings[lang];
    await wa.sendText(order.phone, s.paymentSuccess);

    // Generate & send PDF receipt
    try {
      const receiptPath = await generateReceipt(order);
      const localFilePath = path.join(__dirname, '../../public/receipts', receiptPath);
      const receiptUrl = `${baseUrl}/receipts/${receiptPath}`;
      await Order.findByIdAndUpdate(order._id, { receiptUrl });
      await wa.sendLocalDocument(order.phone, localFilePath, `Receipt-${order._id}.pdf`);
    } catch (e) {
      logger.error('Receipt error: ' + e.message);
    }

    await smartRouting.checkAndGroup(order);
    await scheduleFollowUp(order.phone, lang, order);
    await sm.resetSession(order.phone);

  } else if (status === 'FAILED') {
    const order = await Order.findById(txn.orderId);
    await Transaction.findByIdAndUpdate(txn._id, { status: 'FAILED' });
    if (order) {
      const lang = order.lang || 'en';
      const s = strings[lang];
      await wa.sendText(order.phone, s.paymentFailed);
    }
  }
});

module.exports = router;
