require('@shopify/shopify-api/adapters/node');
const { shopifyApi, ApiVersion } = require('@shopify/shopify-api');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const hostName = process.env.HOST
  ? new URL(process.env.HOST).hostname
  : 'localhost';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: (process.env.SCOPES || '').split(','),
  hostName,
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: false,
});

module.exports = shopify;
