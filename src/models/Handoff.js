const mongoose = require('mongoose');

const handoffSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phone: { type: String, required: true },
    reason: { type: String, default: 'User requested human agent' },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    agentNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Handoff', handoffSchema);
