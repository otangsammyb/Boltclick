/**
 * Admin JWT Authentication Middleware
 * Supports two roles: 'admin' (restaurant admin) and 'superAdmin' (platform owner)
 */
const jwt = require('jsonwebtoken');
const { auth } = require('../config/env');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, auth.jwtSecret);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * Middleware that allows only superAdmin role.
 * Must be used AFTER authMiddleware.
 */
function superAdminOnly(req, res, next) {
  if (req.admin?.role !== 'superAdmin') {
    return res.status(403).json({ success: false, message: 'Access denied — super admin only' });
  }
  next();
}

module.exports = authMiddleware;
module.exports.superAdminOnly = superAdminOnly;
