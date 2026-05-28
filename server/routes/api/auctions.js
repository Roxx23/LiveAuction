const express = require('express');
const AuctionService = require('../../services/AuctionService');
const { Bid, Bidder } = require('../../models');

const router = express.Router();

// POST /api/auctions/start — Start a new auction
router.post('/start', async (req, res) => {
  try {
    const { startingBid } = req.body;
    if (!startingBid || parseFloat(startingBid) <= 0) {
      return res.status(400).json({ error: 'startingBid must be a positive number.' });
    }

    const auction = await AuctionService.startAuction(req.shop.id, parseFloat(startingBid));
    res.json({ message: 'Auction started', auction });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auctions/active — Get current active auction
router.get('/active', async (req, res) => {
  try {
    const auction = await AuctionService.getActiveAuction(req.shop.id);
    if (!auction) {
      return res.json({ auction: null });
    }
    res.json({ auction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auctions/history — Paginated auction history
router.get('/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const { rows, count } = await AuctionService.getAuctionHistory(req.shop.id, page, limit);
    res.json({
      auctions: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auctions/:id — Get a specific auction with bids
router.get('/:id', async (req, res) => {
  try {
    const { Auction } = require('../../models');
    const auction = await Auction.findOne({
      where: { id: req.params.id, shopId: req.shop.id },
      include: [{ model: Bid, include: [Bidder], order: [['createdAt', 'DESC']] }],
    });

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }
    res.json({ auction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
