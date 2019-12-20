'use strict';
module.exports = (sequelize, DataTypes) => {
  const Option = sequelize.define('Option', {
    key: {
      type: DataTypes.STRING,
      unique: "key",
      primaryKey: true,
      allowNull: false
    },
    value: DataTypes.STRING,
  }, {
    timestamps:false
  });
  Option.associate = function(models) {
    // associations can be defined here
  };
  return Option;
};