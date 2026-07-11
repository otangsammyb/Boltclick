const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phone: { type: String, required: true },
    date: { type: String, required: true },   // "DD/MM/YYYY"
    time: { type: String, required: true },   // "HH:MM"
    guests: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
      default: 'CONFIRMED',
    },
    receiptUrl: { type: String, default: '' },
    lang: { type: String, enum: ['en', 'fr'], default: 'en' },
  },
  { timestamps: true }
);

// Compound index for availability checking
bookingSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
