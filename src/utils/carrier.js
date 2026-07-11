/**
 * Cameroon Mobile Network Carrier Detection
 * Detects MTN or Orange from a phone number.
 */

const MTN_PREFIXES = [
  '650','651','652','653','654',
  '670','671','672','673','674','675','676','677','678','679',
  '680','681','682','683','684','685','686','687','688','689',
];

const ORANGE_PREFIXES = [
  '655','656','657','658','659',
  '690','691','692','693','694','695','696','697','698','699',
];

function normalizePhone(phone) {
  // Remove spaces, dashes
  let digits = phone.replace(/\D/g, '');
  // Strip country code 237
  if (digits.startsWith('237')) digits = digits.slice(3);
  return digits;
}

function detectCarrier(phone) {
  const digits = normalizePhone(phone);
  const prefix = digits.substring(0, 3);
  if (MTN_PREFIXES.includes(prefix)) return 'MTN';
  if (ORANGE_PREFIXES.includes(prefix)) return 'ORANGE';
  return 'UNKNOWN';
}

function formatE164(phone) {
  const digits = normalizePhone(phone);
  return `+237${digits}`;
}

module.exports = { detectCarrier, normalizePhone, formatE164 };
