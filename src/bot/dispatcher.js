/**
 * Central Message Dispatcher — routes incoming events to the correct handler
 * based on session state.
 */
const sm = require('./stateManager');
const wa = require('./whatsapp');
const strings = require('./language/strings');
const { handleGreeting, handleLangSelect, showMainMenu } = require('./handlers/greeting');
const { showMenu, handleItemSelect, handleCheckout } = require('./handlers/ordering');
const { handleDeliveryChoice, handleLocationReceived, handleTableNumber } = require('./handlers/delivery');
const { handlePaymentStart, handlePaymentConfirmation } = require('./handlers/payment');
const {
  handleBookingStart,
  handleBookingDate,
  handleBookingTime,
  handleBookingGuests,
  handleBookingConfirm,
} = require('./handlers/booking');
const { handleTheUsual, handleTheUsualConfirm } = require('./handlers/theUsual');
const { handleHandoff, handleRating } = require('./handlers/handoff');
const logger = require('../utils/logger');

/**
 * Parse a Meta Cloud API incoming event payload and extract message data.
 */
function parseIncoming(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg) return null;

    const phone = msg.from;
    const msgId = msg.id;
    const type = msg.type; // text | interactive | location | button

    // Ignore system messages, reactions, and unknown types that aren't user input
    const ignoredTypes = ['system', 'reaction', 'unknown', 'ephemeral', 'image', 'video', 'audio', 'document', 'sticker'];
    if (ignoredTypes.includes(type)) return null;

    let text = '';
    let buttonId = '';
    let listId = '';
    let location = null;

    if (type === 'text') {
      text = msg.text?.body?.trim() || '';
    } else if (type === 'interactive') {
      if (msg.interactive?.type === 'button_reply') {
        buttonId = msg.interactive.button_reply.id;
        text = msg.interactive.button_reply.title;
      } else if (msg.interactive?.type === 'list_reply') {
        listId = msg.interactive.list_reply.id;
        text = msg.interactive.list_reply.title;
      }
    } else if (type === 'location') {
      location = { lat: msg.location.latitude, lng: msg.location.longitude };
    }

    return { phone, msgId, type, text, buttonId, listId, location };
  } catch (err) {
    logger.error('Parse incoming error: ' + err.message);
    return null;
  }
}

/**
 * Main dispatch function — called for every incoming message event.
 */
