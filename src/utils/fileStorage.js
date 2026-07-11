const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const { Readable } = require('stream');

let bucket;

const initBucket = () => {
    if (!bucket) {
        bucket = new GridFSBucket(mongoose.connection.db, {
            bucketName: 'assets'
        });
    }
    return bucket;
};

/**
 * Upload a file buffer to GridFS
 * @param {Buffer} buffer 
 * @param {string} filename 
 * @param {string} contentType 
 * @returns {Promise<string>} fileId
 */
const uploadFile = (buffer, filename, contentType) => {
    return new Promise((resolve, reject) => {
        const _bucket = initBucket();
        const uploadStream = _bucket.openUploadStream(filename, {
            contentType: contentType
        });

        const readableStream = new Readable();
        readableStream.push(buffer);
        readableStream.push(null);

        readableStream.pipe(uploadStream)
            .on('error', reject)
            .on('finish', () => {
                resolve(uploadStream.id.toString());
            });
    });
};

/**
 * Download a file from GridFS as a buffer
 * @param {string} fileId 
 * @returns {Promise<Buffer>}
 */
const downloadFile = (fileId) => {
    return new Promise((resolve, reject) => {
        const _bucket = initBucket();
        const chunks = [];
        const downloadStream = _bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));

        downloadStream.on('data', (chunk) => chunks.push(chunk));
        downloadStream.on('error', reject);
        downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

/**
 * Get a read stream for a file from GridFS
 * @param {string} fileId 
 * @returns {Stream}
 */
const getReadStream = (fileId) => {
    const _bucket = initBucket();
    return _bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
};

/**
 * Delete a file from GridFS
 * @param {string} fileId 
 * @returns {Promise<void>}
 */
const deleteFile = (fileId) => {
    return new Promise((resolve, reject) => {
        const _bucket = initBucket();
        _bucket.delete(new mongoose.Types.ObjectId(fileId), (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

module.exports = {
    uploadFile,
    downloadFile,
    getReadStream,
    deleteFile
};
