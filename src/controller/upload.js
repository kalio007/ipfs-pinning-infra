const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../utils/s3config');

const accept = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }
        // File is already uploaded to S3 by multer-s3
        return res.status(200).json({
            success: true,
            message: "File uploaded successfully!",
            file: {
                key: req.file.key,
                location: req.file.location,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Error: ${error.message}`
        });
    }
};

const getFile = async (req, res) => {
    try {
        const fileKey = req.params.key;
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileKey
        });
        // Generate a signed URL that's valid for 1 hour
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return res.status(200).json({
            message: "File found",
            statusCode: 200,
            data: {
                url: signedUrl
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: `Error: ${error.message}`,
            data: null
        });
    }
};

module.exports = {
    accept,
    getFile
};
