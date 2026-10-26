const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token missing. Please log in.'
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account not found.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token.'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        req.user = user;
      }
    }
  } catch (e) {
    // Silently continue without user
  }
  next();
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: requires one of [${allowedRoles.join(', ')}] role.`
      });
    }

    next();
  };
};

// Ensures staff belong to exactly one shop and scopes requests
const requireShopStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  if (req.user.role !== 'operator' && req.user.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Access restricted to shop staff only.' });
  }

  if (!req.user.shopId) {
    return res.status(403).json({ success: false, error: 'Staff account is not assigned to any shop.' });
  }

  // Cross-shop isolation check
  const requestedShopId = req.params.shopId || req.query.shopId || (req.body && req.body.shopId);
  if (requestedShopId && requestedShopId.toString() !== req.user.shopId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Cannot access or modify another shop\'s data.'
    });
  }

  req.shopId = req.user.shopId;
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requireShopStaff
};
