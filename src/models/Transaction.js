const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    phone: { type: String, required: true },
    campayRef: { type: String, default: '' },
    campayTransactionId: { type: String, default: '' },
    carrier: { type: String, enum: ['MTN', 'ORANGE', 'UNKNOWN'] },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'XAF' },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
    },
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
