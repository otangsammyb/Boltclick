/**
 * Delivery / Pickup Handler — location, fee calculation
 */
const wa = require('../whatsapp');
const sm = require('../stateManager');
const strings = require('../language/strings');
const { haversine } = require('../../utils/haversine');
const { restaurant } = require('../../config/env');
const { handlePaymentStart } = require('./payment');
const { totalTables } = restaurant;

async function handleDeliveryChoice(phone, lang, choice) {
  const s = strings[lang];

  if (choice === 'FULFILL_IN_RESTAURANT') {
    await sm.updateSession(phone, { 'data.deliveryChoice': 'in_restaurant', state: 'AWAITING_TABLE_NUMBER' });
    await wa.sendText(phone, s.askTableNumber);
    return;
  }

  if (choice === 'FULFILL_PICKUP') {
    await sm.updateSession(phone, { 'data.deliveryChoice': 'pickup', state: 'PAYMENT_NUMBER' });
    await wa.sendText(phone, s.pickupConfirm(restaurant.address));
    await wa.sendText(phone, s.askPaymentNumber);
    return;
  }

  // Delivery → ask for live location
  await sm.updateSession(phone, { 'data.deliveryChoice': 'delivery', state: 'AWAITING_LOCATION' });
  await wa.sendText(phone, s.askLocation);
}

async function handleLocationReceived(phone, lang, session, lat, lng) {
  const s = strings[lang];

  const restLat = restaurant.lat;
  const restLng = restaurant.lng;

  const km = haversine(restLat, restLng, lat, lng);
  const deliveryFee = Math.round(km * restaurant.deliveryFeePerKm);
  const subtotal = session.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = subtotal + deliveryFee;

  await sm.updateSession(phone, {
    'data.deliveryLat': lat,
    'data.deliveryLng': lng,
    'data.distanceKm': km,
    'data.deliveryFee': deliveryFee,
    state: 'PAYMENT_NUMBER',
  });

  await wa.sendText(phone, s.locationReceived(km, deliveryFee, total));
  await wa.sendText(phone, s.askPaymentNumber);
}

async function handleTableNumber(phone, lang, text) {
  const s = strings[lang];
  const num = parseInt(text.trim(), 10);

  if (isNaN(num) || num < 1 || num > totalTables) {
    await wa.sendText(phone, s.invalidTableNumber(totalTables));
    return; // stay in AWAITING_TABLE_NUMBER state
  }

  await sm.updateSession(phone, { 'data.tableNumber': num, state: 'PAYMENT_NUMBER' });
  await wa.sendText(phone, s.askPaymentNumber);
}

module.exports = { handleDeliveryChoice, handleLocationReceived, handleTableNumber };
