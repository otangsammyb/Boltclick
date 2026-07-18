/**
 * Greeting Handler — first contact + language selection
 */
const wa = require('../whatsapp');
const sm = require('../stateManager');
const strings = require('../language/strings');
const { restaurant } = require('../../config/env');

const FOOTER = 'Powered by BoltClick';

async function handleGreeting(phone) {
  await sm.getOrCreateUser(phone);
  const session = await sm.getSession(phone);
  
  const lang = session.lang || 'en';
  const s = strings[lang];
  const welcomeText = s.welcome.replace('{restaurantName}', restaurant.name);

  // Set state to LANG_SELECT before sending buttons to handle immediate clicks
  await sm.updateSession(phone, { state: 'LANG_SELECT' });
  await wa.sendButtons(phone, welcomeText, [
    { id: 'LANG_EN', title: s.btnEnglish },
    { id: 'LANG_FR', title: s.btnFrench },
  ], { headerText: restaurant.name, footerText: FOOTER });
}

async function handleLangSelect(phone, selectedId) {
  const lang = selectedId === 'LANG_FR' ? 'fr' : 'en';
  const User = require('../../models/User');
  await User.findOneAndUpdate({ phone }, { language: lang });
  await sm.updateSession(phone, { lang, state: 'MAIN_MENU' });
  await showMainMenu(phone, lang);
}

async function showMainMenu(phone, lang) {
  const s = strings[lang];
  await wa.sendList(
    phone,
    s.mainMenu,
    '📋 Options',
    [
      {
        title: 'Menu',
        rows: [
          { id: 'MENU_ORDER', title: s.btnOrder, description: '' },
          { id: 'MENU_BOOK', title: s.btnBook, description: '' },
          { id: 'MENU_USUAL', title: s.btnUsual, description: '' },
          { id: 'MENU_HUMAN', title: s.btnHuman, description: '' },
        ],
      },
    ],
    { headerText: restaurant.name, footerText: FOOTER }
  );
  await sm.updateSession(phone, { state: 'MAIN_MENU' });
}

module.exports = { handleGreeting, handleLangSelect, showMainMenu };
