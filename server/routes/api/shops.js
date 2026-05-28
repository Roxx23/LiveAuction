const express = require('express');
const router = express.Router();

// GET /api/shop — Get current shop info and settings
router.get('/', async (req, res) => {
  try {
    const shop = req.shop;
    res.json({
      id: shop.id,
      shopDomain: shop.shopDomain,
      shopName: shop.shopName,
      email: shop.email,
      isActive: shop.isActive,
      auctionSettings: shop.auctionSettings,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shop/settings — Update auction settings
router.put('/settings', async (req, res) => {
  try {
    const shop = req.shop;
    const { defaultStartingBid, auctionDurationSeconds, autoStartNext } = req.body;

    shop.auctionSettings = {
      ...shop.auctionSettings,
      ...(defaultStartingBid !== undefined && { defaultStartingBid: parseFloat(defaultStartingBid) }),
      ...(auctionDurationSeconds !== undefined && { auctionDurationSeconds: parseInt(auctionDurationSeconds, 10) }),
      ...(autoStartNext !== undefined && { autoStartNext }),
    };

    // Force Sequelize to detect the JSON change
    shop.changed('auctionSettings', true);
    await shop.save();

    res.json({ message: 'Settings updated', auctionSettings: shop.auctionSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
