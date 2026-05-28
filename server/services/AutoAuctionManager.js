const AuctionService = require('./AuctionService');
const { Shop, Auction } = require('../models');

// Tracks running auction loops per shop: shopId → { running: true }
const auctionLoops = new Map();

const PAUSE_BETWEEN_AUCTIONS_MS = 15000; // 15 seconds between auctions

class AutoAuctionManager {
  /**
   * Boot up auction loops for all active shops on server start
   */
  static async initialize() {
    const shops = await Shop.findAll({ where: { isActive: true } });
    console.log(`[AutoAuction] Found ${shops.length} active shop(s). Starting auction loops...`);

    for (const shop of shops) {
      AutoAuctionManager.startLoop(shop.id);
    }
  }

  /**
   * Start a continuous auction loop for a shop
   */
  static startLoop(shopId) {
    if (auctionLoops.has(shopId)) return; // Already running

    auctionLoops.set(shopId, { running: true });
    console.log(`[AutoAuction] Starting loop for shop ${shopId}`);
    AutoAuctionManager._runLoop(shopId);
  }

  /**
   * Stop the auction loop for a shop
   */
  static stopLoop(shopId) {
    auctionLoops.delete(shopId);
    console.log(`[AutoAuction] Stopped loop for shop ${shopId}`);
  }

  /**
   * Internal: the main auction loop
   */
  static async _runLoop(shopId) {
    const state = auctionLoops.get(shopId);
    if (!state || !state.running) return;

    try {
      const shop = await Shop.findByPk(shopId);
      if (!shop || !shop.isActive) {
        AutoAuctionManager.stopLoop(shopId);
        return;
      }

      // Check if there's already an active auction
      const active = await Auction.findOne({ where: { shopId, status: 'active' } });

      if (active) {
        const endsAt = new Date(active.endsAt).getTime();
        if (Date.now() > endsAt) {
          // Auction expired (e.g. server restarted) — end it now
          console.log(`[AutoAuction] Cleaning up expired auction ${active.id}`);
          await AuctionService.endAuction(active.id);
          // Short pause then start next
          setTimeout(() => AutoAuctionManager._runLoop(shopId), 5000);
          return;
        }
        // Still running — wait for it to finish, then check again
        const waitMs = Math.max(endsAt - Date.now() + 2000, 5000);
        setTimeout(() => AutoAuctionManager._runLoop(shopId), waitMs);
        return;
      }

      // Start a new auction
      const startingBid = shop.auctionSettings?.defaultStartingBid || 1.0;
      console.log(`[AutoAuction] Starting new auction for ${shop.shopDomain} (bid: $${startingBid})`);

      await AuctionService.startAuction(shopId, startingBid);

      // Wait for auction duration + pause, then loop again
      const duration = (shop.auctionSettings?.auctionDurationSeconds || 60) * 1000;
      setTimeout(
        () => AutoAuctionManager._runLoop(shopId),
        duration + PAUSE_BETWEEN_AUCTIONS_MS
      );
    } catch (err) {
      console.error(`[AutoAuction] Error for shop ${shopId}:`, err.message);
      // Retry after 30 seconds on error
      setTimeout(() => AutoAuctionManager._runLoop(shopId), 30000);
    }
  }

  /**
   * Check if a shop has a running loop
   */
  static isRunning(shopId) {
    return auctionLoops.has(shopId);
  }
}

module.exports = AutoAuctionManager;
