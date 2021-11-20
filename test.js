const ioAuto = require('./lib/io-auto')
const config = require('./config')

ioAuto(config).then(() => {
  console.log('IoAuto OK !')
  process.exit(0)
}).catch((e) => {
  console.error('IoAuto NOK !')
  console.error(e)
  process.exit(1)
})
