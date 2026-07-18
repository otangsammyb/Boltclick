/**
 * Payment Handler — CamPay MTN/Orange Money flow
 */
const wa = require('../whatsapp');
const sm = require('../stateManager');
const strings = require('../language/strings');
const { detectCarrier } = require('../../utils/carrier');
const campay = require('../../payments/campay');
const Order = require('../../models/Order');
const Transaction = require('../../models/Transaction');
const Commission = require('../../models/Commission');
const User = require('../../models/User');
const generateReceipt = require('../../pdf/receipt');
const smartRouting = require('../../routing/smartRouting');
const { scheduleFollowUp } = require('../../scheduler/followUp');
const { restaurant, baseUrl } = require('../../config/env');
const logger = require('../../utils/logger');
const { downloadFile } = require('../../utils/fileStorage');
const statsManager = require('../../utils/statsManager');

const COMMISSION_RATE = 0.015; // 1.5%
const FOOTER = 'Powered by BoltClick';

async function handlePaymentStart(phone, lang, session, paymentPhone) {
  const s = strings[lang];

  // Guard: cart must exist and have items
  if (!session.cart || session.cart.length === 0) {
    return wa.sendText(phone, s.cartEmpty);
  }

  const carrier = detectCarrier(paymentPhone);

  if (carrier === 'UNKNOWN') {
    return wa.sendText(phone, s.unknownCarrier);
  }

  // Calculate totals
  const subtotal = session.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = session.data?.deliveryFee || 0;
  const total = subtotal + deliveryFee;

  // Get or create user — prevents crash if the user record doesn't exist yet
  const user = await sm.getOrCreateUser(phone);
  const orderItems = session.cart.map((i) => ({
    menuItemId: i.itemId,
    nameEn: i.nameEn,
    nameFr: i.nameFr,
    price: i.price,
    quantity: i.quantity,
    subtotal: i.price * i.quantity,
  }));

  const commissionAmount = parseFloat((total * COMMISSION_RATE).toFixed(2));

  const order = await Order.create({
    userId: user._id,
    phone,
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    commissionAmount,
    status: 'PENDING',
    fulfillmentType: session.data?.deliveryChoice || 'pickup',
    tableNumber: session.data?.tableNumber || null,
    deliveryAddress: session.data?.deliveryAddress || '',
    deliveryLat: session.data?.deliveryLat || null,
    deliveryLng: session.data?.deliveryLng || null,
    distanceKm: session.data?.distanceKm || null,
    paymentMethod: carrier,
    paymentPhone,
    lang,
  });

  // Materialized Stats: Record new order
  await statsManager.onOrderCreated(total, 'PENDING');

  // Initiate CamPay collect
  let campayRef = null;
  try {
    const { normalizePhone } = require('../../utils/carrier');
    const normalizedFrom = '237' + normalizePhone(paymentPhone);
    const result = await campay.initiateCollection({
      amount: total,
      currency: 'XAF',
      from: normalizedFrom,
      description: `Order #${order._id} — ${restaurant.name}`,
      externalRef: order._id.toString(),
    });
    campayRef = result.reference;

    await Transaction.create({
      orderId: order._id,
      phone,
      campayRef,
      carrier,
      amount: total,
      status: 'PENDING',
      rawResponse: result,
    });

    await Order.findByIdAndUpdate(order._id, { campayRef });
  } catch (err) {
    const errorData = err.response?.data;
    const specificMessage = errorData?.message || errorData?.detail || err.message;
    logger.error('CamPay initiation error: ' + specificMessage);
    await Order.findByIdAndUpdate(order._id, { status: 'CANCELLED' });
    await statsManager.onOrderStatusChange('PENDING', 'CANCELLED', total);
    return wa.sendText(phone, `❌ Payment system error: ${specificMessage}. Please try again later.`);
  }

  await sm.updateSession(phone, {
    'data.paymentPhone': paymentPhone,
    'data.carrier': carrier,
    'data.campayRef': campayRef,
    'data.pendingOrderId': order._id,
    state: 'AWAITING_PAYMENT_CONFIRM',
  });

  await wa.sendButtons(phone, s.paymentPushed(carrier, total), [
    { id: 'PAY_CONFIRM', title: s.btnPaid },
    { id: 'PAY_CANCEL', title: s.btnCancel },
  ], { headerText: restaurant.name, footerText: FOOTER });
}

async function handlePaymentConfirmation(phone, lang, session) {
  const s = strings[lang];
  const { campayRef, pendingOrderId } = session.data || {};

  if (!campayRef || !pendingOrderId) {
    return wa.sendText(phone, s.orderCancelled);
  }

  let paymentStatus;
  try {
    paymentStatus = await campay.checkStatus(campayRef);
  } catch (err) {
    logger.error('CamPay status check error: ' + err.message);
    return wa.sendButtons(phone, s.paymentFailed, [
      { id: 'PAY_RETRY', title: s.btnRetry },
      { id: 'PAY_CANCEL', title: s.btnCancel },
    ], { footerText: FOOTER });
  }

  if (paymentStatus.status === 'SUCCESSFUL') {
    // Mark order paid
    const order = await Order.findByIdAndUpdate(
      pendingOrderId,
      { status: 'PAID' },
      { new: true }
    );

    // ── Send the success message to the user IMMEDIATELY ─────────────────────
    // All remaining work (stats, commission, receipt, routing, follow-up) is
    // deferred to a background task so the user doesn't wait for it.
    await wa.sendText(phone, s.paymentSuccess);
    await sm.resetSession(phone);

    // ── Non-critical background work ──────────────────────────────────────────
    setImmediate(async () => {
      try {
        // Update transaction record
        await Transaction.findOneAndUpdate(
          { orderId: pendingOrderId },
          { status: 'SUCCESSFUL', campayTransactionId: paymentStatus.operator_tx_id }
        );

        // Materialized Stats: status transition PENDING -> PAID (Revenue!)
        await statsManager.onOrderStatusChange('PENDING', 'PAID', order.total);

        // Record platform commission (1.5%)
        try {
          await Commission.create({
            orderId: order._id,
            restaurantPhone: restaurant.phone || '',
            orderTotal: order.total,
            commissionRate: COMMISSION_RATE,
            commissionAmount: order.commissionAmount,
            status: 'EARNED',
            earnedAt: new Date(),
          });
        } catch (err) {
          logger.error('Commission recording error: ' + err.message);
        }

        // Update user stats
        await User.findOneAndUpdate(
          { phone },
          { $inc: { totalOrders: 1, totalSpent: order.total }, $set: { lastOrderId: order._id } }
        );

        // Generate & send PDF receipt
        try {
          const { fileId, filename } = await generateReceipt(order);
          const pdfBuffer = await downloadFile(fileId);
          await wa.sendBufferDocument(phone, pdfBuffer, filename);
          await Order.findByIdAndUpdate(pendingOrderId, { receiptUrl: `gridfs://${fileId}` });
        } catch (err) {
          logger.error('Receipt generation error: ' + err.message);
        }

        // Smart routing
        await smartRouting.checkAndGroup(order);

        // Schedule 30-min follow-up
        await scheduleFollowUp(phone, lang, order);
      } catch (bgErr) {
        logger.error('Background post-payment error: ' + bgErr.message);
      }
    });
  } else {
    await wa.sendButtons(phone, s.paymentFailed, [
      { id: 'PAY_RETRY', title: s.btnRetry },
      { id: 'PAY_CANCEL', title: s.btnCancel },
    ], { footerText: FOOTER });
  }
}

module.exports = { handlePaymentStart, handlePaymentConfirmation };
