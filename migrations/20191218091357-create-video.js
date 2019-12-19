'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Videos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      rss: {
        type: Sequelize.STRING,
        allowNull: false
      },
      guid: {
        type: Sequelize.STRING
      },
      template: {
        type: Sequelize.TEXT
      },
      access_token: {
        type: Sequelize.STRING,
        allowNull: false
      },
      end_timestamp: {
        type: Sequelize.INTEGER
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "waiting",
        validate: {
          isIn: ["waiting","during","finished","deleted","error"]
        }
      },
      font: {
        type: Sequelize.STRING
      },
      epImg: {
        type: Sequelize.STRING,
        validate: {
          isUrl: true
        }
      },
      epTitle: {
        type: Sequelize.STRING
      },
      podTitle: {
        type: Sequelize.STRING
      },
      podSub : {
        type: Sequelize.STRING
      },
      audioURL: {
        type: Sequelize.STRING,
        validate: {
          isUrl: true
        }
      },
      updatedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Videos');
  }
};