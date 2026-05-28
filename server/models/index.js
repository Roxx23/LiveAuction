const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL || 'sqlite::memory:';
const isPostgres = dbUrl.startsWith('postgres');

const sequelize = isPostgres
  ? new Sequelize(dbUrl, { logging: false, dialect: 'postgres' })
  : new Sequelize({
      dialect: 'sqlite',
      storage: path.resolve(__dirname, '../database.sqlite'),
      logging: false,
    });

const Shop = require('./Shop')(sequelize);
const Auction = require('./Auction')(sequelize);
const Bidder = require('./Bidder')(sequelize);
const Bid = require('./Bid')(sequelize);

// Associations
Shop.hasMany(Auction, { foreignKey: 'shopId', onDelete: 'CASCADE' });
Auction.belongsTo(Shop, { foreignKey: 'shopId' });

Auction.hasMany(Bid, { foreignKey: 'auctionId', onDelete: 'CASCADE' });
Bid.belongsTo(Auction, { foreignKey: 'auctionId' });

Bidder.hasMany(Bid, { foreignKey: 'bidderId', onDelete: 'CASCADE' });
Bid.belongsTo(Bidder, { foreignKey: 'bidderId' });

Auction.belongsTo(Bidder, { as: 'currentBidder', foreignKey: 'currentBidderId' });

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    await sequelize.sync();
    console.log('Database models synced.');
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
};

module.exports = { sequelize, Shop, Auction, Bidder, Bid, syncDatabase };
