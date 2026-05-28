const jwt = require('jsonwebtoken');
const { Shop } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Verifies the admin session JWT and attaches shop to req
const shopifyAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.shopToken ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated. Please install the app first.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const shop = await Shop.findOne({ where: { shopDomain: decoded.shopDomain } });

    if (!shop || !shop.isActive) {
      return res.status(401).json({ error: 'Shop not found or inactive.' });
    }

    req.shop = shop;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
};

module.exports = shopifyAuth;
