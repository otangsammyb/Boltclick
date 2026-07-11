/**
 * "The Usual" — Re-order last completed order
 */
const wa = require('../whatsapp');
const sm = require('../stateManager');
const strings = require('../language/strings');
const Order = require('../../models/Order');
const User = require('../../models/User');

async function handleTheUsual(phone, lang) {
  const s = strings[lang];
  const user = await User.findOne({ phone });
  if (!user) return showMenu(phone, lang);

  const lastOrder = await Order.findOne({
    userId: user._id,
    status: { $in: ['PAID', 'DELIVERED'] },
  }).sort({ createdAt: -1 });

  if (!lastOrder) {
    await wa.sendText(phone, s.theUsualNotFound);
    const { showMenu } = require('./ordering');
    return showMenu(phone, lang);
  }

  const summary = lastOrder.items
    .map((i) => `• ${lang === 'fr' ? i.nameFr : i.nameEn} x${i.quantity} — ${(i.price * i.quantity).toLocaleString()} FCFA`)
    .join('\n');
  const total = `💰 Total: ${lastOrder.total.toLocaleString()} FCFA`;

  await wa.sendButtons(phone, s.theUsualFound(`${summary}\n${total}`), [
    { id: 'USUAL_YES', title: s.btnYes },
    { id: 'USUAL_NO', title: s.btnNo },
  ]);

  await sm.updateSession(phone, {
    state: 'THE_USUAL',
    'data.pendingOrderId': lastOrder._id,
  });
}

async function handleTheUsualConfirm(phone, lang, session, choice) {
  if (choice === 'USUAL_YES') {
    // Pre-fill cart from last order
    const lastOrder = await Order.findById(session.data?.pendingOrderId);
    if (!lastOrder) {
      const { showMenu } = require('./ordering');
      return showMenu(phone, lang);
    }

    const cart = lastOrder.items.map((i) => ({
      itemId: i.menuItemId,
      nameEn: i.nameEn,
      nameFr: i.nameFr,
      price: i.price,
      quantity: i.quantity,
    }));

    await sm.updateSession(phone, { cart, state: 'DELIVERY_CHOICE' });

    const { handleCheckout } = require('./ordering');
    const updatedSession = await sm.getSession(phone);
    await handleCheckout(phone, lang, updatedSession);
  } else {
    const { showMenu } = require('./ordering');
    await showMenu(phone, lang);
  }
}

module.exports = { handleTheUsual, handleTheUsualConfirm };
