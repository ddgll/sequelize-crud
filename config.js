module.exports = {
  sequelize: {
    database: 'WAP',
    username: 'appteam',
    password: 'teC66Sud',
    host: {
      host: 'ptl-dgdwap-dev.czy79injlrrq.eu-west-1.rds.amazonaws.com',
      dialect: 'mysql',
      dialectOptions: {
        dateStrings: true
      }
    }
  },
  definitions: [
    {
      database: 'esign',
      accesses: ['erp-esign']
    }
  ]
}
