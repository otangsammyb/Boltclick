const mongoose = require('mongoose');

/**
 * Commission — records 1.5% platform commission on each paid order.
 * Only the super-admin dashboard consumes this collection.
 */
const commissionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    restaurantPhone: { type: String, default: '' }, // the WhatsApp number the bot serves
    orderTotal: { type: Number, required: true },
    commissionRate: { type: Number, default: 0.015 },
    commissionAmount: { type: Number, required: true }, // orderTotal * 0.015
    status: { type: String, enum: ['EARNED', 'REVERSED'], default: 'EARNED' },
    earnedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

commissionSchema.index({ earnedAt: -1 });
commissionSchema.index({ status: 1, earnedAt: -1 });

module.exports = mongoose.model('Commission', commissionSchema);
