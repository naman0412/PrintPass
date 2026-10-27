const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { Job } = require('../models/Job');
const { authenticate, requireRole, requireShopStaff } = require('../middleware/auth');
const config = require('../config/env');

// POST /api/shops/register - External Photocopy Kiosk Self-Onboarding
router.post('/register', async (req, res, next) => {
  try {
    const {
      name,
      code,
      address,
      phone,
      ownerName,
      ownerEmail,
      ownerPassword,
      pricing,
      settings
    } = req.body;

    if (!name || !code || !address || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({
        success: false,
        error: 'name, code, address, ownerName, ownerEmail, and ownerPassword are required'
      });
    }

    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Check if shop code or owner email already exists
    const [existingShop, existingUser] = await Promise.all([
      Shop.findOne({ code: cleanCode }),
      User.findOne({ email: ownerEmail.trim().toLowerCase() })
    ]);

    if (existingShop) {
      return res.status(409).json({ success: false, error: 'A shop with this unique code already exists.' });
    }
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    // Generate unique agent key for the new shop
    const agentKey = `pp_agent_${cleanCode}_${crypto.randomBytes(8).toString('hex')}`;

    const shop = await Shop.create({
      name: name.trim(),
      code: cleanCode,
      address: address.trim(),
      phone: phone || '',
      pricing: {
        bwPerPage: pricing?.bwPerPage || 2.0,
        colorPerPage: pricing?.colorPerPage || 10.0,
        duplexDiscount: pricing?.duplexDiscount || 0.5,
        spiral: pricing?.spiral || 30.0,
        staple: pricing?.staple || 5.0,
        punch: pricing?.punch || 2.0,
        a3Multiplier: pricing?.a3Multiplier || 2.0
      },
      settings: {
        slotMinutes: settings?.slotMinutes || 15,
        slotCapacityPages: settings?.slotCapacityPages || 200,
        slotCapacityJobs: settings?.slotCapacityJobs || 10,
        pagesPerMinute: settings?.pagesPerMinute || 25,
        bufferMinutes: settings?.bufferMinutes || 5,
        openTime: settings?.openTime || '08:00',
        closeTime: settings?.closeTime || '20:00',
        isPaused: false
      },
      agentKey
    });

    const owner = await User.create({
      name: ownerName.trim(),
      email: ownerEmail.trim().toLowerCase(),
      password: ownerPassword,
      role: 'owner',
      shopId: shop._id,
      phone: phone || ''
    });

    // Create session token and set httpOnly cookie
    const token = jwt.sign(
      {
        id: owner._id,
        email: owner.email,
        role: owner.role,
        shopId: shop._id
      },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const cookieOptions = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax'
    };
    res.cookie('token', token, cookieOptions);

    res.status(201).json({
      success: true,
      message: 'Photocopy kiosk and Owner account registered successfully!',
      token,
      shop: {
        id: shop._id,
        name: shop.name,
        code: shop.code,
        address: shop.address,
        agentKey: shop.agentKey
      },
      user: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
        shopId: shop._id
      }
    });
  } catch (err) {
    next(err);
  }
});

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
