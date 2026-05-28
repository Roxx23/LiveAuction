const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Bidder = sequelize.define('Bidder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sessionToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  return Bidder;
};
