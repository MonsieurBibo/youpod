'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Previews', {
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
      epTitle: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      podTitle: {
        type: Sequelize.STRING,
        allowNull: false
      },
      imgLink: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          isUrl: true
        }
      },
      audioLink: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          isUrl: true
        }
      },
      color: {
        type: Sequelize.STRING,
        allowNull: false
      },
      startTime: {
        type: Sequelize.STRING
      },
      end_timestamp: {
        type: Sequelize.INTEGER
      },
      access_token: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: "waiting",
        allowNull: false,
        validate: {
          isIn: ["waiting","during","finished","deleted","error"]
        }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Previews');
  }
};