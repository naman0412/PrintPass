const fs = require('fs');
const path = require('path');
const os = require('os');
const { PDFDocument } = require('pdf-lib');

/**
 * Parses color range string (e.g. "1, 3-5") into a set of 1-based page numbers.
 */
const parseRangeToSet = (rangeStr, maxPages) => {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
    return new Set(Array.from({ length: maxPages }, (_, i) => i + 1));
  }

  const pages = new Set();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        const from = Math.max(1, Math.min(start, end));
        const to = Math.min(maxPages, Math.max(start, end));
        for (let p = from; p <= to; p++) {
          pages.add(p);
        }
      }
    } else {
      const single = parseInt(trimmed, 10);
      if (!isNaN(single) && single >= 1 && single <= maxPages) {
        pages.add(single);
      }
    }
  }

  return pages;
};

/**
 * Checks if a job has mixed color and B&W pages, and splits the PDF into two sub-PDFs.
 * Returns array of print tasks: [{ filePath, monochrome, pageCount, isSplit }]
 */
const splitPdfByColor = async (inputPdfPath, options = {}) => {
  if (!options.color || !options.colorPageRanges || options.colorPageRanges.trim().toLowerCase() === 'all') {
    return [
      {
        filePath: inputPdfPath,
        monochrome: !options.color,
        isSplit: false
      }
    ];
  }

  const fileBuffer = fs.readFileSync(inputPdfPath);
  const srcDoc = await PDFDocument.load(fileBuffer);
  const totalPages = srcDoc.getPageCount();

  const colorPageSet = parseRangeToSet(options.colorPageRanges, totalPages);

  const colorIndices = [];
  const bwIndices = [];

  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    if (colorPageSet.has(pageNum)) {
      colorIndices.push(i);
    } else {
      bwIndices.push(i);
    }
  }

  // If no mixed pages (either all color or all BW)
  if (colorIndices.length === 0) {
    return [{ filePath: inputPdfPath, monochrome: true, isSplit: false }];
  }
  if (bwIndices.length === 0) {
    return [{ filePath: inputPdfPath, monochrome: false, isSplit: false }];
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-split-'));
  const tasks = [];

  // Create Color PDF part
  if (colorIndices.length > 0) {
    const colorDoc = await PDFDocument.create();
    const copiedColorPages = await colorDoc.copyPages(srcDoc, colorIndices);
    copiedColorPages.forEach((p) => colorDoc.addPage(p));
    const colorBytes = await colorDoc.save();
    const colorFilePath = path.join(tempDir, 'color_part.pdf');
    fs.writeFileSync(colorFilePath, colorBytes);
    tasks.push({
      filePath: colorFilePath,
      monochrome: false,
      isSplit: true,
      pageCount: colorIndices.length
    });
  }

  // Create B/W PDF part
  if (bwIndices.length > 0) {
    const bwDoc = await PDFDocument.create();
    const copiedBwPages = await bwDoc.copyPages(srcDoc, bwIndices);
    copiedBwPages.forEach((p) => bwDoc.addPage(p));
    const bwBytes = await bwDoc.save();
    const bwFilePath = path.join(tempDir, 'bw_part.pdf');
    fs.writeFileSync(bwFilePath, bwBytes);
    tasks.push({
      filePath: bwFilePath,
      monochrome: true,
      isSplit: true,
      pageCount: bwIndices.length
    });
  }

  return tasks;
};

module.exports = {
  parseRangeToSet,
  splitPdfByColor
};
