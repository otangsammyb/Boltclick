/**
 * Table Booking Handler
 */
const wa = require('../whatsapp');
const sm = require('../stateManager');
const strings = require('../language/strings');
const Booking = require('../../models/Booking');
const QRCodeItem = require('../../models/QRCode');
const generateReceipt = require('../../pdf/receipt');
const { baseUrl } = require('../../config/env');
const User = require('../../models/User');
const path = require('path');
const statsManager = require('../../utils/statsManager');

function isValidDate(str) {
  const re = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!re.test(str)) return false;
  const [, d, m, y] = re.exec(str);
  const date = new Date(`${y}-${m}-${d}`);
  return date instanceof Date && !isNaN(date);
}

function isValidTime(str) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(str);
}

async function handleBookingStart(phone, lang) {
  const s = strings[lang];
  const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

  // Check total available tables from QR codes count
  const totalTables = await QRCodeItem.countDocuments();

  // Check table availability for today
  const activeBookings = await Booking.countDocuments({
    date: today,
    status: { $in: ['CONFIRMED'] },
  });

  if (activeBookings >= totalTables) {
    return wa.sendText(phone, s.bookingTablesFull);
  }

  await sm.updateSession(phone, { state: 'BOOKING_DATE' });
  await wa.sendText(phone, s.askBookingDate);
}

async function handleBookingDate(phone, lang, text) {
  const s = strings[lang];
  if (!isValidDate(text.trim())) {
    return wa.sendText(phone, s.invalidDate);
  }
  await sm.updateSession(phone, { 'data.bookingDate': text.trim(), state: 'BOOKING_TIME' });
  await wa.sendText(phone, s.askBookingTime);
}

async function handleBookingTime(phone, lang, text) {
  const s = strings[lang];
  if (!isValidTime(text.trim())) {
    return wa.sendText(phone, s.invalidTime);
  }
  await sm.updateSession(phone, { 'data.bookingTime': text.trim(), state: 'BOOKING_GUESTS' });
  await wa.sendText(phone, s.askBookingGuests);
}

async function handleBookingGuests(phone, lang, text, session) {
  const s = strings[lang];
  const guests = parseInt(text.trim(), 10);
  if (isNaN(guests) || guests < 1) {
    return wa.sendText(phone, s.invalidInput);
  }

  const { bookingDate, bookingTime } = session.data;
  await sm.updateSession(phone, { 'data.bookingGuests': guests, state: 'BOOKING_CONFIRM' });
  await wa.sendButtons(phone, s.bookingConfirm(bookingDate, bookingTime, guests), [
    { id: 'BOOKING_YES', title: s.btnConfirm },
    { id: 'BOOKING_NO', title: s.btnCancel },
  ]);
}

async function handleBookingConfirm(phone, lang, session) {
  const s = strings[lang];
  const { bookingDate, bookingTime, bookingGuests } = session.data;
  const user = await User.findOne({ phone });

  const booking = await Booking.create({
    userId: user._id,
    phone,
    date: bookingDate,
    time: bookingTime,
    guests: bookingGuests,
    lang,
  });

  await statsManager.onBookingStatusChange(1);

  await wa.sendText(phone, s.bookingDone);

  // Generate & send PDF
  try {
    const { fileId, filename } = await generateReceipt(null, booking);
    const receiptUrl = `${baseUrl}/api/files/${fileId}`;
    await Booking.findByIdAndUpdate(booking._id, { receiptUrl });
    
    // Get buffer to send via WA
    const { downloadFile } = require('../../utils/fileStorage');
    const buffer = await downloadFile(fileId);
    await wa.sendBufferDocument(phone, buffer, filename);
  } catch (err) {
    logger.error('❌ Failed to generate/send booking receipt: ' + err.message);
  }

  await sm.resetSession(phone);
}

module.exports = {
  handleBookingStart,
  handleBookingDate,
  handleBookingTime,
  handleBookingGuests,
  handleBookingConfirm,
};
