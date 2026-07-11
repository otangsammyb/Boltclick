/**
 * Meta WhatsApp Cloud API — Helper Functions
 * All outbound messages go through this module.
 */
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { meta } = require('../config/env');
const logger = require('../utils/logger');

const BASE_URL = `https://graph.facebook.com/${meta.apiVersion}/${meta.phoneNumberId}/messages`;

const headers = {
  Authorization: `Bearer ${meta.token}`,
  'Content-Type': 'application/json',
};

// ── Base send ────────────────────────────────────────────────────────────────
async function send(payload) {
  try {
    logger.debug('Outgoing WhatsApp Paylod: ' + JSON.stringify(payload));
    const res = await axios.post(BASE_URL, payload, { headers });
    return res.data;
  } catch (err) {
    const errorData = err.response?.data;
    logger.error(`❌ WhatsApp send error [${err.response?.status || '???'}]: ` + JSON.stringify(errorData || err.message));
    if (errorData?.error?.error_data?.details) {
      logger.error('Specific details: ' + errorData.error.error_data.details);
    }
    throw err;
  }
}

// ── Send plain text ──────────────────────────────────────────────────────────
async function sendText(to, text) {
  return send({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text, preview_url: false },
  });
}

// ── Send image by URL ────────────────────────────────────────────────────────
async function sendImage(to, imageUrl, caption = '') {
  return send({
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  });
}

// ── Send document (PDF) by URL ───────────────────────────────────────────────
async function sendDocument(to, documentUrl, filename = 'receipt.pdf') {
  return send({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: { link: documentUrl, filename, caption: '' },
  });
}

async function uploadMedia(source, type = 'application/pdf', filename = 'document.pdf') {
  const form = new FormData();
  
  if (typeof source === 'string') {
    // source is a file path
    form.append('file', fs.createReadStream(source));
  } else {
    // source is a buffer
    form.append('file', source, { filename, contentType: type });
  }
  
  form.append('type', type);
  form.append('messaging_product', 'whatsapp');

  const uploadUrl = `https://graph.facebook.com/${meta.apiVersion}/${meta.phoneNumberId}/media`;
  const res = await axios.post(uploadUrl, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${meta.token}`,
    },
  });

  return res.data.id; // media_id
}

async function sendBufferDocument(to, buffer, filename = 'receipt.pdf') {
  const mediaId = await uploadMedia(buffer, 'application/pdf', filename);
  return send({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: { id: mediaId, filename },
  });
}

async function sendLocalDocument(to, localPath, filename = 'receipt.pdf') {
  const mediaId = await uploadMedia(localPath);
  return send({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: { id: mediaId, filename },
  });
}

// ── Send interactive button message (up to 3 buttons) ───────────────────────
async function sendButtons(to, bodyText, buttons, headerText = '') {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.substring(0, 20) },
        })),
      },
    },
  };
  if (headerText) {
    payload.interactive.header = { type: 'text', text: headerText };
  }
  return send(payload);
}

// ── Send interactive list message (up to 10 items) ──────────────────────────
async function sendList(to, bodyText, buttonLabel, sections) {
  return send({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonLabel.substring(0, 20),
        sections,
      },
    },
  });
}

// ── Mark incoming message as read ───────────────────────────────────────────
async function markRead(messageId) {
  try {
    await axios.post(
      BASE_URL.replace('/messages', '/messages'),
      { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
      { headers }
    );
  } catch (_) {
    // Non-critical
  }
}

module.exports = { sendText, sendImage, sendDocument, sendLocalDocument, sendBufferDocument, sendButtons, sendList, markRead };