async function dispatch(body) {
  const parsed = parseIncoming(body);
  if (!parsed) return;

  const { phone, msgId, type, text, buttonId, listId, location } = parsed;

  // Mark as read
  await wa.markRead(msgId).catch(() => {});

  // Get session
  const session = await sm.getSession(phone);
  const lang = session.lang || 'en';
  const state = session.state || 'IDLE';
  const s = strings[lang];

  // Global cancel / restart / stop keywords — work from ANY state
  const lowerText = text.toLowerCase();
  const RESET_WORDS = [
    'cancel', 'annuler',
    'menu',
    'start', 'restart', 'début', 'recommencer',
    'stop', 'arrêter', 'arreter',
    'end', 'fin',
    'quit', 'quitter',
    'home', 'accueil',
  ];

  // Global cancel / restart / stop keywords — work from ANY state
  // Only applies to plain text messages (empty string means the user tapped a button)
  if (lowerText && RESET_WORDS.includes(lowerText)) {
    await sm.resetSession(phone);
    return showMainMenu(phone, lang);
  }

  // Quick Table Order shortcut: "Order for Table X" / "Commande pour la table X"
  const tableOrderMatch =
    lowerText.match(/^order for table\s+(\d+)$/i) ||
    lowerText.match(/^commande pour la table\s+(\d+)$/i);
  if (tableOrderMatch) {
    const tableNum = tableOrderMatch[1];
    await sm.clearCart(phone);
    await sm.updateSession(phone, {
      state: 'ORDERING',
      'data.deliveryChoice': 'in_restaurant',
      'data.tableNumber': tableNum,
    });
    return showMenu(phone, lang);
  }

  // --- Route by state ---
  switch (state) {
    case 'IDLE':
      return handleGreeting(phone);

    case 'LANG_SELECT': {
      const isEnglish = buttonId === 'LANG_EN' || lowerText === 'english';
      const isFrench = buttonId === 'LANG_FR' || ['french', 'français', 'francais'].includes(lowerText);
      
      if (isEnglish) return handleLangSelect(phone, 'LANG_EN');
      if (isFrench) return handleLangSelect(phone, 'LANG_FR');
      
      return handleGreeting(phone);
    }

    case 'MAIN_MENU':
      if (listId === 'MENU_ORDER' || buttonId === 'MENU_ORDER') return showMenu(phone, lang);
      if (listId === 'MENU_BOOK' || buttonId === 'MENU_BOOK') return handleBookingStart(phone, lang);
      if (listId === 'MENU_USUAL' || buttonId === 'MENU_USUAL') return handleTheUsual(phone, lang);
      if (listId === 'MENU_HUMAN' || buttonId === 'MENU_HUMAN') return handleHandoff(phone, lang);
      return wa.sendText(phone, s.invalidInput);

    case 'ORDERING':
      if (listId && listId.startsWith('ITEM_')) {
        const itemId = listId.replace('ITEM_', '');
        return handleItemSelect(phone, lang, session, itemId);
      }
      if (buttonId === 'CART_ADD_MORE') return showMenu(phone, lang);
      if (buttonId === 'CART_CHECKOUT') {
        const freshSession = await sm.getSession(phone);
        return handleCheckout(phone, lang, freshSession);
      }
      // User typed text instead of selecting from menu
      return wa.sendText(phone, s.invalidInput);

    case 'DELIVERY_CHOICE':
      if (buttonId === 'FULFILL_DELIVERY' || buttonId === 'FULFILL_PICKUP' || buttonId === 'FULFILL_IN_RESTAURANT') {
        return handleDeliveryChoice(phone, lang, buttonId);
      }
      return wa.sendText(phone, s.invalidInput);

    case 'AWAITING_LOCATION':
      if (type === 'location' && location) {
        return handleLocationReceived(phone, lang, session, location.lat, location.lng);
      }
      return wa.sendText(phone, s.askLocation);

    case 'AWAITING_TABLE_NUMBER':
      if (text) return handleTableNumber(phone, lang, text);
      return wa.sendText(phone, s.askTableNumber);

    case 'PAYMENT_NUMBER':
      if (text && text.trim()) return handlePaymentStart(phone, lang, session, text.trim());
      return wa.sendText(phone, s.askPaymentNumber);

    case 'AWAITING_PAYMENT_CONFIRM':
      if (buttonId === 'PAY_CONFIRM') return handlePaymentConfirmation(phone, lang, session);
      if (buttonId === 'PAY_CANCEL') {
        await sm.resetSession(phone);
        return wa.sendText(phone, s.orderCancelled);
      }
      if (buttonId === 'PAY_RETRY') {
        await sm.updateSession(phone, { state: 'PAYMENT_NUMBER' });
        return wa.sendText(phone, s.askPaymentNumber);
      }
      // Re-send payment confirmation prompt so user knows what to tap
      await wa.sendButtons(phone, s.paymentFailed, [
        { id: 'PAY_CONFIRM', title: s.btnPaid },
        { id: 'PAY_CANCEL', title: s.btnCancel },
      ], { footerText: 'Powered by BoltClick' });
      break;

    case 'BOOKING_DATE':
      return handleBookingDate(phone, lang, text);

    case 'BOOKING_TIME':
      return handleBookingTime(phone, lang, text);

    case 'BOOKING_GUESTS':
      return handleBookingGuests(phone, lang, text, session);

    case 'BOOKING_CONFIRM':
      if (buttonId === 'BOOKING_YES') return handleBookingConfirm(phone, lang, session);
      if (buttonId === 'BOOKING_NO') {
        await sm.resetSession(phone);
        return showMainMenu(phone, lang);
      }
      // Re-send booking confirm prompt
      return wa.sendText(phone, s.invalidInput);

    case 'THE_USUAL':
      return handleTheUsualConfirm(phone, lang, session, buttonId);

    case 'RATING':
      const ratingScore = buttonId?.replace('RATE_', '') || text;
      return handleRating(phone, lang, session, ratingScore, session.data?.pendingOrderId);

    case 'HANDOFF':
      return wa.sendText(phone, s.handoffMessage);

    default:
      await sm.resetSession(phone);
      return handleGreeting(phone);
  }
}

module.exports = { dispatch, parseIncoming };
