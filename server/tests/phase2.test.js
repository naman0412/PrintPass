const request = require('supertest');
const app = require('../src/app');
const Shop = require('../src/models/Shop');
const Slot = require('../src/models/Slot');
const { calculateQuote, calculateEstimatedWait } = require('../src/services/pricingService');
const { holdSlot, releaseExpiredHolds } = require('../src/services/slotService');
const { setupDB } = require('./setup');

setupDB();

describe('Phase 2: Pricing, Files & Atomic Slots', () => {
  describe('Pricing Engine (Many Cases)', () => {
    const shopPricing = {
      bwPerPage: 2,
      colorPerPage: 10,
      duplexDiscount: 0.5,
      spiral: 30,
      staple: 5,
      punch: 2,
      a3Multiplier: 2.0
    };

    it('Case 1: Standard B/W single-sided (10 pages)', () => {
      const quote = calculateQuote(shopPricing, 10, {
        color: false,
        duplex: false,
        copies: 1,
        paperSize: 'A4',
        binding: 'none'
      });
      expect(quote.bwPages).toBe(10);
      expect(quote.colorPages).toBe(0);
      expect(quote.baseCost).toBe(20);
      expect(quote.duplexDiscount).toBe(0);
      expect(quote.bindingCost).toBe(0);
      expect(quote.total).toBe(20);
    });

    it('Case 2: Standard B/W duplex (10 pages with 5 back sides)', () => {
      const quote = calculateQuote(shopPricing, 10, {
        color: false,
        duplex: true,
        copies: 1,
        paperSize: 'A4',
        binding: 'none'
      });
      // 10 pages * 2 = 20; 5 back sides * 0.5 discount = 2.50 discount; total = 17.50
      expect(quote.baseCost).toBe(20);
      expect(quote.duplexDiscount).toBe(2.5);
      expect(quote.total).toBe(17.5);
    });

    it('Case 3: All Color single-sided (5 pages)', () => {
      const quote = calculateQuote(shopPricing, 5, {
        color: true,
        colorPageRanges: 'all',
        duplex: false,
        copies: 1,
        paperSize: 'A4',
        binding: 'none'
      });
      // 5 * 10 = 50
      expect(quote.colorPages).toBe(5);
      expect(quote.bwPages).toBe(0);
      expect(quote.total).toBe(50);
    });

    it('Case 4: Mixed Color & B/W (10 pages total, color pages "1, 3-4")', () => {
      const quote = calculateQuote(shopPricing, 10, {
        color: true,
        colorPageRanges: '1, 3-4', // 3 color pages (1, 3, 4), 7 B&W pages (2, 5, 6, 7, 8, 9, 10)
        duplex: false,
        copies: 1,
        paperSize: 'A4',
        binding: 'none'
      });
      expect(quote.colorPages).toBe(3);
      expect(quote.bwPages).toBe(7);
      // 3 * 10 + 7 * 2 = 30 + 14 = 44
      expect(quote.total).toBe(44);
    });

    it('Case 5: A3 Paper Multiplier (4 B/W pages @ 2.0x)', () => {
      const quote = calculateQuote(shopPricing, 4, {
        color: false,
        paperSize: 'A3',
        copies: 1,
        binding: 'none'
      });
      // 4 * (2 * 2.0) = 16
      expect(quote.total).toBe(16);
    });

    it('Case 6: Binding Options (Spiral, Staple, Punch)', () => {
      const spiral = calculateQuote(shopPricing, 5, { binding: 'spiral' });
      expect(spiral.bindingCost).toBe(30);
      expect(spiral.total).toBe(40); // 10 base + 30

      const staple = calculateQuote(shopPricing, 5, { binding: 'staple' });
      expect(staple.bindingCost).toBe(5);
      expect(staple.total).toBe(15); // 10 base + 5

      const punch = calculateQuote(shopPricing, 5, { binding: 'punch' });
      expect(punch.bindingCost).toBe(2);
      expect(punch.total).toBe(12); // 10 base + 2
    });

    it('Case 7: Multiple Copies with Duplex & Spiral Binding', () => {
      const quote = calculateQuote(shopPricing, 10, {
        color: false,
        duplex: true,
        copies: 3,
        binding: 'spiral'
      });
      // Per copy: base 20, discount 2.50 -> 17.50 subtotal; 30 binding -> 47.50 per copy
      // 3 copies -> 47.50 * 3 = 142.50
      expect(quote.totalPages).toBe(30);
      expect(quote.duplexDiscount).toBe(7.5);
      expect(quote.bindingCost).toBe(90);
      expect(quote.total).toBe(142.5);
    });

    it('Case 8: Selected Sub-range of Pages (Print pages 3 to 6 out of 20)', () => {
      const quote = calculateQuote(shopPricing, 20, {
        pageRange: '3-6', // 4 pages
        color: false,
        copies: 1,
        binding: 'none'
      });
      expect(quote.totalPages).toBe(4);
      expect(quote.total).toBe(8); // 4 * 2 = 8
    });
  });

  describe('Estimated Wait Calculation', () => {
    it('should compute wait time = (queuedPages / ppm) + finishing + 5 min buffer', () => {
      const shopSettings = {
        pagesPerMinute: 20,
        bufferMinutes: 5,
        finishingMinutesSpiral: 3
      };

      // 60 pages ahead / 20 ppm = 3 min print + 3 min spiral + 5 min buffer = 11 minutes
      const waitMinutes = calculateEstimatedWait(60, shopSettings, 'spiral');
      expect(waitMinutes).toBe(11);
    });
  });

  describe('Quote API Endpoint', () => {
    let testShop;

    beforeEach(async () => {
      testShop = await Shop.create({
        name: 'Quote Test Shop',
        code: 'quote-shop',
        address: 'Main Quad',
        pricing: {
          bwPerPage: 3,
          colorPerPage: 15,
          duplexDiscount: 1,
          spiral: 25
        },
        settings: {
          pagesPerMinute: 30,
          bufferMinutes: 5
        }
      });
    });

    it('POST /api/jobs/quote should calculate quote server-side and never trust client price', async () => {
      const res = await request(app)
        .post('/api/jobs/quote')
        .send({
          shopId: testShop._id.toString(),
          pageCount: 10,
          options: {
            color: false,
            duplex: true,
            binding: 'spiral'
          },
          // Malicious attempt to spoof client total
          total: 1.0
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // 10 * 3 = 30 base, 5 duplex * 1 = 5 discount -> 25 subtotal + 25 spiral = 50 total
      expect(res.body.quote.total).toBe(50);
      expect(res.body.estimatedWaitMinutes).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Slot Capacity & Concurrent-Hold Race Protection', () => {
    let limitedShop;
    const futureSlotStart = new Date(Date.now() + 2 * 3600 * 1000); // 2 hours in future
    const futureSlotEnd = new Date(futureSlotStart.getTime() + 15 * 60 * 1000);

    beforeEach(async () => {
      limitedShop = await Shop.create({
        name: 'Limited Capacity Shop',
        code: 'limited-shop',
        address: 'Room 5',
        settings: {
          slotMinutes: 15,
          slotCapacityPages: 100,
          slotCapacityJobs: 2, // ONLY 2 JOBS ALLOWED PER SLOT
          pagesPerMinute: 25,
          bufferMinutes: 5,
          openTime: '06:00',
          closeTime: '23:00'
        }
      });
    });

    it('RACE CONDITION TEST: 10 concurrent requests for a 2-job slot must result in EXACTLY 2 holds and 8 rejections', async () => {
      const shopId = limitedShop._id.toString();

      // Launch 10 simultaneous hold requests concurrently
      const concurrentRequests = Array.from({ length: 10 }, () =>
        holdSlot(shopId, futureSlotStart, futureSlotEnd, 10)
      );

      const results = await Promise.all(concurrentRequests);

      const successfulHolds = results.filter((r) => r.success === true);
      const rejectedHolds = results.filter((r) => r.success === false);

      expect(successfulHolds.length).toBe(2);
      expect(rejectedHolds.length).toBe(8);

      // Verify slot in DB has exactly 2 heldJobs and 20 heldPages
      const slotDoc = await Slot.findOne({ shopId: limitedShop._id, slotStart: futureSlotStart });
      expect(slotDoc).toBeDefined();
      expect(slotDoc.heldJobs).toBe(2);
      expect(slotDoc.heldPages).toBe(20);
      expect(slotDoc.holds.length).toBe(2);
    });

    it('should release expired holds and free up capacity', async () => {
      const shopId = limitedShop._id.toString();

      // Create a hold that already expired 1 minute ago
      await Slot.create({
        shopId: limitedShop._id,
        slotStart: futureSlotStart,
        slotEnd: futureSlotEnd,
        heldPages: 50,
        heldJobs: 1,
        holds: [
          {
            holdId: 'expired_hold_1',
            pages: 50,
            jobs: 1,
            expiresAt: new Date(Date.now() - 60000)
          }
        ]
      });

      // Release expired holds
      await releaseExpiredHolds(shopId);

      const updatedSlot = await Slot.findOne({ shopId: limitedShop._id, slotStart: futureSlotStart });
      expect(updatedSlot.heldPages).toBe(0);
      expect(updatedSlot.heldJobs).toBe(0);
      expect(updatedSlot.holds.length).toBe(0);
    });
  });
});
