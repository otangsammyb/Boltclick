/**
 * PDF Receipt Generator — PDFKit
 * Generates both order receipts and booking confirmation PDFs
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { restaurant } = require('../config/env');

const { uploadFile, downloadFile } = require('../utils/fileStorage');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const sharp = require('sharp');

async function generateReceipt(order = null, booking = null) {
  const id = order ? order._id : booking._id;
  const type = order ? 'Order' : 'Booking';
  const filename = `${type}-${id}.pdf`;

  // Fetch logo buffer first (awaited)
  let logoBuffer = null;
  try {
    const _db = mongoose.connection.db;
    const bucket = new GridFSBucket(_db, { bucketName: 'assets' });
    const files = await bucket.find({ filename: 'restaurant-logo.png' }).sort({ uploadDate: -1 }).limit(1).toArray();
    if (files.length > 0) {
      const rawBuffer = await downloadFile(files[0]._id.toString());
      logoBuffer = await sharp(rawBuffer).png().toBuffer();
    }
  } catch (err) {
    console.error('Error fetching logo for PDF:', err.message);
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A5' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const fileId = await uploadFile(buffer, filename, 'application/pdf');
        resolve({ fileId, filename });
      } catch (err) {
        reject(err);
      }
    });

    // ── Brand header ─────────────────────────────────────────────────────
    if (logoBuffer) {
      const logoSize = 60;
      const pageWidth = doc.page.width;
      const logoX = (pageWidth - logoSize) / 2;
      doc.image(logoBuffer, logoX, doc.y, { width: logoSize, height: logoSize });
      doc.moveDown(0.8);
    }

    doc
      .fillColor('#00ed64')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(restaurant.name, { align: 'center' });

    doc
      .fillColor('#023430')
      .fontSize(10)
      .font('Helvetica')
      .text(restaurant.address, { align: 'center' })
      .text(restaurant.phone, { align: 'center' })
      .moveDown(0.5);

    // ── Divider ───────────────────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(370, doc.y).strokeColor('#00684a').lineWidth(2).stroke();
    doc.moveDown(0.5);

    // ── Receipt header ────────────────────────────────────────────────────
    doc
      .fillColor('#001e2b')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(order ? 'ORDER RECEIPT' : 'BOOKING CONFIRMATION', { align: 'center' });

    const idStr = id.toString();
    const refId = idStr.slice(-6).toUpperCase();

    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#023430')
      .text(`Date: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Douala' })}`, { align: 'center' })
      .text(`Ref: ${refId}`, { align: 'center' });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(370, doc.y).strokeColor('#00684a').lineWidth(1).stroke();
    doc.moveDown(0.5);

    if (order) {
      // ── Order items ───────────────────────────────────────────────────
      const lang = order.lang || 'en';
      doc.fillColor('#001e2b').fontSize(11).font('Helvetica-Bold').text('Items', 50);
      doc.moveDown(0.2);

      order.items.forEach((item) => {
        const name = lang === 'fr' ? item.nameFr : item.nameEn;
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#001e2b')
          .text(`${name} × ${item.quantity}`, 60, doc.y, { continued: true })
          .text(`${item.subtotal.toLocaleString()} FCFA`, { align: 'right' });
      });

      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(370, doc.y).strokeColor('#ccc').lineWidth(0.5).stroke();
      doc.moveDown(0.3);

      // Subtotal, delivery fee, total
      const rows = [
        { label: 'Subtotal', value: order.subtotal },
      ];
      if (order.deliveryFee > 0) rows.push({ label: 'Delivery Fee', value: order.deliveryFee });
      rows.push({ label: 'TOTAL', value: order.total, bold: true, accent: true });

      rows.forEach((r) => {
        doc
          .fontSize(r.bold ? 12 : 10)
          .font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(r.accent ? '#00684a' : '#001e2b')
          .text(r.label, 60, doc.y, { continued: true })
          .text(`${r.value.toLocaleString()} FCFA`, { align: 'right' });
      });

      doc.moveDown(0.5);

      // Payment method
      let fulfillStr = 'Pickup';
      if (order.fulfillmentType === 'delivery') fulfillStr = 'Delivery';
      else if (order.fulfillmentType === 'in_restaurant') fulfillStr = 'In Restaurant';

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#001e2b')
        .text(`Payment: ${order.paymentMethod} Mobile Money`)
        .text(`Fulfillment: ${fulfillStr}`);

      if (order.fulfillmentType === 'in_restaurant' && order.tableNumber) {
        doc.text(`Table: ${order.tableNumber}`);
      } else if (order.deliveryAddress) {
        doc.text(`Delivery to: ${order.deliveryAddress}`);
      }
    } else {
      // ── Booking info ──────────────────────────────────────────────────
      doc.fillColor('#001e2b').fontSize(11).font('Helvetica-Bold').text('Booking Details');
      doc.moveDown(0.2);

      const details = [
        { label: 'Date', value: booking.date },
        { label: 'Time', value: booking.time },
        { label: 'Guests', value: booking.guests },
        { label: 'Status', value: booking.status },
      ];

      details.forEach((d) => {
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#001e2b')
          .text(`${d.label}: ${d.value}`);
      });
    }

    // ── Footer ────────────────────────────────────────────────────────────
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(370, doc.y).strokeColor('#00684a').lineWidth(2).stroke();
    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .fillColor('#00684a')
      .font('Helvetica-Bold')
      .text('Thank you for choosing ' + restaurant.name + '!', { align: 'center' })
      .fillColor('#023430')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Powered by APEXIFY', { align: 'center' });

    doc.end();
  });
}

module.exports = generateReceipt;
