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

// ── Authenticate & get token ─────────────────────────────────────────────────
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  // 1. Fetch dynamic keys from Settings DB
  let username = campay.username;
  let password = campay.password;
  
  try {
    const settings = await Settings.findOne({ type: 'global' });
    if (settings && settings.campayUsername && settings.campayPassword) {
      username = settings.campayUsername;
      password = settings.campayPassword;
    }
  } catch (err) {
    logger.error('Failed to fetch CamPay settings from DB, falling back to ENV');
  }

  if (!username || !password) {
    throw new Error('CamPay credentials are not configured in Admin Settings or ENV');
  }

  const res = await axios.post(
    `${campay.baseUrl}/token/`,
    { username, password },
    { headers: { 'Content-Type': 'application/json' } }
  );

  cachedToken = res.data.token;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 min
  logger.debug('CamPay token refreshed dynamically');
  return cachedToken;
}

// ── Initiate a collect (debit from customer phone) ──────────────────────────
async function initiateCollection({ amount, currency = 'XAF', from, description, externalRef }) {
  const token = await getToken();
  const payload = {
    amount: String(amount),
    currency,
    from,
    description,
    external_reference: externalRef,
    app_name: campay.appName,
    redirect_url: campay.webhookUrl || '',
  };

  try {
    logger.debug('CamPay collect payload: ' + JSON.stringify(payload));
    const res = await axios.post(
      `${campay.baseUrl}/collect/`,
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
  const token = await getToken();
  const res = await axios.get(
    `${campay.baseUrl}/transaction/${reference}/`,
    { headers: { Authorization: `Token ${token}` } }
  );
  // status: SUCCESSFUL | FAILED | PENDING
  return res.data;
}

function clearTokenCache() {
  cachedToken = null;
  tokenExpiry = 0;
  logger.info('CamPay token cache cleared (settings updated)');
}

module.exports = { initiateCollection, checkStatus, clearTokenCache };
