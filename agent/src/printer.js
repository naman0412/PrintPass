const fs = require('fs');

/**
 * Maps job print options to pdf-to-printer arguments.
 */
const buildPrintArgs = (options = {}, printerName = '') => {
  const args = {};

  if (printerName) {
    args.printer = printerName;
  }

  // Copies
  if (options.copies && options.copies > 1) {
    args.copies = parseInt(options.copies, 10);
  }

  // Page range (e.g. "1-5", "1,3,5")
  if (options.pageRange && options.pageRange.trim().toLowerCase() !== 'all') {
    args.pages = options.pageRange.trim();
  }

  // Orientation: portrait, landscape
  if (options.orientation && options.orientation !== 'auto') {
    args.orientation = options.orientation.toLowerCase();
  }

  // Duplex: long edge vs short edge vs simplex
  if (options.duplex) {
    args.side = options.duplexEdge === 'short' ? 'duplexshort' : 'duplex';
  } else {
    args.side = 'simplex';
  }

  // Monochrome: true if B/W or monochrome flag set
  if (options.monochrome !== undefined) {
    args.monochrome = Boolean(options.monochrome);
  } else if (options.color === false) {
    args.monochrome = true;
  } else {
    args.monochrome = false;
  }

  // Paper Size: A4, A3
  if (options.paperSize) {
    args.paperSize = options.paperSize.toUpperCase();
  }

  return args;
};

/**
 * Prints PDF document using pdf-to-printer or simulates print in DRY_RUN mode.
 */
const printPdf = async (filePath, printArgs = {}, isDryRun = false) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File to print does not exist: ${filePath}`);
  }

  if (isDryRun) {
    console.log(`[DRY RUN PRINT] Emulating print for file: ${filePath}`);
    console.log(`[DRY RUN PRINT] Arguments applied:`, JSON.stringify(printArgs, null, 2));
    return {
      success: true,
      dryRun: true,
      file: filePath,
      args: printArgs,
      timestamp: new Date()
    };
  }

  // Real print execution using pdf-to-printer
  const pdfToPrinter = require('pdf-to-printer');
  await pdfToPrinter.print(filePath, printArgs);

  return {
    success: true,
    dryRun: false,
    file: filePath,
    args: printArgs,
    timestamp: new Date()
  };
};

/**
 * Securely deletes a temporary file by overwriting with random bytes/zeros before unlinking.
 */
const secureDeleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const zeros = Buffer.alloc(stats.size, 0);
      fs.writeFileSync(filePath, zeros);
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.error(`[Secure Delete Warning] Could not securely overwrite ${filePath}:`, err.message);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
      // ignore
    }
  }
  return false;
};

module.exports = {
  buildPrintArgs,
  printPdf,
  secureDeleteFile
};
