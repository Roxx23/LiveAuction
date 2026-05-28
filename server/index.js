const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { syncDatabase } = require('./models');
const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/api/shops');
const auctionRoutes = require('./routes/api/auctions');
const publicRoutes = require('./routes/api/public');
const proxyRoutes = require('./routes/proxy');
const shopifyAuth = require('./middleware/shopifyAuth');
const setupSocket = require('./websocket/socketHandler');
const AutoAuctionManager = require('./services/AutoAuctionManager');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Allow connections from any Shopify store domain + localhost dev
const io = new Server(server, {
  cors: { origin: '*', credentials: false },
});
setupSocket(io);

// CORS: allow any origin (Shopify stores embed via app proxy)
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/auth', authRoutes);
app.use('/api/shop', shopifyAuth, shopRoutes);
app.use('/api/auctions', shopifyAuth, auctionRoutes);
app.use('/api/public', publicRoutes);
app.use('/proxy', proxyRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'LiveAuction server running' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server + auto-auction loops
syncDatabase().then(async () => {
  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  // Start 24/7 auction loops for all installed shops
  await AutoAuctionManager.initialize();
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

