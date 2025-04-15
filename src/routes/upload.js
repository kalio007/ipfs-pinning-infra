const express = require('express');
const router = express.Router();
const { accept, getFile } = require('../controller/upload');
const upload = require('../middleware/multer');

// Route to handle file uploads of any type
// router.post('/upload', upload.single('file'), accept);
router.post('/upload', upload.any(), (req, res, next) => {
    if (req.files && req.files.length > 0) {
        req.file = req.files[0];
    }
    next();
}, accept);
router.get('/file/:key', getFile);

module.exports = router;