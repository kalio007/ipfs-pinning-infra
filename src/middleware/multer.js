// src/middleware/multer.js
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { s3Client } = require('../utils/s3config');

// Configure storage on S3
const storage = multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    // acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure upload middleware
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024,
    }
});

module.exports = upload;