const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  nameEn: String,
  nameFr: String,
  price: Number,
  quantity: { type: Number, default: 1 },
  subtotal: Number,
});

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: { type: String, required: true, index: true },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    fulfillmentType: { type: String, enum: ['delivery', 'pickup', 'in_restaurant'], required: true },
    tableNumber: { type: String, default: null },
    deliveryAddress: { type: String, default: '' },
    deliveryLat: { type: Number, default: null },
    deliveryLng: { type: Number, default: null },
    distanceKm: { type: Number, default: null },
    paymentMethod: { type: String, enum: ['MTN', 'ORANGE', ''], default: '' },
    paymentPhone: { type: String, default: '' },
    campayRef: { type: String, default: '' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryGroup', default: null },
    receiptUrl: { type: String, default: '' },
    followUpSent: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null },
    lang: { type: String, enum: ['en', 'fr'], default: 'en' },
    commissionAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

orderSchema.index({ updatedAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
