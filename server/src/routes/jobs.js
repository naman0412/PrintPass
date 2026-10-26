const express = require('express');
const router = express.Router();
const { z } = require('zod');
const Shop = require('../models/Shop');
const { Job } = require('../models/Job');
const { calculateQuote, calculateEstimatedWait } = require('../services/pricingService');
const { getAvailableSlots, holdSlot, releaseHold } = require('../services/slotService');

const optionsSchema = z.object({
  color: z.boolean().optional().default(false),
  colorPageRanges: z.string().optional().default(''),
  orientation: z.enum(['auto', 'portrait', 'landscape']).optional().default('auto'),
  duplex: z.boolean().optional().default(false),
  copies: z.number().int().min(1).max(100).optional().default(1),
  pageRange: z.string().optional().default('all'),
  paperSize: z.enum(['A4', 'A3']).optional().default('A4'),
  binding: z.enum(['none', 'spiral', 'staple', 'punch']).optional().default('none'),
  notes: z.string().max(500).optional().default('')
});

const quoteRequestSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required'),
  pageCount: z.number().int().min(1, 'Page count must be at least 1'),
  options: optionsSchema.optional().default({})
});

// POST /api/jobs/quote - Calculate server-computed price and wait time
router.post('/quote', async (req, res, next) => {
  try {
    const parseResult = quoteRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { shopId, pageCount, options } = parseResult.data;
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Compute pages queued ahead in this shop
    const queuedJobs = await Job.find({
      shopId,
      status: { $in: ['QUEUED', 'PRINTING'] }
    });

    const queuedPagesAhead = queuedJobs.reduce(
      (sum, j) => sum + j.pageCount * (j.options?.copies || 1),
      0
    );

    const quote = calculateQuote(shop.pricing, pageCount, options);
    const estimatedWaitMinutes = calculateEstimatedWait(
      queuedPagesAhead,
      shop.settings,
      options.binding
    );

    res.status(200).json({
      success: true,
      quote,
      estimatedWaitMinutes,
      queuedJobsCount: queuedJobs.length,
      shopPaused: shop.settings.isPaused
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/slots - Available pickup slots
router.get('/slots', async (req, res, next) => {
  try {
    const { shopId, date, requiredPages } = req.query;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'shopId query parameter is required' });
    }

    const targetDate = date ? new Date(date) : new Date();
    const pages = parseInt(requiredPages, 10) || 1;

    const slots = await getAvailableSlots(shopId, targetDate, pages);
    res.status(200).json({
      success: true,
      slots
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/hold-slot - Atomically hold a slot for 5 minutes
router.post('/hold-slot', async (req, res, next) => {
  try {
    const { shopId, slotStart, slotEnd, pages } = req.body;
    if (!shopId || !slotStart || !slotEnd) {
      return res.status(400).json({
        success: false,
        error: 'shopId, slotStart, and slotEnd are required'
      });
    }

    const pageCount = parseInt(pages, 10) || 1;
    const holdResult = await holdSlot(shopId, slotStart, slotEnd, pageCount, 5);

    if (!holdResult.success) {
      return res.status(409).json({
        success: false,
        error: holdResult.error
      });
    }

    res.status(200).json({
      success: true,
      hold: holdResult
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/release-hold - Release a held slot
router.post('/release-hold', async (req, res, next) => {
  try {
    const { shopId, slotStart, holdId } = req.body;
    if (!shopId || !slotStart || !holdId) {
      return res.status(400).json({ success: false, error: 'shopId, slotStart, and holdId are required' });
    }

    await releaseHold(shopId, slotStart, holdId);
    res.status(200).json({ success: true, message: 'Hold released successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
