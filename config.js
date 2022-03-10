module.exports = {
  sequelize: {
    database: "biotops-qualif",
    username: "appteam",
    password: "teC66Sud",
    host: {
      host: "",
      dialect: "mysql",
      dialectOptions: {
        dateStrings: true,
      },
    },
  },
  definitions: [
    {
      database: "esign",
      accesses: ["erp-esign"],
    },
  ],
};
