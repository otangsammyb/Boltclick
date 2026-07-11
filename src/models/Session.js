const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    state: {
      type: String,
      enum: [
        'IDLE',
        'LANG_SELECT',
        'MAIN_MENU',
        'ORDERING',
        'DELIVERY_CHOICE',
        'AWAITING_LOCATION',
        'AWAITING_TABLE_NUMBER',
        'PAYMENT_NUMBER',
        'AWAITING_PAYMENT_CONFIRM',
        'BOOKING_DATE',
        'BOOKING_TIME',
        'BOOKING_GUESTS',
        'BOOKING_CONFIRM',
        'THE_USUAL',
        'RATING',
        'HANDOFF',
      ],
      default: 'IDLE',
    },
    lang: { type: String, enum: ['en', 'fr'], default: 'en' },
    cart: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
        nameEn: String,
        nameFr: String,
        price: Number,
        quantity: { type: Number, default: 1 },
      },
    ],
    data: {
      // Holds temporary booking data, payment ref, delivery info etc.
      deliveryChoice: String,          // 'delivery' | 'pickup'
      deliveryAddress: String,
      deliveryLat: Number,
      deliveryLng: Number,
      deliveryFee: { type: Number, default: 0 },
      distanceKm: Number,
      paymentPhone: String,
      carrier: String,
      campayRef: String,
      pendingOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
      bookingDate: String,
      bookingTime: String,
      bookingGuests: Number,
    },
    updatedAt: { type: Date, default: Date.now, expires: 86400 }, // TTL 24h
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
