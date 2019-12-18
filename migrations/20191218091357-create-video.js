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
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      rss: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          isUrl: true
        }
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
      }

    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Videos');
  }
};