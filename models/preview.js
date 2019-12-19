'use strict';
module.exports = (sequelize, DataTypes) => {
  const Preview = sequelize.define('Preview', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    epTitle: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    podTitle: {
      type: DataTypes.STRING,
      allowNull: false
    },
    imgLink: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isUrl: true
      }
    },
    audioLink: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isUrl: true
      }
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false
    },
    startTime: {
      type: DataTypes.STRING
    },
    end_timestamp: {
      type: DataTypes.INTEGER
    },
    access_token: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "waiting",
      allowNull: false,
      validate: {
        isIn: [["waiting","during","finished","deleted","error"]]
      }
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    }
  }, {

  });
  Preview.associate = function(models) {
    // associations can be defined here
  };
  return Preview;
};