const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    riderId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    driverCode: { type: String, required: true, unique: true }, // The full code used for login (e.g., DRIVER_JOE)
    phone: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Driver', driverSchema);
