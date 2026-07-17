/**
 * Menu & Ordering Handler
 */
const wa = require('../whatsapp');
const sm = require('../stateManager');
const strings = require('../language/strings');
const MenuItem = require('../../models/MenuItem');
const { restaurant } = require('../../config/env');

const FOOTER = 'Powered by BoltClick';

async function showMenu(phone, lang) {
  const s = strings[lang];
  const items = await MenuItem.find({ available: true }).sort({ sortOrder: 1, category: 1 });

  if (items.length === 0) {
    return wa.sendText(phone, lang === 'fr' ? 'Aucun article disponible pour le moment.' : 'No items available at the moment.');
  }

  // Send menu image if available
  if (restaurant.menuImageUrl) {
    await wa.sendImage(phone, restaurant.menuImageUrl, restaurant.name + ' Menu');
  }

  // Group items by category
  const categories = {};
  items.forEach((item) => {
    const cat = item.category || 'Main';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({
      id: `ITEM_${item._id}`,
      title: (lang === 'fr' ? item.nameFr : item.nameEn).substring(0, 24),
      description: `${item.price.toLocaleString()} FCFA`,
    });
  });

  const sections = Object.entries(categories).map(([title, rows]) => ({ title, rows }));

  await wa.sendList(phone, s.menuPrompt, s.selectItems, sections, {
    headerText: restaurant.name,
    footerText: FOOTER,
  });
  await sm.updateSession(phone, { state: 'ORDERING' });
}

async function handleItemSelect(phone, lang, session, itemId) {
  const s = strings[lang];
  const item = await MenuItem.findById(itemId);
  if (!item) {
    return wa.sendText(phone, s.invalidInput);
  }

  await sm.addToCart(phone, {
    itemId: item._id,
    nameEn: item.nameEn,
    nameFr: item.nameFr,
    price: item.price,
    quantity: 1,
  });

  const updatedSession = await sm.getSession(phone);
  const cart = updatedSession.cart;
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartText = s.cartSummary(cart, subtotal);

  await wa.sendButtons(phone, cartText, [
    { id: 'CART_ADD_MORE', title: s.btnAddMore },
    { id: 'CART_CHECKOUT', title: s.btnCheckout },
  ], { footerText: FOOTER });
}

async function handleCheckout(phone, lang, session) {
  const s = strings[lang];
  if (!session.cart || session.cart.length === 0) {
    return wa.sendText(phone, s.cartEmpty);
  }
  await wa.sendButtons(phone, s.deliveryChoice, [
    { id: 'FULFILL_DELIVERY', title: s.btnDelivery },
    { id: 'FULFILL_PICKUP', title: s.btnPickup },
    { id: 'FULFILL_IN_RESTAURANT', title: s.btnInRestaurant },
  ], { headerText: restaurant.name, footerText: FOOTER });
  await sm.updateSession(phone, { state: 'DELIVERY_CHOICE' });
}

module.exports = { showMenu, handleItemSelect, handleCheckout };
