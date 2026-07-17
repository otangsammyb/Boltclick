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
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
