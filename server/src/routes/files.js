const express = require('express');
const router = express.Router();
const multer = require('multer');
const { processAndStoreUpload } = require('../services/fileService');

// Multer memory storage with 20 MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB limit
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please select a document or image.'
      });
    }

    const result = await processAndStoreUpload(req.file);

    let infoMessage = null;
    if (result.isConverted) {
      infoMessage = 'Document was automatically converted to PDF for optimal printing.';
    }

    res.status(200).json({
      success: true,
      file: {
        fileId: result.fileId,
        originalFilename: result.originalFilename,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        pageCount: result.pageCount,
        isConverted: result.isConverted
      },
      message: infoMessage
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message || 'File processing failed.'
    });
  }
});

module.exports = router;
