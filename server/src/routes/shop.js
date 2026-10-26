const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');
const { Job } = require('../models/Job');
const { authenticate, requireRole, requireShopStaff } = require('../middleware/auth');

// GET /api/shops - list public shops
router.get('/', async (req, res, next) => {
  try {
    const shops = await Shop.find().select('-agentKey');
    const shopsWithStatus = shops.map((shop) => ({
      ...shop.toObject(),
      agentOnline: shop.isAgentOnline()
    }));
    res.status(200).json({ success: true, shops: shopsWithStatus });
  } catch (err) {
    next(err);
  }
});

// GET /api/shops/:id - public shop details
router.get('/:id', async (req, res, next) => {
  try {
    let shop = null;
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      shop = await Shop.findById(req.params.id).select('-agentKey');
    } else {
      shop = await Shop.findOne({ code: req.params.id }).select('-agentKey');
    }

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    res.status(200).json({
      success: true,
      shop: {
        ...shop.toObject(),
        agentOnline: shop.isAgentOnline()
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/shops/:shopId/dashboard - Staff only (operator or owner)
router.get('/:shopId/dashboard', authenticate, requireShopStaff, async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.shopId).select('-agentKey');
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Today's date range
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [queuedCount, printingCount, readyCount, collectedCountToday, jobsToday] = await Promise.all([
      Job.countDocuments({ shopId: req.shopId, status: 'QUEUED' }),
      Job.countDocuments({ shopId: req.shopId, status: { $in: ['PRINTING', 'PRINTED', 'FINISHING'] } }),
      Job.countDocuments({ shopId: req.shopId, status: 'READY' }),
      Job.countDocuments({ shopId: req.shopId, status: 'COLLECTED', collectedAt: { $gte: startOfDay } }),
      Job.find({ shopId: req.shopId, createdAt: { $gte: startOfDay }, status: { $nin: ['DRAFT', 'PENDING_PAYMENT', 'CANCELLED'] } })
    ]);

    const pagesPrintedToday = jobsToday.reduce((sum, j) => sum + (j.pageCount * (j.options?.copies || 1)), 0);
    const revenueToday = jobsToday.reduce((sum, j) => sum + (j.pricing?.total || 0), 0);

    res.status(200).json({
      success: true,
      shop: {
        ...shop.toObject(),
        agentOnline: shop.isAgentOnline()
      },
      stats: {
        queuedCount,
        printingCount,
        readyCount,
        collectedCountToday,
        pagesPrintedToday,
        revenueToday
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/shops/:shopId/settings - Staff only (update pricing and settings)
router.put('/:shopId/settings', authenticate, requireShopStaff, async (req, res, next) => {
  try {
    const { pricing, settings } = req.body;
    const shop = await Shop.findById(req.shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    if (pricing) {
      shop.pricing = { ...shop.pricing.toObject(), ...pricing };
    }
    if (settings) {
      shop.settings = { ...shop.settings.toObject(), ...settings };
    }

    await shop.save();

    res.status(200).json({
      success: true,
      shop: {
        ...shop.toObject(),
        agentOnline: shop.isAgentOnline()
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/shops/:shopId/agent-key - Owner only
router.get('/:shopId/agent-key', authenticate, requireRole('owner'), requireShopStaff, async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    res.status(200).json({
      success: true,
      agentKey: shop.agentKey,
      agentOnline: shop.isAgentOnline(),
      agentLastSeen: shop.agentLastSeen
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
