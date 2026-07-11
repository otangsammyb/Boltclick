const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    language: { type: String, enum: ['en', 'fr'], default: 'en' },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('User', userSchema);
