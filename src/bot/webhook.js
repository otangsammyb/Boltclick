/**
 * Meta WhatsApp Webhook — GET verify + POST message receiver
 */
const express = require('express');
const router = express.Router();
const { meta } = require('../config/env');
const { dispatch } = require('./dispatcher');
const logger = require('../utils/logger');

// ── GET: Webhook verification by Meta ───────────────────────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === meta.verifyToken) {
    logger.info('✅ Meta webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// ── POST: Incoming messages ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // Respond 200 immediately to prevent Meta retries
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    // Process asynchronously
    await dispatch(body);
  } catch (err) {
    logger.error('Webhook processing error: ' + err.message);
  }
});

module.exports = router;
