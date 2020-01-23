'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Socials', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
	  },
	  rss: {
        type: Sequelize.STRING,
        allowNull: false
	  },
	  guid: {
        type: Sequelize.STRING,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      epTitle: {
        type: Sequelize.STRING,
      },
      podTitle: {
        type: Sequelize.STRING,
      },
      imgLink: {
        type: Sequelize.STRING,
        validate: {
          isUrl: true
        }
      },
      audioLink: {
        type: Sequelize.STRING,
        validate: {
          isUrl: true
        }
      },
      startTime: {
        type: Sequelize.STRING
	  },
	  duration: {
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
          isIn: ["waiting","during","finished","deleted","error", "canceled"]
        }
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull:false,
        defaultValue: 0
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: Sequelize.DATE,
      createdAt: Sequelize.DATE
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Previews');
  }
};