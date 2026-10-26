const fs = require('fs');
const path = require('path');
const os = require('os');
const { PDFDocument } = require('pdf-lib');
const { buildPrintArgs, printPdf, secureDeleteFile } = require('../src/printer');
const { splitPdfByColor, parseRangeToSet } = require('../src/splitter');

describe('Phase 5: Print Agent Tests', () => {
  describe('Options to Print Args Mapping', () => {
    it('should map standard single-sided B/W job correctly', () => {
      const options = {
        color: false,
        duplex: false,
        copies: 1,
        paperSize: 'A4',
        orientation: 'auto'
      };

      const args = buildPrintArgs(options, 'HP LaserJet Pro');
      expect(args.printer).toBe('HP LaserJet Pro');
      expect(args.side).toBe('simplex');
      expect(args.monochrome).toBe(true);
      expect(args.paperSize).toBe('A4');
      expect(args.copies).toBeUndefined(); // default 1 omitted for printer default
      expect(args.pages).toBeUndefined();
      expect(args.orientation).toBeUndefined(); // 'auto' omitted
    });

    it('should map duplex long-edge with copies and custom page range', () => {
      const options = {
        color: true,
        duplex: true,
        duplexEdge: 'long',
        copies: 3,
        pageRange: '2-8',
        orientation: 'landscape',
        paperSize: 'A3'
      };

      const args = buildPrintArgs(options, 'Canon IR');
      expect(args.printer).toBe('Canon IR');
      expect(args.side).toBe('duplex');
      expect(args.copies).toBe(3);
      expect(args.pages).toBe('2-8');
      expect(args.orientation).toBe('landscape');
      expect(args.paperSize).toBe('A3');
      expect(args.monochrome).toBe(false);
    });

    it('should map duplex short-edge when specified', () => {
      const options = {
        duplex: true,
        duplexEdge: 'short'
      };

      const args = buildPrintArgs(options);
      expect(args.side).toBe('duplexshort');
    });
  });

  describe('DRY_RUN Printing', () => {
    let tempFilePath;

    beforeAll(() => {
      tempFilePath = path.join(os.tmpdir(), `agent_test_${Date.now()}.pdf`);
      fs.writeFileSync(tempFilePath, Buffer.from('%PDF-1.4 dry run test file'));
    });

    afterAll(() => {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    it('should execute print in DRY_RUN mode without calling hardware printer', async () => {
      const printArgs = {
        printer: 'Virtual Printer',
        side: 'duplex',
        monochrome: true
      };

      const result = await printPdf(tempFilePath, printArgs, true); // dryRun = true
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.file).toBe(tempFilePath);
      expect(result.args.monochrome).toBe(true);
    });

    it('should throw friendly error if file to print does not exist', async () => {
      await expect(printPdf('/non/existent/path.pdf', {}, true)).rejects.toThrow(
        /File to print does not exist/
      );
    });
  });

  describe('Secure File Deletion', () => {
    it('should securely overwrite and delete temporary files from disk', () => {
      const testFile = path.join(os.tmpdir(), `privacy_test_${Date.now()}.pdf`);
      fs.writeFileSync(testFile, 'Confidential exam questions and student credentials');

      expect(fs.existsSync(testFile)).toBe(true);

      const deleted = secureDeleteFile(testFile);
      expect(deleted).toBe(true);
      expect(fs.existsSync(testFile)).toBe(false);
    });
  });

  describe('Mixed Color / B&W PDF Splitting', () => {
    let dummyPdfPath;

    beforeAll(async () => {
      // Create a 4-page dummy PDF with pdf-lib
      const doc = await PDFDocument.create();
      doc.addPage([200, 200]);
      doc.addPage([200, 200]);
      doc.addPage([200, 200]);
      doc.addPage([200, 200]);
      const bytes = await doc.save();

      dummyPdfPath = path.join(os.tmpdir(), `split_test_${Date.now()}.pdf`);
      fs.writeFileSync(dummyPdfPath, bytes);
    });

    afterAll(() => {
      if (fs.existsSync(dummyPdfPath)) {
        fs.unlinkSync(dummyPdfPath);
      }
    });

    it('should parse page range strings to set correctly', () => {
      const set = parseRangeToSet('1, 3-4', 5);
      expect(set.has(1)).toBe(true);
      expect(set.has(2)).toBe(false);
      expect(set.has(3)).toBe(true);
      expect(set.has(4)).toBe(true);
      expect(set.has(5)).toBe(false);
    });

    it('should split PDF into color and B/W parts when mixed ranges are provided', async () => {
      const options = {
        color: true,
        colorPageRanges: '1, 3' // pages 1 and 3 are color; pages 2 and 4 are B/W
      };

      const tasks = await splitPdfByColor(dummyPdfPath, options);
      expect(tasks.length).toBe(2);

      const colorTask = tasks.find((t) => t.monochrome === false);
      const bwTask = tasks.find((t) => t.monochrome === true);

      expect(colorTask).toBeDefined();
      expect(colorTask.pageCount).toBe(2);
      expect(bwTask).toBeDefined();
      expect(bwTask.pageCount).toBe(2);

      // Clean up split files
      tasks.forEach((t) => {
        if (t.isSplit) secureDeleteFile(t.filePath);
      });
    });

    it('should not split when entire job is color or entire job is B/W', async () => {
      const allColorTasks = await splitPdfByColor(dummyPdfPath, { color: true, colorPageRanges: 'all' });
      expect(allColorTasks.length).toBe(1);
      expect(allColorTasks[0].isSplit).toBe(false);
      expect(allColorTasks[0].monochrome).toBe(false);

      const bwTasks = await splitPdfByColor(dummyPdfPath, { color: false });
      expect(bwTasks.length).toBe(1);
      expect(bwTasks[0].isSplit).toBe(false);
      expect(bwTasks[0].monochrome).toBe(true);
    });
  });
});
