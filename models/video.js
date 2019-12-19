'use strict';
module.exports = (sequelize, DataTypes) => {
  const Video = sequelize.define('Video', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rss: {
      type: DataTypes.STRING,
      allowNull: false
    },
    guid: {
      type: DataTypes.STRING
    },
    template: {
      type: DataTypes.TEXT
    },
    access_token: {
      type: DataTypes.STRING,
      allowNull: false
    },
    end_timestamp: {
      type: DataTypes.INTEGER
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "waiting",
      validate: {
        isIn: [["waiting","during","finished","deleted","error", "canceled"]]
      }
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull:false,
      defaultValue: 0
    },
    font: {
      type: DataTypes.STRING
    },
    epImg: {
      type: DataTypes.STRING,
      validate: {
        isUrl: true
      }
    },
    epTitle: {
      type: DataTypes.STRING
    },
    podTitle: {
      type: DataTypes.STRING
    },
    podSub : {
      type: DataTypes.STRING
    },
    audioURL: {
      type: DataTypes.STRING,
      validate: {
        isUrl: true
      }
    }
  }, {

  });
  Video.associate = function(models) {
    // associations can be defined here
  };
  return Video;
};