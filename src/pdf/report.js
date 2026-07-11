const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { restaurant } = require('../config/env');
const { downloadFile } = require('../utils/fileStorage');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const sharp = require('sharp');

async function generateReportStream(res, data) {
  const { type, startDate, endDate, stats } = data;
  
  const doc = new PDFDocument({ margin: 0, size: 'A4' });
  const filename = `${type.toUpperCase()}_REPORT_${startDate.replace(/\s+/g,'_')}.pdf`;
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // A4 Width: 595.28 points. We use exactly 50 point Left/Right margins.
  // Content Width = 595.28 - 100 = 495.28. (We'll round width usage to 495). Right bound is 545.
  
  // --- Design the Top Green Ribbon ---
  doc.rect(0, 0, doc.page.width, 140).fill('#00684a');

  // --- Logo ---
  // Fetch logo from GridFS
  try {
    const _db = mongoose.connection.db;
    const bucket = new GridFSBucket(_db, { bucketName: 'assets' });
    const files = await bucket.find({ filename: 'restaurant-logo.png' }).sort({ uploadDate: -1 }).limit(1).toArray();
    
    if (files.length > 0) {
      const rawBuffer = await downloadFile(files[0]._id.toString());
      const logoBuffer = await sharp(rawBuffer).png().toBuffer();
      doc.image(logoBuffer, 50, 25, { width: 90 });
    } else {
      doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text(restaurant.name, 50, 40);
    }
  } catch (err) {
    console.error('Error fetching logo for Report:', err.message);
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text(restaurant.name, 50, 40);
  }

  // --- Title inside Ribbon ---
  doc.fillColor('#ffffff')
     .fontSize(28)
     .font('Helvetica-Bold')
     .text(`${type.charAt(0).toUpperCase() + type.slice(1)} Performance Report`, 150, 45, { align: 'right', width: 395 });
     
  doc.fontSize(12)
     .font('Helvetica')
     .fillColor('#ccffed')
     .text(`Period: ${startDate} to ${endDate}`, 150, 80, { align: 'right', width: 395 });

  // Rest of the document margins start here
  doc.x = 50;
  doc.y = 170;

  // --- Summary Metrics Box ---
  // Three boxes, 155 width each. Total 465. Spacing 15x2 = 30. Total 495.
  // X positions: 50, 220, 390
  const drawMetric = (label, value, x, y) => {
    doc.rect(x, y, 155, 80)
       .lineWidth(1)
       .strokeColor('#e2e8f0')
       .stroke();
       
    // Move text inside the rect. X+15 padding.
    doc.fillColor('#64748b').fontSize(11).font('Helvetica').text(label, x + 15, y + 15, { width: 125 });
    // Shrink text slightly if very long (like Revenue)
    const valFontSize = value.length > 12 ? 16 : 20;
    doc.fillColor('#001e2b').fontSize(valFontSize).font('Helvetica-Bold').text(value, x + 15, y + 40, { width: 125 });
  };

  drawMetric('Total Revenue', `${stats.revenue.toLocaleString()} FCFA`, 50, doc.y);
  drawMetric('Total Orders', `${stats.totalOrders}`, 220, doc.y);
  drawMetric('Completed', `${stats.completedOrders}`, 390, doc.y);
  
  doc.y += 100;
  drawMetric('Average Rating', `${stats.avgRating} / 5.0`, 50, doc.y);
  drawMetric('New Customers', `${stats.newCustomers}`, 220, doc.y);
  drawMetric('Cancelled', `${stats.cancelledOrders}`, 390, doc.y);

  doc.y += 110;

  // --- Sales Breakdown ---
  doc.fillColor('#00684a').fontSize(18).font('Helvetica-Bold').text('Fulfillment Breakdown', 50, doc.y);
  doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).strokeColor('#e2e8f0').lineWidth(2).stroke();
  doc.y += 20;

  // Render fulfillment stats in clean horizontal mini-cards
  const drawFulfillment = (label, value, x, y) => {
    doc.rect(x, y, 155, 40).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.fillColor('#64748b').fontSize(11).font('Helvetica').text(label, x + 15, y + 14);
    doc.fillColor('#001e2b').fontSize(14).font('Helvetica-Bold').text(value, x + 100, y + 13, { width: 40, align: 'right' });
  };

  drawFulfillment('Delivery', `${stats.fulfillment.delivery || 0}`, 50, doc.y);
  drawFulfillment('Pickup', `${stats.fulfillment.pickup || 0}`, 220, doc.y);
  drawFulfillment('In Restaurant', `${stats.fulfillment.in_restaurant || 0}`, 390, doc.y);

  doc.y += 60;

  // --- Top Items ---
  doc.fillColor('#00684a').fontSize(18).font('Helvetica-Bold').text('Top Performing Items', 50, doc.y);
  doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).strokeColor('#e2e8f0').lineWidth(2).stroke();
  doc.y += 20;

  let startYList = doc.y;
  doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold')
     .text('ITEM NAME', 50, startYList)
     .text('QTY SOLD', 335, startYList, { width: 80, align: 'right' })
     .text('REVENUE', 445, startYList, { width: 100, align: 'right' });
     
  doc.moveTo(50, startYList + 15).lineTo(545, startYList + 15).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.y = startYList + 25;

  if (stats.topItems.length === 0) {
    doc.fillColor('#001e2b').fontSize(11).font('Helvetica').text('No items sold during this period.', 50, doc.y);
  }

  stats.topItems.forEach((item, i) => {
    doc.fillColor('#001e2b').fontSize(11).font('Helvetica')
       .text(item.name, 50, doc.y)
       .text(item.qty.toString(), 335, doc.y, { width: 80, align: 'right' })
       .text(`${item.revenue.toLocaleString()} FCFA`, 445, doc.y, { width: 100, align: 'right' });
    doc.y += 15;
    if (i < stats.topItems.length - 1) {
       doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).strokeColor('#f1f5f9').lineWidth(1).stroke();
       doc.y += 15;
    }
  });

  // --- Bottom Green Ribbon ---
  const bottomY = doc.page.height - 40;
  doc.rect(0, bottomY, doc.page.width, 40).fill('#00684a');
  doc.fillColor('#ccffed').fontSize(9).font('Helvetica')
     .text(`Generated exactly on ${new Date().toLocaleString('en-GB')}`, 0, bottomY + 15, { align: 'center', width: doc.page.width });

  doc.end();
}

module.exports = generateReportStream;
