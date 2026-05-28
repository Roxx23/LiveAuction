const { Auction, Bid, Bidder, Shop, sequelize } = require('../models');
const ProductService = require('./ProductService');

// Active auction timers: shopId → { interval, timeout }
const activeTimers = new Map();

// Socket.io instance — set by socketHandler
let io = null;

class AuctionService {
  static setIo(socketIo) {
    io = socketIo;
  }

  /**
   * Start a new auction for a shop
   */
  static async startAuction(shopId, startingBid) {
    // Check no active auction already exists
    const existing = await Auction.findOne({
      where: { shopId, status: 'active' },
    });
    if (existing) {
      throw new Error('An auction is already active for this shop.');
    }

    const shop = await Shop.findByPk(shopId);
    if (!shop) throw new Error('Shop not found.');

    // Fetch a random product
    const product = await ProductService.fetchRandomProduct(
      shop.shopDomain,
      shop.accessToken
    );

    const durationSeconds = shop.auctionSettings?.auctionDurationSeconds || 60;
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationSeconds * 1000);

    // Create auction record
    const auction = await Auction.create({
      shopId,
      shopifyProductId: product.shopifyProductId,
      productTitle: product.title,
      productImage: product.imageUrl,
      productDescription: product.description,
      startingBid,
      currentBid: 0,
      status: 'active',
      startedAt: now,
      endsAt,
    });

    // Emit auction started
    if (io) {
      io.to(shop.shopDomain).emit('auction:started', {
        auctionId: auction.id,
        product: {
          shopifyProductId: product.shopifyProductId,
          title: product.title,
          image: product.imageUrl,
          description: product.description,
          originalPrice: product.originalPrice,
          variants: product.variants,
        },
        startingBid: parseFloat(startingBid),
        currentBid: 0,
        endsAt: endsAt.toISOString(),
        shopDomain: shop.shopDomain,
      });
    }

    // Start countdown timer
    AuctionService._startTimer(auction.id, shop.shopDomain, durationSeconds);

    return auction;
  }

  /**
   * Place a bid on an active auction
   */
  static async placeBid(auctionId, bidderId, amount) {
    // Use a transaction to prevent race conditions
    return sequelize.transaction(async (t) => {
      const auction = await Auction.findByPk(auctionId, {
        lock: t.LOCK?.UPDATE || true,
        transaction: t,
      });

      if (!auction) throw new Error('Auction not found.');
      if (auction.status !== 'active') throw new Error('Auction is no longer active.');
      if (new Date() > new Date(auction.endsAt)) throw new Error('Auction has ended.');

      const bidAmount = parseFloat(amount);
      const currentBid = parseFloat(auction.currentBid);
      const startingBid = parseFloat(auction.startingBid);

      if (bidAmount < startingBid) {
        throw new Error(`Bid must be at least $${startingBid.toFixed(2)}`);
      }
      if (bidAmount <= currentBid) {
        throw new Error(`Bid must be higher than current bid of $${currentBid.toFixed(2)}`);
      }

      // Create bid record
      const bid = await Bid.create(
        { auctionId, bidderId, amount: bidAmount },
        { transaction: t }
      );

      // Update auction
      auction.currentBid = bidAmount;
      auction.currentBidderId = bidderId;
      await auction.save({ transaction: t });

      // Get bidder info for broadcast
      const bidder = await Bidder.findByPk(bidderId, { transaction: t });
      const bidCount = await Bid.count({ where: { auctionId }, transaction: t });

      const shop = await Shop.findByPk(auction.shopId, { transaction: t });

      // Emit new bid event
      if (io && shop) {
        io.to(shop.shopDomain).emit('auction:newBid', {
          auctionId,
          currentBid: bidAmount,
          bidderName: bidder?.displayName || 'Anonymous',
          bidCount,
          endsAt: auction.endsAt,
        });
      }

      return auction;
    });
  }

  /**
   * End an auction (called when timer expires)
   */
  static async endAuction(auctionId) {
    const auction = await Auction.findByPk(auctionId, {
      include: [{ model: Shop }],
    });

    if (!auction || auction.status !== 'active') return;

    // Clear timers
    AuctionService._clearTimer(auction.shopId);

    const currentBid = parseFloat(auction.currentBid);
    const shop = auction.Shop;

    if (currentBid > 0 && auction.currentBidderId) {
      // SOLD
      auction.status = 'sold';
      await auction.save();

      const bidder = await Bidder.findByPk(auction.currentBidderId);

      // Create draft order on Shopify
      try {
        const product = await ProductService.fetchProductById(
          shop.shopDomain,
          shop.accessToken,
          auction.shopifyProductId
        );

        await ProductService.createDraftOrder(shop.shopDomain, shop.accessToken, {
          email: bidder.email,
          productVariantId: product.variants[0]?.id,
          winningBid: currentBid,
          productTitle: auction.productTitle,
        });
      } catch (err) {
        console.error('Draft order creation failed:', err.message);
      }

      if (io) {
        io.to(shop.shopDomain).emit('auction:sold', {
          auctionId,
          product: {
            title: auction.productTitle,
            image: auction.productImage,
          },
          winningBid: currentBid,
          winnerName: bidder?.displayName || 'Anonymous',
        });
      }
    } else {
      // UNSOLD
      auction.status = 'unsold';
      await auction.save();

      if (io) {
        io.to(shop.shopDomain).emit('auction:unsold', {
          auctionId,
          product: {
            title: auction.productTitle,
            image: auction.productImage,
          },
        });
      }
    }

    // Auto-start next auction if enabled
    if (shop.auctionSettings?.autoStartNext) {
      setTimeout(async () => {
        try {
          await AuctionService.startAuction(
            shop.id,
            shop.auctionSettings?.defaultStartingBid || 1.0
          );
        } catch (err) {
          console.error('Auto-start next auction failed:', err.message);
        }
      }, 10000);
    }

    return auction;
  }

  /**
   * Get the active auction for a shop
   */
  static async getActiveAuction(shopId) {
    return Auction.findOne({
      where: { shopId, status: 'active' },
      include: [
        { model: Bid, include: [Bidder], order: [['createdAt', 'DESC']], limit: 50 },
      ],
    });
  }

  /**
   * Get auction history for a shop
   */
  static async getAuctionHistory(shopId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return Auction.findAndCountAll({
      where: { shopId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  }

  // --- Internal timer methods ---

  static _startTimer(auctionId, shopDomain, durationSeconds) {
    let secondsRemaining = durationSeconds;

    // Tick every second
    const interval = setInterval(() => {
      secondsRemaining--;
      if (io) {
        io.to(shopDomain).emit('auction:tick', { auctionId, secondsRemaining });
      }
      if (secondsRemaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    // End auction when timer expires
    const timeout = setTimeout(() => {
      clearInterval(interval);
      AuctionService.endAuction(auctionId).catch((err) =>
        console.error('Error ending auction:', err)
      );
    }, durationSeconds * 1000);

    activeTimers.set(auctionId, { interval, timeout });
  }

  static _clearTimer(auctionId) {
    const timer = activeTimers.get(auctionId);
    if (timer) {
      clearInterval(timer.interval);
      clearTimeout(timer.timeout);
      activeTimers.delete(auctionId);
    }
  }
}

module.exports = AuctionService;
