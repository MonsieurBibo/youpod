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
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "waiting"
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
        type: Sequelize.STRING
      }

    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Videos');
  }
};