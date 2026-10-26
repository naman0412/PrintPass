const { PDFDocument } = require('pdf-lib');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getGridFSBucket, mongoose } = require('../config/db');
const { validateUploadedFile } = require('../utils/fileValidation');

/**
 * Counts total pages of a PDF buffer using pdf-lib.
 * Handles corrupt or password-protected files gracefully.
 */
const countPdfPages = async (pdfBuffer) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: false });
    return pdfDoc.getPageCount();
  } catch (err) {
    if (err.message && (err.message.includes('encrypt') || err.message.includes('password'))) {
      throw new Error('This document is password protected. Please remove the password and try again.');
    }
    throw new Error('Could not read PDF structure. The file may be corrupt or invalid.');
  }
};

/**
 * Converts image buffer (JPG or PNG) to PDF buffer using pdf-lib.
 */
const convertImageToPdf = async (imageBuffer, mimeType) => {
  try {
    const pdfDoc = await PDFDocument.create();
    let image;
    if (mimeType.includes('png')) {
      image = await pdfDoc.embedPng(imageBuffer);
    } else {
      image = await pdfDoc.embedJpg(imageBuffer);
    }

    const { width, height } = image.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width,
      height
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (err) {
    throw new Error(`Failed to convert image to PDF: ${err.message}`);
  }
};

/**
 * Converts Office document (DOC, DOCX, PPT, PPTX) to PDF using LibreOffice headless.
 * If LibreOffice is not installed on the system, gracefully throws a clear message.
 */
const convertOfficeToPdf = async (officeBuffer, originalFilename) => {
  return new Promise((resolve, reject) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printpass-conv-'));
    const tempInputPath = path.join(tempDir, originalFilename);

    fs.writeFileSync(tempInputPath, officeBuffer);

    // Call LibreOffice headless
    const cmd = `soffice --headless --convert-to pdf --outdir "${tempDir}" "${tempInputPath}"`;

    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      try {
        if (error) {
          // Check if soffice is not recognized
          if (error.code === 127 || error.message.includes('not recognized') || error.message.includes('not found')) {
            cleanupTempDir(tempDir);
            return reject(
              new Error(
                'Office file conversion requires LibreOffice. LibreOffice is currently not installed on this host. Please upload PDF or image formats directly.'
              )
            );
          }
          cleanupTempDir(tempDir);
          return reject(new Error(`Office conversion failed: ${stderr || error.message}`));
        }

        const ext = path.extname(originalFilename);
        const baseName = path.basename(originalFilename, ext);
        const outputPdfPath = path.join(tempDir, `${baseName}.pdf`);

        if (!fs.existsSync(outputPdfPath)) {
          cleanupTempDir(tempDir);
          return reject(new Error('Office conversion failed to generate PDF output file.'));
        }

        const pdfBuffer = fs.readFileSync(outputPdfPath);
        cleanupTempDir(tempDir);
        resolve(pdfBuffer);
      } catch (cleanErr) {
        cleanupTempDir(tempDir);
        reject(cleanErr);
      }
    });
  });
};

const cleanupTempDir = (dir) => {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (e) {
    // ignore cleanup error
  }
};

/**
 * Process uploaded file:
 * - Validate magic bytes & size
 * - Normalize/convert to PDF
 * - Count pages
 * - Upload to GridFS
 * Returns { fileId, originalFilename, fileSize, mimeType, pageCount, isConverted }
 */
const processAndStoreUpload = async (file) => {
  const validation = validateUploadedFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  let finalPdfBuffer = null;
  let isConverted = false;
  const originalName = file.originalname || 'document';
  const lowerName = originalName.toLowerCase();

  if (lowerName.endsWith('.pdf')) {
    finalPdfBuffer = file.buffer;
  } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png')) {
    finalPdfBuffer = await convertImageToPdf(file.buffer, file.mimetype || 'image/jpeg');
    isConverted = true;
  } else if (
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.ppt') ||
    lowerName.endsWith('.pptx')
  ) {
    finalPdfBuffer = await convertOfficeToPdf(file.buffer, originalName);
    isConverted = true;
  } else {
    throw new Error('Unsupported file extension.');
  }

  // Count pages with pdf-lib
  const pageCount = await countPdfPages(finalPdfBuffer);
  if (pageCount < 1) {
    throw new Error('Uploaded document contains 0 pages.');
  }

  // Store in GridFS
  const fileId = await storeBufferInGridFS(finalPdfBuffer, `${originalName}.pdf`, 'application/pdf');

  return {
    fileId,
    originalFilename: originalName,
    fileSize: finalPdfBuffer.length,
    mimeType: 'application/pdf',
    pageCount,
    isConverted
  };
};

/**
 * Stores buffer in GridFS bucket and returns the ObjectId
 */
const storeBufferInGridFS = (buffer, filename, contentType = 'application/pdf') => {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata: { uploadedAt: new Date() }
    });

    uploadStream.on('error', (err) => reject(err));
    uploadStream.on('finish', (file) => resolve(file._id));

    uploadStream.end(buffer);
  });
};

/**
 * Reads file from GridFS as a Buffer
 */
const getBufferFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    try {
      const bucket = getGridFSBucket();
      const objId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
      const downloadStream = bucket.openDownloadStream(objId);
      const chunks = [];

      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('error', (err) => reject(err));
      downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Deletes file from GridFS
 */
const deleteFileFromGridFS = async (fileId) => {
  if (!fileId) return false;
  try {
    const bucket = getGridFSBucket();
    const objId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    await bucket.delete(objId);
    return true;
  } catch (err) {
    // If file is already deleted or not found, do not crash
    return false;
  }
};

module.exports = {
  countPdfPages,
  convertImageToPdf,
  convertOfficeToPdf,
  processAndStoreUpload,
  storeBufferInGridFS,
  getBufferFromGridFS,
  deleteFileFromGridFS
};
