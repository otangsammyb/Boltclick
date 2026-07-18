/**
 * CamPay API Client — MTN MoMo & Orange Money (Cameroon)
 * Docs: https://documenter.getpostman.com/view/2741587/T17AkA7u
 */
const axios = require('axios');
const { campay } = require('../config/env');
const logger = require('../utils/logger');
const Settings = require('../models/Settings');

let cachedToken = null;
let tokenExpiry = 0;

// Config cache — avoids repeated DB hits on every API call
let cachedConfig = null;
let configExpiry = 0;
const CONFIG_TTL_MS = 60 * 1000; // 60 seconds

// Helper to get unified config (DB overrides ENV). Cached for 60 s to avoid
// repeated MongoDB round-trips on every API call.
async function getCampayConfig() {
  if (cachedConfig && Date.now() < configExpiry) return cachedConfig;

  const config = { ...campay };
  try {
    const settings = await Settings.findOne({ type: 'global' });
    if (settings) {
      if (settings.campayUsername) config.username = settings.campayUsername;
      if (settings.campayPassword) config.password = settings.campayPassword;
      if (settings.campayAppName) config.appName = settings.campayAppName;
      if (settings.campayBaseUrl) config.baseUrl = settings.campayBaseUrl;
      if (settings.campayWebhookUrl) config.webhookUrl = settings.campayWebhookUrl;
    }
  } catch (err) {
    logger.error('Failed to fetch CamPay settings from DB, falling back to ENV');
  }

  cachedConfig = config;
  configExpiry = Date.now() + CONFIG_TTL_MS;
  return config;
}

// ── Authenticate & get token ─────────────────────────────────────────────────
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const config = await getCampayConfig();

  if (!config.username || !config.password) {
    throw new Error('CamPay credentials are not configured in Admin Settings or ENV');
  }

  const res = await axios.post(
    `${config.baseUrl}/token/`,
    { username: config.username, password: config.password },
    { headers: { 'Content-Type': 'application/json' } }
  );

  cachedToken = res.data.token;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 min
  logger.debug('CamPay token refreshed dynamically');
  return cachedToken;
}

// ── Initiate a collect (debit from customer phone) ──────────────────────────
async function initiateCollection({ amount, currency = 'XAF', from, description, externalRef }) {
  // Fetch config once — getToken() already uses the same cached value
  const config = await getCampayConfig();
  const token = await getToken();

  const payload = {
    amount: String(amount),
    currency,
    from,
    description,
    external_reference: externalRef,
    app_name: config.appName,
    redirect_url: config.webhookUrl || '',
  };

  try {
    logger.debug('CamPay collect payload: ' + JSON.stringify(payload));
    const res = await axios.post(
      `${config.baseUrl}/collect/`,
      payload,
      { headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' } }
    );

    logger.info(`CamPay collect initiated: ref=${res.data.reference}`);
    return res.data;
  } catch (err) {
    logger.error('CamPay collect error: ' + JSON.stringify(err.response?.data || err.message));
    throw err;
  }
}

// ── Check transaction status by reference ───────────────────────────────────
async function checkStatus(reference) {
  const config = await getCampayConfig();
  const token = await getToken();

  const res = await axios.get(
    `${config.baseUrl}/transaction/${reference}/`,
    { headers: { Authorization: `Token ${token}` } }
  );
  // status: SUCCESSFUL | FAILED | PENDING
  return res.data;
}

function clearTokenCache() {
  cachedToken = null;
  tokenExpiry = 0;
  // Also bust config cache so updated settings take effect immediately
  cachedConfig = null;
  configExpiry = 0;
  logger.info('CamPay token + config cache cleared (settings updated)');
}

module.exports = { initiateCollection, checkStatus, clearTokenCache };
