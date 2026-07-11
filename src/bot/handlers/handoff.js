/**
 * Human Handoff Handler
 */
const wa = require('../whatsapp');
const sm = require('../stateManager');
const strings = require('../language/strings');
const Handoff = require('../../models/Handoff');
const User = require('../../models/User');
const { meta } = require('../../config/env');
const statsManager = require('../../utils/statsManager');

async function handleHandoff(phone, lang) {
  const s = strings[lang];
  const user = await User.findOne({ phone });

  await Handoff.create({ userId: user._id, phone });
  await statsManager.onHandoffChange(1);
  await sm.updateSession(phone, { state: 'HANDOFF' });
  await wa.sendText(phone, s.handoffMessage);

  // Notify admin
  if (meta.adminWhatsapp) {
    try {
      await wa.sendText(meta.adminWhatsapp, s.handoffAdmin(phone));
    } catch (_) {}
  }
}

/**
 * Rating Handler — triggered by scheduler after delivery
 */
const Rating = require('../../models/Rating');

async function handleRating(phone, lang, session, score, orderId) {
  const s = strings[lang];
  const user = await User.findOne({ phone });
  const numScore = parseInt(score, 10);

  if (numScore >= 1 && numScore <= 5) {
    await Rating.create({ orderId, userId: user._id, phone, score: numScore });
    await statsManager.onRatingCreated(numScore);
    await sm.resetSession(phone);
    return wa.sendText(phone, s.ratingThanks);
  }
  await wa.sendText(phone, s.invalidInput);
}

module.exports = { handleHandoff, handleRating };
