require('dotenv').config();

const required = [
  'META_PHONE_NUMBER_ID',
  'META_WHATSAPP_TOKEN',
  'META_VERIFY_TOKEN',
  'MONGO_URI',
  'JWT_SECRET',
  'CAMPAY_USERNAME',
  'CAMPAY_PASSWORD',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  mongo: {
    uri: process.env.MONGO_URI,
  },

  meta: {
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    token: process.env.META_WHATSAPP_TOKEN,
    verifyToken: process.env.META_VERIFY_TOKEN,
    apiVersion: process.env.META_API_VERSION || 'v19.0',
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    adminWhatsapp: process.env.ADMIN_WHATSAPP,
  },

  restaurant: {
    name: process.env.RESTAURANT_NAME || 'Restaurant',
    address: process.env.RESTAURANT_ADDRESS || '',
    lat: parseFloat(process.env.RESTAURANT_LAT || '0'),
    lng: parseFloat(process.env.RESTAURANT_LNG || '0'),
    phone: process.env.RESTAURANT_PHONE || '',
    totalTables: parseInt(process.env.TOTAL_TABLES || '10', 10),
    deliveryFeePerKm: parseInt(process.env.DELIVERY_FEE_PER_KM || '200', 10),
  },

  campay: {
    username: process.env.CAMPAY_USERNAME,
    password: process.env.CAMPAY_PASSWORD,
    appName: process.env.CAMPAY_APP_NAME,
    baseUrl: process.env.CAMPAY_BASE_URL || 'https://demo.campay.net/api',
    webhookUrl: process.env.CAMPAY_WEBHOOK_URL,
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET,
    adminEmail: process.env.ADMIN_EMAIL || 'admin@restaurant.com',
    adminPassword: process.env.ADMIN_PASSWORD || 'Admin@1234',
  },
};
