require('dotenv').config();
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { mongo } = require('../src/config/env');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

async function migrate() {
  await mongoose.connect(mongo.uri);
  const db = mongoose.connection.db;
  const bucket = new GridFSBucket(db, { bucketName: 'assets' });

  // Find files > 100KB
  const largeFiles = await bucket.find({ length: { $gt: 100 * 1024 } }).toArray();
  console.log(`Found ${largeFiles.length} large files to migrate to disk.`);

  for (const file of largeFiles) {
    const ext = file.contentType === 'application/pdf' ? '.pdf' : '.png';
    const diskPath = path.join(UPLOADS_DIR, file._id.toString() + ext);

    // Stream directly to disk
    await new Promise((resolve, reject) => {
      const readStream = bucket.openDownloadStream(file._id);
      const writeStream = fs.createWriteStream(diskPath);
      readStream.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    console.log(`Migrated ${file.filename} -> Disk: ${diskPath}`);
    // We update the DB metadata in the actual system models separately if needed.
    // Or we rely on the fileController hybrid check.
  }
  
  console.log('Hybrid migration complete.');
  process.exit(0);
}
migrate().catch(console.error);
