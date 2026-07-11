/**
 * scripts/mongo-init.js
 * Runs automatically on first container startup to create the app DB user.
 * Root credentials are injected via MONGO_INITDB_ROOT_* env vars.
 */
db = db.getSiblingDB('restaurant_bot');

db.createUser({
  user: 'botuser',
  pwd: process.env.MONGO_BOT_PASSWORD || 'CHANGE_ME_IN_ENV',
  roles: [
    { role: 'readWrite', db: 'restaurant_bot' },
  ],
});

print('✅ MongoDB: restaurant_bot user created.');
