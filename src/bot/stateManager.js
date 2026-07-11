/**
 * State Manager — Read/write conversation sessions from MongoDB
 */
const Session = require('../models/Session');
const User = require('../models/User');
const logger = require('../utils/logger');
const statsManager = require('../utils/statsManager');

/**
 * Get or create a session for a given phone number.
 */
async function getSession(phone) {
  let session = await Session.findOne({ phone });
  if (!session) {
    const user = await User.findOne({ phone });
    const userLang = user?.language || 'en';
    session = await Session.create({ phone, state: 'IDLE', lang: userLang, cart: [], data: {} });
    logger.debug(`New session created for ${phone} (lang: ${userLang})`);
  }
  return session;
}

/**
 * Update session state and/or data fields.
 */
async function updateSession(phone, updates) {
  const result = await Session.findOneAndUpdate(
    { phone },
    { $set: { ...updates, updatedAt: new Date() } },
    { new: true, upsert: true }
  );
  return result;
}

/**
 * Add item to session cart.
 */
async function addToCart(phone, item) {
  const session = await getSession(phone);
  const existing = session.cart.find((c) => c.itemId?.toString() === item.itemId?.toString());
  if (existing) {
    existing.quantity += item.quantity || 1;
    await session.save();
  } else {
    session.cart.push({ ...item, quantity: item.quantity || 1 });
    await session.save();
  }
  return session;
}

/**
 * Clear session cart.
 */
async function clearCart(phone) {
  return updateSession(phone, { cart: [], data: {} });
}

/**
 * Reset session to idle (e.g. after order complete or user says CANCEL).
 */
async function resetSession(phone) {
  return updateSession(phone, { state: 'IDLE', cart: [], data: {} });
}

/**
 * Get or create User record.
 */
async function getOrCreateUser(phone) {
  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({ phone });
    await statsManager.onUserCreated();
    logger.info(`New user registered: ${phone}`);
  }
  return user;
}

module.exports = { getSession, updateSession, addToCart, clearCart, resetSession, getOrCreateUser };
