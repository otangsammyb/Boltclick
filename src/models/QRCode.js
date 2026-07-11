const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  imageUrl: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('QRCode', qrCodeSchema);
