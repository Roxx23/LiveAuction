const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Auction = sequelize.define('Auction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    shopId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    shopifyProductId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    productTitle: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    productImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    productDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    startingBid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currentBid: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    currentBidderId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'sold', 'unsold'),
      defaultValue: 'pending',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endsAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  return Auction;
};
