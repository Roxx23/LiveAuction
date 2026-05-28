const AuctionService = require('../services/AuctionService');
const { Bidder, Auction, Shop, Bid } = require('../models');

function setupSocket(io) {
  // Give AuctionService access to io for broadcasting
  AuctionService.setIo(io);

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a shop's auction room
    socket.on('join:auction', async ({ shopDomain }) => {
      if (!shopDomain) return;

      socket.join(shopDomain);
      socket.shopDomain = shopDomain;

      // Send current active auction state if one exists
      try {
        const shop = await Shop.findOne({ where: { shopDomain } });
        if (!shop) return;

        const auction = await AuctionService.getActiveAuction(shop.id);
        if (auction) {
          const bidCount = await Bid.count({ where: { auctionId: auction.id } });
          const recentBids = await Bid.findAll({
            where: { auctionId: auction.id },
            include: [Bidder],
            order: [['createdAt', 'DESC']],
            limit: 20,
          });

          socket.emit('auction:started', {
            auctionId: auction.id,
            product: {
              shopifyProductId: auction.shopifyProductId,
              title: auction.productTitle,
              image: auction.productImage,
              description: auction.productDescription,
            },
            startingBid: parseFloat(auction.startingBid),
            currentBid: parseFloat(auction.currentBid),
            endsAt: auction.endsAt,
            shopDomain,
            bidCount,
            recentBids: recentBids.map((b) => ({
              amount: parseFloat(b.amount),
              bidderName: b.Bidder?.displayName || 'Anonymous',
              createdAt: b.createdAt,
            })),
          });
        }
      } catch (err) {
        console.error('Error sending auction state:', err.message);
      }
    });

    // Handle bid placement
    socket.on('bid:place', async ({ auctionId, email, displayName, amount }) => {
      try {
        if (!auctionId || !email || !displayName || !amount) {
          return socket.emit('bid:error', { message: 'Missing required bid fields.' });
        }

        // Find or create bidder
        let [bidder] = await Bidder.findOrCreate({
          where: { email },
          defaults: { displayName },
        });

        // Update display name if changed
        if (bidder.displayName !== displayName) {
          bidder.displayName = displayName;
          await bidder.save();
        }

        await AuctionService.placeBid(auctionId, bidder.id, amount);
      } catch (err) {
        socket.emit('bid:error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSocket;
