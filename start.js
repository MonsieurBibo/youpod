const path = require("path");
const Sequelize = require('sequelize');

//ORM pour SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname + "/base.db")
});

console.log("Connection à la base de donnée...")
  
sequelize
    .authenticate()
    .then(() => {
      console.log('Connection has been established successfully.');
    })
    .catch(err => {
      console.error('Unable to connect to the database:', err);
    });

const Video = sequelize.define('video', {
    // a
    email: {
        type: Sequelize.STRING,
        allowNull: false
    },
    rss: {
        type: Sequelize.STRING,
        allowNull: false
    },
    guid: {}
    }, {
        // options
    });
  