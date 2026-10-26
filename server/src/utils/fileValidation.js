/**
 * Inspect magic bytes of uploaded buffers to ensure file integrity and prevent malicious uploads
 */
const detectMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 4) return null;

  // PDF: %PDF-
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { ext: 'pdf', mime: 'application/pdf' };
  }

  // PNG: \x89PNG\r\n\x1a\n
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // Modern Office (DOCX, PPTX): PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return { ext: 'office_zip', mime: 'application/zip' };
  }

  // Legacy Office (DOC, PPT): \xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return { ext: 'office_ole', mime: 'application/msword' };
  }

  return null;
};

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'];

const validateUploadedFile = (file) => {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  const maxBytes = 20 * 1024 * 1024; // 20 MB limit
  if (file.size > maxBytes) {
    return { isValid: false, error: 'File size exceeds 20 MB limit' };
  }

  const filename = (file.originalname || '').toLowerCase();
  const matchedExt = ALLOWED_EXTENSIONS.find((ext) => filename.endsWith(ext));
  if (!matchedExt) {
    return {
      isValid: false,
      error: `File type not supported. Allowed formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG`
    };
  }

  const magic = detectMagicBytes(file.buffer);
  if (!magic) {
    return {
      isValid: false,
      error: 'File signature invalid or corrupt. Please ensure it is a valid document or image.'
    };
  }

  // Verify consistency with extension
  if (matchedExt === '.pdf' && magic.ext !== 'pdf') {
    return { isValid: false, error: 'Corrupt file: File extension is PDF but content is not valid PDF' };
  }
  if ((matchedExt === '.jpg' || matchedExt === '.jpeg') && magic.ext !== 'jpg') {
    return { isValid: false, error: 'Corrupt file: Expected valid JPEG image' };
  }
  if (matchedExt === '.png' && magic.ext !== 'png') {
    return { isValid: false, error: 'Corrupt file: Expected valid PNG image' };
  }
  if ((matchedExt === '.docx' || matchedExt === '.pptx') && magic.ext !== 'office_zip') {
    return { isValid: false, error: 'Corrupt file: Expected valid Office OpenXML document' };
  }
  if ((matchedExt === '.doc' || matchedExt === '.ppt') && magic.ext !== 'office_ole' && magic.ext !== 'office_zip') {
    return { isValid: false, error: 'Corrupt file: Expected valid Microsoft Office document' };
  }

  return { isValid: true, detectedType: magic.ext };
};

module.exports = {
  detectMagicBytes,
  validateUploadedFile,
  ALLOWED_EXTENSIONS
};
