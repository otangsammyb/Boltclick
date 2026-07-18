const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Only one global settings document for the deployment for now.
  // Can be expanded with restaurantId later if sharing a DB.
  type: {
    type: String,
    required: true,
    default: 'global',
    unique: true
  },
  campayUsername: {
    type: String,
    trim: true,
  },
  campayPassword: {
    type: String,
    trim: true,
  },
  campayAppName: {
    type: String,
    trim: true,
  },
  campayBaseUrl: {
    type: String,
    trim: true,
  },
  campayWebhookUrl: {
    type: String,
    trim: true,
  },
  restaurantName: {
    type: String,
    trim: true,
  },
  restaurantAddress: {
    type: String,
    trim: true,
  },
  restaurantPhone: {
    type: String,
    trim: true,
  },
  totalTables: {
    type: Number,
    default: 10,
  },
  deliveryFeePerKm: {
    type: Number,
    default: 200,
  },
  brandColor: {
    type: String,
    trim: true,
    default: '#00ed64',
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
