const express = require('express');
const jwt = require('jsonwebtoken');
const { Shop, Auction, Bid, Bidder } = require('../../models');
const AuctionService = require('../../services/AuctionService');

const router = express.Router();

// GET /api/public/:shopDomain/auction — Get active auction for a shop
router.get('/:shopDomain/auction', async (req, res) => {
  try {
    const shop = await Shop.findOne({ where: { shopDomain: req.params.shopDomain } });
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found.' });
    }

    const auction = await AuctionService.getActiveAuction(shop.id);
    if (!auction) {
      return res.json({ auction: null, shopName: shop.shopName });
    }

    const bidCount = await Bid.count({ where: { auctionId: auction.id } });
    const recentBids = await Bid.findAll({
      where: { auctionId: auction.id },
      include: [Bidder],
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    res.json({
      auction: {
        id: auction.id,
        product: {
          shopifyProductId: auction.shopifyProductId,
          title: auction.productTitle,
          image: auction.productImage,
          description: auction.productDescription,
        },
        startingBid: parseFloat(auction.startingBid),
        currentBid: parseFloat(auction.currentBid),
        status: auction.status,
        endsAt: auction.endsAt,
      },
      shopName: shop.shopName,
      bidCount,
      recentBids: recentBids.map((b) => ({
        amount: parseFloat(b.amount),
        bidderName: b.Bidder?.displayName || 'Anonymous',
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/:shopDomain/history — Recent auction results
router.get('/:shopDomain/history', async (req, res) => {
  try {
    const shop = await Shop.findOne({ where: { shopDomain: req.params.shopDomain } });
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found.' });
    }

    const auctions = await Auction.findAll({
      where: { shopId: shop.id, status: ['sold', 'unsold'] },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    res.json({
      auctions: auctions.map((a) => ({
        id: a.id,
        productTitle: a.productTitle,
        productImage: a.productImage,
        startingBid: parseFloat(a.startingBid),
        currentBid: parseFloat(a.currentBid),
        status: a.status,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/public/bidder/register — Register as a bidder
router.post('/bidder/register', async (req, res) => {
  try {
    const { email, displayName } = req.body;
    if (!email || !displayName) {
      return res.status(400).json({ error: 'email and displayName are required.' });
    }

    let [bidder, created] = await Bidder.findOrCreate({
      where: { email },
      defaults: { displayName },
    });

    if (!created && bidder.displayName !== displayName) {
      bidder.displayName = displayName;
      await bidder.save();
    }

    const sessionToken = jwt.sign(
      { bidderId: bidder.id, email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    bidder.sessionToken = sessionToken;
    await bidder.save();

    res.json({
      bidder: {
        id: bidder.id,
        email: bidder.email,
        displayName: bidder.displayName,
      },
      sessionToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
