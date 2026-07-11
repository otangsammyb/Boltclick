const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    nameEn: { type: String, required: true },
    nameFr: { type: String, required: true },
    descriptionEn: { type: String, default: '' },
    descriptionFr: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, default: 'Main' },
    imageUrl: { type: String, default: '' },
    available: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MenuItem', menuItemSchema);
