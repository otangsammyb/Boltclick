const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { uploadFile } = require('../src/utils/fileStorage');
const { mongo } = require('../src/config/env');

// Models
const MenuItem = require('../src/models/MenuItem');
const QRCodeItem = require('../src/models/QRCode');
const Order = require('../src/models/Order');
const Booking = require('../src/models/Booking');

async function migrate() {
    try {
        console.log('🚀 Starting migration to GridFS...');
        await mongoose.connect(mongo.uri);
        console.log('✅ Connected to MongoDB');

        const uploadsDir = path.join(__dirname, '../public/uploads');
        const receiptsDir = path.join(__dirname, '../public/receipts');

        // 1. Migrate Logo
        const logoPath = path.join(uploadsDir, 'restaurant-logo.png');
        if (fs.existsSync(logoPath)) {
            console.log('📦 Migrating restaurant logo...');
            const buffer = fs.readFileSync(logoPath);
            await uploadFile(buffer, 'restaurant-logo.png', 'image/png');
            console.log('✅ Logo migrated');
        }

        // 2. Migrate Menu Images and QRs
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            for (const file of files) {
                if (file === 'restaurant-logo.png') continue;
                
                const filePath = path.join(uploadsDir, file);
                const buffer = fs.readFileSync(filePath);
                const contentType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
                
                console.log(`📦 Migrating ${file}...`);
                const fileId = await uploadFile(buffer, file, contentType);
                const newUrl = `/api/files/${fileId}`;

                // Update MenuItems
                const menuResult = await MenuItem.updateMany(
                    { imageUrl: { $regex: file } },
                    { imageUrl: newUrl }
                );
                if (menuResult.modifiedCount > 0) console.log(`   Updated ${menuResult.modifiedCount} MenuItems`);

                // Update QRCodes
                const qrResult = await QRCodeItem.updateMany(
                    { imageUrl: { $regex: file } },
                    { imageUrl: newUrl }
                );
                if (qrResult.modifiedCount > 0) console.log(`   Updated ${qrResult.modifiedCount} QRCodes`);
            }
        }

        // 3. Migrate Receipts
        if (fs.existsSync(receiptsDir)) {
            const files = fs.readdirSync(receiptsDir);
            for (const file of files) {
                if (!file.endsWith('.pdf')) continue;

                const filePath = path.join(receiptsDir, file);
                const buffer = fs.readFileSync(filePath);
                
                console.log(`📦 Migrating receipt ${file}...`);
                const fileId = await uploadFile(buffer, file, 'application/pdf');
                const newUrl = `/api/files/${fileId}`;

                // Update Orders
                const orderResult = await Order.updateMany(
                    { receiptUrl: { $regex: file } },
                    { receiptUrl: newUrl }
                );
                if (orderResult.modifiedCount > 0) console.log(`   Updated ${orderResult.modifiedCount} Orders`);

                // Update Bookings
                const bookingResult = await Booking.updateMany(
                    { receiptUrl: { $regex: file } },
                    { receiptUrl: newUrl }
                );
                if (bookingResult.modifiedCount > 0) console.log(`   Updated ${bookingResult.modifiedCount} Bookings`);
            }
        }

        console.log('✨ Migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
