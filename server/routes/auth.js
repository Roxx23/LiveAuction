const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const shopify = require('../shopify/shopifyClient');
const { Shop } = require('../models');
const AutoAuctionManager = require('../services/AutoAuctionManager');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// In-memory nonce store (maps nonce → shop). Good enough for dev; use Redis in prod.
const nonceStore = new Map();

// GET /auth?shop=storename.myshopify.com
// Redirects store owner to Shopify OAuth consent screen
router.get('/', (req, res) => {
  const shop = req.query.shop;
  if (!shop || !shop.endsWith('.myshopify.com')) {
    return res.status(400).send('Missing or invalid ?shop parameter. Use ?shop=yourstore.myshopify.com');
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  nonceStore.set(nonce, shop);

  const scopes = process.env.SCOPES || 'read_products,write_products,read_orders,write_orders';
  const redirectUri = `${process.env.HOST}/auth/callback`;

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${nonce}`;

  res.redirect(authUrl);
});

// GET /auth/callback — Handles Shopify OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, shop, state, hmac } = req.query;

    // Verify nonce
    if (!state || nonceStore.get(state) !== shop) {
      return res.status(403).send('Invalid state parameter. Possible CSRF attack.');
    }
    nonceStore.delete(state);

    // Verify HMAC
    const queryParams = { ...req.query };
    delete queryParams.hmac;
    delete queryParams.signature;

    const sortedParams = Object.keys(queryParams)
      .sort()
      .map((key) => `${key}=${queryParams[key]}`)
      .join('&');

    const generatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
      .update(sortedParams)
      .digest('hex');

    if (generatedHmac !== hmac) {
      return res.status(403).send('HMAC validation failed.');
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const { access_token } = await tokenResponse.json();

    // Fetch shop info
    const shopInfoRes = await fetch(`https://${shop}/admin/api/${shopify.config.apiVersion}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    });
    const { shop: shopInfo } = await shopInfoRes.json();

    // Upsert shop record
    const [shopRecord] = await Shop.findOrCreate({
      where: { shopDomain: shop },
      defaults: {
        accessToken: access_token,
        shopName: shopInfo.name,
        email: shopInfo.email,
        isActive: true,
      },
    });

    // Update token and info on re-installs
    shopRecord.accessToken = access_token;
    shopRecord.shopName = shopInfo.name;
    shopRecord.email = shopInfo.email;
    shopRecord.isActive = true;
    await shopRecord.save();

    // Auto-start 24/7 auction loop for this shop
    AutoAuctionManager.startLoop(shopRecord.id);

    // Create JWT for admin session
    const token = jwt.sign(
      { shopDomain: shop, shopId: shopRecord.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie and redirect to admin dashboard
    res.cookie('shopToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    const clientUrl = process.env.NODE_ENV === 'production'
      ? '/admin'
      : `http://localhost:${process.env.CLIENT_PORT || 5173}/admin`;

    res.redirect(`${clientUrl}?token=${token}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`Authentication failed: ${err.message}`);
  }
});

// GET /auth/verify — Check if current session is valid
router.get('/verify', async (req, res) => {
  try {
    const token =
      req.cookies?.shopToken ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.json({ authenticated: false });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const shop = await Shop.findOne({ where: { shopDomain: decoded.shopDomain } });

    if (!shop || !shop.isActive) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      shop: {
        id: shop.id,
        shopDomain: shop.shopDomain,
        shopName: shop.shopName,
        email: shop.email,
      },
    });
  } catch {
    res.json({ authenticated: false });
  }
});

module.exports = router;
