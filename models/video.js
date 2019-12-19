'use strict';
module.exports = (sequelize, DataTypes) => {
  const Video = sequelize.define('Video', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    email: DataTypes.STRING,
    rss: DataTypes.STRING,
    guid: DataTypes.STRING,
    template: DataTypes.TEXT,
    access_token: DataTypes.STRING,
    end_timestamp: DataTypes.INTEGER,
    status: DataTypes.STRING,
    font: DataTypes.STRING,
    epTitle: DataTypes.STRING,
    epImg: DataTypes.STRING,
    podTitle: DataTypes.STRING,
    podSub: DataTypes.STRING,
    audioURL: DataTypes.STRING
  }, {});
  Video.associate = function(models) {
    // associations can be defined here
  };
  return Video;
};