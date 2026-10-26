const express = require('express');
const router = express.Router();
const { z } = require('zod');
const Shop = require('../models/Shop');
const { Job } = require('../models/Job');
const { calculateQuote, calculateEstimatedWait } = require('../services/pricingService');
const { getAvailableSlots, holdSlot, releaseHold } = require('../services/slotService');
const { transitionJobState } = require('../services/jobStateMachine');
const { refundJobPayment } = require('../services/paymentService');
const { authenticate, optionalAuth, requireShopStaff } = require('../middleware/auth');

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

// POST /api/jobs - Create a draft job
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      shopId,
      fileId,
      originalFilename,
      fileSize,
      mimeType,
      pageCount,
      options,
      slotStart,
      slotEnd,
      holdId,
      isWalkIn,
      customerName,
      customerPhone
    } = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Always compute pricing server-side
    const pricing = calculateQuote(shop.pricing, pageCount, options);

    const queuedJobs = await Job.find({
      shopId,
      status: { $in: ['QUEUED', 'PRINTING'] }
    });
    const queuedPagesAhead = queuedJobs.reduce(
      (sum, j) => sum + j.pageCount * (j.options?.copies || 1),
      0
    );
    const estimatedWaitMinutes = calculateEstimatedWait(
      queuedPagesAhead,
      shop.settings,
      options?.binding
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours TTL

    const job = await Job.create({
      shopId,
      userId: req.user ? req.user._id : null,
      isWalkIn: Boolean(isWalkIn),
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      fileId,
      originalFilename,
      fileSize,
      mimeType,
      pageCount,
      options: options || {},
      pricing,
      slotStart: slotStart ? new Date(slotStart) : null,
      slotEnd: slotEnd ? new Date(slotEnd) : null,
      holdId: holdId || null,
      status: 'DRAFT',
      estimatedWaitMinutes,
      expiresAt
    });

    res.status(201).json({
      success: true,
      job
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/my - Get current logged in user's jobs
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const jobs = await Job.find({ userId: req.user._id })
      .populate('shopId', 'name address phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      jobs
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/shop/queue - Shop staff queue view
router.get('/shop/queue', authenticate, requireShopStaff, async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { shopId: req.shopId };

    if (status) {
      query.status = status;
    } else {
      // Exclude draft, pending payment, and collected jobs by default
      query.status = { $in: ['QUEUED', 'PRINTING', 'PRINTED', 'FINISHING', 'READY'] };
    }

    // Sort by slotStart ascending
    const jobs = await Job.find(query).sort({ slotStart: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      jobs
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/:id - Get job by ID
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate('shopId', 'name address phone');
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Security: Do not expose fileId to shopkeeper dashboard if they are browsing
    const jobObj = job.toObject();
    if (req.user && req.user.role === 'operator') {
      delete jobObj.fileId;
    }

    res.status(200).json({
      success: true,
      job: jobObj
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/:id/cancel - Cancel job before printing (auto-refunds if paid)
router.post('/:id/cancel', optionalAuth, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Cancellations strictly allowed only BEFORE printing begins
    if (['PRINTING', 'PRINTED', 'FINISHING', 'READY', 'COLLECTED'].includes(job.status)) {
      return res.status(409).json({
        success: false,
        error: `Cannot cancel job in ${job.status} state. Printing has already started.`
      });
    }

    const actor = req.user ? { id: req.user._id, role: req.user.role } : { role: 'student' };
    const updatedJob = await transitionJobState(job._id, 'CANCELLED', actor, 'User requested cancellation');

    // Auto refund if payment was captured
    const refundResult = await refundJobPayment(job._id, 'Job cancelled by user before printing');

    res.status(200).json({
      success: true,
      job: updatedJob,
      refund: refundResult
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/:id/status - Update job state (Operator/Owner)
router.post('/:id/status', authenticate, requireShopStaff, async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    const job = await Job.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found in your shop' });
    }

    const actor = { id: req.user._id, role: req.user.role };
    const updatedJob = await transitionJobState(job._id, status, actor, reason);

    res.status(200).json({
      success: true,
      job: updatedJob
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/verify-pickup - Operator verifies 6-char pickupCode or QR token and marks COLLECTED
router.post('/verify-pickup', authenticate, requireShopStaff, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Pickup code or QR token is required' });
    }

    const trimmedCode = code.trim().toUpperCase();

    // Query by pickupCode or qrToken within operator's shop
    const job = await Job.findOne({
      shopId: req.shopId,
      $or: [
        { pickupCode: trimmedCode },
        { qrToken: code.trim() }
      ]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Invalid pickup code or QR token for this shop.'
      });
    }

    if (job.status !== 'READY') {
      return res.status(409).json({
        success: false,
        error: `Job is currently in ${job.status} status. Only READY jobs can be marked as COLLECTED.`
      });
    }

    const actor = { id: req.user._id, role: req.user.role };
    const collectedJob = await transitionJobState(job._id, 'COLLECTED', actor, 'Operator verified pickup code/QR');

    res.status(200).json({
      success: true,
      message: 'Job verified and marked COLLECTED successfully. File deleted from storage.',
      job: collectedJob
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
