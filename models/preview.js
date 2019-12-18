'use strict';
module.exports = (sequelize, DataTypes) => {
  const Preview = sequelize.define('Preview', {
    email: DataTypes.STRING,
    epTitle: DataTypes.STRING,
    podTitle: DataTypes.STRING,
    imgLink: DataTypes.STRING,
    audioLink: DataTypes.STRING,
    color: DataTypes.STRING,
    startTime: DataTypes.STRING,
    end_timestamp: DataTypes.INTEGER,
    access_token: DataTypes.STRING,
    status: DataTypes.STRING
  }, {});
  Preview.associate = function(models) {
    // associations can be defined here
  };
  return Preview;
};