const mongoose = require('mongoose');

const deliveryGroupSchema = new mongoose.Schema(
  {
    orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    center: {
      lat: Number,
      lng: Number,
    },
    riderId: { type: String, default: null },
    riderName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'],
      default: 'PENDING',
    },
    estimatedDistance: Number,
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeliveryGroup', deliveryGroupSchema);
