/**
 * Language strings — English & French
 * All bot messages are defined here for easy translation.
 * Uses WhatsApp markdown: *bold*, _italic_, ```code```, dividers
 */

const DIV = '─────────────────────';

const strings = {
  en: {
    welcome:
      `🍽️ *Welcome to {restaurantName}*\n${DIV}\nWe're delighted to have you here!\n\nPlease choose your preferred language to get started:`,

    mainMenu:
      `*What would you like to do?*\n${DIV}\nChoose an option below and we'll take care of the rest.`,

    menuPrompt:
      `🍽️ *Our Menu*\n${DIV}\nBrowse our selection and tap any item to add it to your order.\n\n_All prices include applicable taxes._`,

    cartEmpty:
      `🛒 *Your cart is empty*\n${DIV}\nPlease select at least one item from our menu to continue.`,

    cartSummary: (items, subtotal) =>
      `🛒 *Your Order Summary*\n${DIV}\n${items
        .map((i) => `  • *${i.nameEn}*  ×${i.quantity}\n    ${(i.price * i.quantity).toLocaleString()} FCFA`)
        .join('\n')}\n${DIV}\n💰 *Subtotal: ${subtotal.toLocaleString()} FCFA*`,

    deliveryChoice:
      `📦 *Fulfilment Options*\n${DIV}\nHow would you like to receive your order?`,

    askLocation:
      `📍 *Share Your Location*\n${DIV}\nSo we can calculate your delivery fee, please send your current location.\n\n_In WhatsApp: tap 📎 → Location → Send Your Current Location_`,

    locationReceived: (km, fee, total) =>
      `✅ *Location Received*\n${DIV}\n📍 Distance: *${km.toFixed(1)} km*\n🚗 Delivery fee: *${fee.toLocaleString()} FCFA*\n${DIV}\n💰 *Order Total: ${total.toLocaleString()} FCFA*`,

    pickupConfirm: (address) =>
      `🏪 *Pickup Location*\n${DIV}\n${address}\n${DIV}\nPlease come to collect your order at the address above.\n\nProceed to payment?`,

    askPaymentNumber:
      `💳 *Mobile Payment*\n${DIV}\nEnter the phone number linked to your *MTN MoMo* or *Orange Money* account:\n\n_Example: 6XXXXXXXX_`,

    unknownCarrier:
      `❌ *Operator Not Recognised*\n${DIV}\nWe could not detect your operator (MTN or Orange).\n\nPlease enter a valid Cameroon number _(e.g. 677123456 or 699123456)_.`,

    paymentPushed: (carrier, amount) =>
      `📲 *Payment Request Sent*\n${DIV}\nA *${carrier} Mobile Money* request for\n💰 *${amount.toLocaleString()} FCFA*\nhas been sent to your phone.\n${DIV}\n_Please approve the prompt on your handset, then tap the button below to confirm._`,

    paymentSuccess:
      `🎉 *Payment Confirmed!*\n${DIV}\nThank you — your order is now being prepared with care.\n\nYour official receipt will be sent to you shortly. 🧾\n${DIV}\n_We appreciate your business!_ 🙏`,

    paymentFailed:
      `⚠️ *Payment Not Confirmed*\n${DIV}\nWe could not verify your payment yet.\nThis can happen if the request is still pending.\n\nWhat would you like to do?`,

    orderCancelled:
      `🚫 *Order Cancelled*\n${DIV}\nYour order has been cancelled. No charge has been made.\n\nType anything to start a new order.`,

    followUp: (item) =>
      `😊 *How Was Your Experience?*\n${DIV}\nWe hope you enjoyed your *${item}*!\n\nPlease rate your experience:`,

    ratingThanks:
      `⭐ *Thank You for Your Feedback!*\n${DIV}\nYour review helps us serve you better.\n\nWe look forward to welcoming you again! 😊`,

    bookingTablesFull:
      `😔 *Fully Booked*\n${DIV}\nWe're sorry — all tables are booked for that date.\n\nPlease try a different date or contact us directly.`,

    askBookingDate:
      `📅 *Table Reservation*\n${DIV}\nWhat date would you like to reserve a table?\n\n_Format: DD/MM/YYYY (e.g. 15/06/2026)_`,

    invalidDate:
      `❌ *Invalid Date*\n${DIV}\nPlease use the format *DD/MM/YYYY*.\n_Example: 15/06/2026_`,

    askBookingTime:
      `🕐 *Preferred Time*\n${DIV}\nAt what time would you like your table?\n\n_Format: HH:MM in 24-hour time (e.g. 19:30)_`,

    invalidTime:
      `❌ *Invalid Time*\n${DIV}\nPlease use *HH:MM* format in 24-hour time.\n_Example: 19:30_`,

    askBookingGuests:
      `👥 *Number of Guests*\n${DIV}\nHow many people will be joining you?`,

    bookingConfirm: (date, time, guests) =>
      `📋 *Booking Summary*\n${DIV}\n📅 Date: *${date}*\n🕐 Time: *${time}*\n👥 Guests: *${guests}*\n${DIV}\nDo you confirm this reservation?`,

    bookingDone:
      `✅ *Table Reserved!*\n${DIV}\nYour reservation is confirmed. Your booking receipt is on its way!\n\nWe look forward to seeing you. 🍽️`,

    theUsualNotFound:
      `📋 *No Previous Orders*\n${DIV}\nYou don't have any previous orders with us yet.\n\nLet's start your first order!`,

    theUsualFound: (summary) =>
      `🔁 *Your Last Order*\n${DIV}\n${summary}\n${DIV}\nWould you like to re-order this?`,

    handoffMessage:
      `🧑 *Connecting You to Our Team*\n${DIV}\nA team member will reach out to you shortly.\n\nThank you for your patience! 🙏`,

    handoffAdmin: (phone) =>
      `⚠️ *Human Handoff Request*\n${DIV}\nCustomer *${phone}* has requested to speak with a live agent.\nPlease respond at your earliest convenience.`,

    invalidInput:
      `🤔 *Unrecognised Input*\n${DIV}\nSorry, I didn't understand that.\n\nPlease choose from the options provided or type *menu* to return to the main menu.`,

    orderDelivery: 'Delivery',
    orderPickup: 'Pickup',
    btnOrder: '🍽️ Order Food',
    btnBook: '📅 Book a Table',
    btnUsual: '🔁 Reorder My Usual',
    btnHuman: '🎧 Speak to an Agent',
    btnEnglish: '🇬🇧 English',
    btnFrench: '🇫🇷 Français',
    btnPaid: "✅ I've Paid",
    btnRetry: '🔄 Try Again',
    btnCancel: '❌ Cancel',
    btnAddMore: '➕ Add Another Item',
    btnCheckout: '🛒 Proceed to Checkout',
    btnDelivery: '🚗 Home Delivery',
    btnPickup: '🏪 Self Pickup',
    btnInRestaurant: '🍽️ Dine In',
    askTableNumber: `🔢 *Table Number*\n${DIV}\nPlease enter your table number:`,
    invalidTableNumber: (max) =>
      `❌ *Invalid Table Number*\n${DIV}\nPlease enter a number between *1* and *${max}*.`,
    btnYes: '✅ Yes, Reorder',
    btnNo: '📋 Browse Full Menu',
    btnConfirm: '✅ Confirm Booking',
    selectItems: '📋 View Menu',
  },

  fr: {
    welcome:
      `🍽️ *Bienvenue chez {restaurantName}*\n${DIV}\nNous sommes ravis de vous accueillir!\n\nVeuillez choisir votre langue préférée pour commencer:`,

    mainMenu:
      `*Que souhaitez-vous faire?*\n${DIV}\nChoisissez une option ci-dessous et nous nous occupons du reste.`,

    menuPrompt:
      `🍽️ *Notre Menu*\n${DIV}\nParcourez notre sélection et appuyez sur un article pour l'ajouter à votre commande.\n\n_Tous les prix incluent les taxes applicables._`,

    cartEmpty:
      `🛒 *Votre panier est vide*\n${DIV}\nVeuillez sélectionner au moins un article du menu pour continuer.`,

    cartSummary: (items, subtotal) =>
      `🛒 *Récapitulatif de Commande*\n${DIV}\n${items
        .map((i) => `  • *${i.nameFr}*  ×${i.quantity}\n    ${(i.price * i.quantity).toLocaleString()} FCFA`)
        .join('\n')}\n${DIV}\n💰 *Sous-total: ${subtotal.toLocaleString()} FCFA*`,

    deliveryChoice:
      `📦 *Options de Livraison*\n${DIV}\nComment souhaitez-vous recevoir votre commande?`,

    askLocation:
      `📍 *Partagez Votre Position*\n${DIV}\nPour calculer vos frais de livraison, veuillez envoyer votre position actuelle.\n\n_Dans WhatsApp: appuyez sur 📎 → Localisation → Envoyer votre position actuelle_`,

    locationReceived: (km, fee, total) =>
      `✅ *Position Reçue*\n${DIV}\n📍 Distance: *${km.toFixed(1)} km*\n🚗 Frais de livraison: *${fee.toLocaleString()} FCFA*\n${DIV}\n💰 *Total de la commande: ${total.toLocaleString()} FCFA*`,

    pickupConfirm: (address) =>
      `🏪 *Adresse de Retrait*\n${DIV}\n${address}\n${DIV}\nVeuillez venir récupérer votre commande à l'adresse ci-dessus.\n\nProcéder au paiement?`,

    askPaymentNumber:
      `💳 *Paiement Mobile*\n${DIV}\nEntrez le numéro lié à votre compte *MTN MoMo* ou *Orange Money*:\n\n_Exemple: 6XXXXXXXX_`,

    unknownCarrier:
      `❌ *Opérateur Non Reconnu*\n${DIV}\nNous n'avons pas pu détecter votre opérateur (MTN ou Orange).\n\nVeuillez entrer un numéro camerounais valide _(ex: 677123456 ou 699123456)_.`,

    paymentPushed: (carrier, amount) =>
      `📲 *Demande de Paiement Envoyée*\n${DIV}\nUne demande de paiement *${carrier} Mobile Money* de\n💰 *${amount.toLocaleString()} FCFA*\na été envoyée sur votre téléphone.\n${DIV}\n_Veuillez approuver la notification sur votre appareil, puis appuyez sur le bouton ci-dessous pour confirmer._`,

    paymentSuccess:
      `🎉 *Paiement Confirmé!*\n${DIV}\nMerci — votre commande est en cours de préparation.\n\nVotre reçu officiel vous sera envoyé sous peu. 🧾\n${DIV}\n_Nous vous remercions de votre confiance!_ 🙏`,

    paymentFailed:
      `⚠️ *Paiement Non Confirmé*\n${DIV}\nNous n'avons pas encore pu vérifier votre paiement.\nCela peut survenir si la demande est encore en attente.\n\nQue souhaitez-vous faire?`,

    orderCancelled:
      `🚫 *Commande Annulée*\n${DIV}\nVotre commande a été annulée. Aucun débit n'a été effectué.\n\nTapez n'importe quoi pour passer une nouvelle commande.`,

    followUp: (item) =>
      `😊 *Comment s'est Passée Votre Expérience?*\n${DIV}\nNous espérons que vous avez apprécié votre *${item}*!\n\nÉvaluez votre expérience:`,

    ratingThanks:
      `⭐ *Merci pour Votre Avis!*\n${DIV}\nVotre retour nous aide à mieux vous servir.\n\nNous espérons vous revoir bientôt! 😊`,

    bookingTablesFull:
      `😔 *Complet*\n${DIV}\nNous sommes désolés — toutes les tables sont réservées pour cette date.\n\nVeuillez essayer une autre date ou nous contacter directement.`,

    askBookingDate:
      `📅 *Réservation de Table*\n${DIV}\nQuelle date souhaitez-vous réserver une table?\n\n_Format: JJ/MM/AAAA (ex: 15/06/2026)_`,

    invalidDate:
      `❌ *Date Invalide*\n${DIV}\nVeuillez utiliser le format *JJ/MM/AAAA*.\n_Exemple: 15/06/2026_`,

    askBookingTime:
      `🕐 *Heure Préférée*\n${DIV}\nÀ quelle heure souhaitez-vous votre table?\n\n_Format: HH:MM en format 24h (ex: 19:30)_`,

    invalidTime:
      `❌ *Heure Invalide*\n${DIV}\nVeuillez utiliser le format *HH:MM* en 24h.\n_Exemple: 19:30_`,

    askBookingGuests:
      `👥 *Nombre de Personnes*\n${DIV}\nCombien de personnes seront présentes?`,

    bookingConfirm: (date, time, guests) =>
      `📋 *Récapitulatif de la Réservation*\n${DIV}\n📅 Date: *${date}*\n🕐 Heure: *${time}*\n👥 Personnes: *${guests}*\n${DIV}\nConfirmez-vous cette réservation?`,

    bookingDone:
      `✅ *Table Réservée!*\n${DIV}\nVotre réservation est confirmée. Votre reçu de réservation est en chemin!\n\nNous avons hâte de vous accueillir. 🍽️`,

    theUsualNotFound:
      `📋 *Aucune Commande Précédente*\n${DIV}\nVous n'avez pas encore de commandes chez nous.\n\nCommençons votre première commande!`,

    theUsualFound: (summary) =>
      `🔁 *Votre Dernière Commande*\n${DIV}\n${summary}\n${DIV}\nVoulez-vous recommander cela?`,

    handoffMessage:
      `🧑 *Connexion avec Notre Équipe*\n${DIV}\nUn membre de notre équipe vous contactera sous peu.\n\nMerci de votre patience! 🙏`,

    handoffAdmin: (phone) =>
      `⚠️ *Demande d'Agent Humain*\n${DIV}\nLe client *${phone}* a demandé à parler avec un agent.\nVeuillez répondre dans les plus brefs délais.`,

    invalidInput:
      `🤔 *Entrée Non Reconnue*\n${DIV}\nDésolé, je n'ai pas compris votre message.\n\nVeuillez choisir parmi les options proposées ou tapez *menu* pour revenir au menu principal.`,

    orderDelivery: 'Livraison',
    orderPickup: 'Retrait',
    btnOrder: '🍽️ Commander',
    btnBook: '📅 Réserver une Table',
    btnUsual: '🔁 Recommander l\'Habituel',
    btnHuman: '🎧 Parler à un Agent',
    btnEnglish: '🇬🇧 English',
    btnFrench: '🇫🇷 Français',
    btnPaid: "✅ J'ai Payé",
    btnRetry: '🔄 Réessayer',
    btnCancel: '❌ Annuler',
    btnAddMore: '➕ Ajouter un Article',
    btnCheckout: '🛒 Procéder au Paiement',
    btnDelivery: '🚗 Livraison à Domicile',
    btnPickup: '🏪 Retrait en Boutique',
    btnInRestaurant: '🍽️ Sur Place',
    askTableNumber: `🔢 *Numéro de Table*\n${DIV}\nVeuillez entrer votre numéro de table:`,
    invalidTableNumber: (max) =>
      `❌ *Numéro de Table Invalide*\n${DIV}\nVeuillez entrer un numéro entre *1* et *${max}*.`,
    btnYes: '✅ Oui, Recommander',
    btnNo: '📋 Voir le Menu Complet',
    btnConfirm: '✅ Confirmer la Réservation',
    selectItems: '📋 Voir le Menu',
  },
};

module.exports = strings;
