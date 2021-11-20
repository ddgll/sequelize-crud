const validators = require('./validators')
const mysql = require('mysql2/promise')
const fs = require('fs')

const getValidator = (type) => {
  if (/^int.*$/.test(type)) return validators.integer
  if (/^varchar.*$/.test(type)) return validators.string
  if (/.*text$/.test(type) || /.*blob$/.test(type)) return validators.string
  if (/^enum.*$/.test(type)) return validators.enum
  if (/^tinyint.*$/.test(type)) return validators.enum
  if (type === 'datetime') return validators.datetime
  if (type === 'time') return validators.time
  if (type === 'date') return validators.date
  console.error(`Validator not found for type: ${type}`)
  process.exit(1)
}

const getOptions = (table, row) => {
  if (table && table.options) return table.options
  if (/^varchar.*$/.test(row.Type)) {
    const max = parseInt(row.Type.replace(/^varchar\(([^)]+).*$/, '$1'))
    return { min: 0, max }
  }
  if (/^text$/.test(row.Type) || /^blob$/.test(row.Type)) return { min: 0, max: 65535 }
  if (/^tinytext$/.test(row.Type) || /^tinyblob$/.test(row.Type)) return { min: 0, max: 255 }
  if (/^mediumtext$/.test(row.Type) || /^mediumblob$/.test(row.Type)) return { min: 0, max: 16777215 }
  if (/^longtext$/.test(row.Type) || /^longblob$/.test(row.Type)) return { min: 0, max: 4294967295 }
  if (/^enum.*$/.test(row.Type)) {
    const values = row.Type.replace(/^enum\(([^)]+)$/, '$1').split(',')
    return { values }
  }
  if (/^tinyint.*$/.test(row.Type)) return { values: [0, 1, '0', '1'] }
  return null
}

// const checkUserGci = (socket, gci) => {
//   const groups = socket.request.user.groups && socket.request.user.groups.length ? socket.request.user.groups : []
//   const idx = groups.findIndex(gr => +gr.id === +gci)
//   return idx >= 0
// }

const checkRights = (socket, session, definition, type) => {
  if (!definition.rights || !definition.rights.length) {
    socket.emit('ioe', { status: 500, error: 'server_error', error_description: 'norightsDefinition' })
    return false
  }
  const rights = definition[type] || definition.rights
  if (rights.includes(session.right)) return true
  socket.emit('ioe', { status: 403, error: 'forbidden', error_description: 'noAccess', message: rights })
  return false
}

const count = async (data, session, connexion, definition, brand, socket, io) => {
  if (!checkRights(socket, session, definition, 'get')) return
  const conditions = [], replacements = []
  if (definition.groupClientId) {
    conditions.push(`${definition.groupClientId} = ?`)
    replacements.push(session.gci)
  }
  if (definition.userId && definition.private) {
    conditions.push(`${definition.userId} = ?`)
    replacements.push(socket.request.user.id)
  }
  const primary = definition.columns.find(c => c.primary)
  if (!primary) return socket.emit('ioe', { status: 500, error: 'server_error', error_description: 'noPrimary', message: definition.table })
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  const query = `SELECT COUNT(${primary.field}) AS count FROM ${definition.database}.${definition.table}${where}`
  const [rows] = await connexion.execute(query, replacements)
  if (!rows || !rows.length) return socket.emit('ioe', { status: 400, error: 'bad_request', error_description: 'countError', message })
  socket.emit(`${definition.database}-${definition.table}`, { a: 'c', d: rows[0].count })
  // if (!data) {
  //   const [rows] = await connexion.execute(`SELECT * FROM ${definition.database}.${definition.table}${where}`, replacements)
  //   socket.emit(`${definition.database}-${definition.table}`, { a: 'g', d: rows })
  // } else {
  //   console.log(`SELECT * FROM ${definition.database}.${definition.table}${where}`)
  //   const [rows] = await connexion.execute(`SELECT * FROM ${definition.database}.${definition.table}${where}`, replacements)
  //   if (!rows || !rows.length) return socket.emit('ioe', { status: 400, error: 'bad_request', error_description: 'notFound', message: data })
  //   socket.emit(`${definition.database}-${definition.table}`, { a: 'g', d: rows })
  // }
}

const get = async (data, session, connexion, definition, socket) => {
  if (!checkRights(socket, session, definition, 'get')) return
  const conditions = [], replacements = []
  if (definition.userId && definition.private) {
    conditions.push(`${definition.userId} = ?`)
    replacements.push(socket.request.user.id)
  }
  if (data) {
    if (typeof data !== 'object') {
      const primary = definition.columns.find(c => c.primary)
      if (!primary) return socket.emit('ioe', { status: 400, error: 'bad_request', error_description: 'noPk' })
      conditions.push(`${primary.field} = ?`)
      replacements.push(data)
    } else {
      for (const field in data) {
        if (field === 'page') continue
        const operator = data[field] && data[field].op ? data[field].op : '='
        const value = data[field] && data[field].value ? data[field].value : data[field]
        conditions.push(`${field} ${operator} ?`)
        replacements.push(value)
      }
    }
  }
  const v = getValidator('int')
  const limit = 1000
  const offset = data && data.page ? (data.page - 1) * limit : 0
  if (!v(offset)) return socket.emit('ioe', { status: 400, error: 'bad_request', error_description: 'badOffset' })
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  replacements.push(offset)
  replacements.push(limit)
  const query = `SELECT * FROM ${definition.database}.${definition.table}${where} LIMIT ?,?`
  const [rows] = await connexion.execute(query, replacements)
  socket.emit(`${definition.database}-${definition.table}`, { a: 'g', d: rows })
}

const add = (data, session, connexion, definition, socket, io) => {
  if (!checkRights(socket, session, definition, 'add')) return
  const columns = []
  const values = []
}

/**
 * Liste des actions possibles:
 *    - g: get
 *    - a: add
 *    - u: update
 *    - d: delete
 */
const actions = ['g', 'c', 'a', 'u', 'd']

/**
 * Va écouter les routes possibles pour une table donnée
 * L'événement est défini de la façon suivante: { a, d } ou seul a est obligatoire représente l'action à réaliser. Elles sont définies ci-dessus.
 * Le d est un objet data ou est undefined
 * 
 * @param {*} connexion: la connexion au serveur mysql
 * @param {*} session: la session redis courante
 * @param {*} definition: la definition de la route
 * @param {*} brand: la marque courrante
 * @param {*} socket: la socket
 * @param {*} io: le server io
 * @returns 
 */
const listenToRouteEvent = (connexion, session, definition, socket, io) => (ev) => {
  if (!ev || !actions.includes(ev.a)) return socket.emit('ioe', { status: 400, error: 'bad_request', error_description: 'badevent', message: ev })
  if (definition.connected && (!session || !session.user || !session.right)) return socket.emit('ioe', { status: 403, error: 'forbidden', error_description: 'notconnected' })
  switch (ev.a) {
    case 'a': return add(ev.d, session, connexion, definition, socket, io)
    case 'u': return update(ev.d, session, connexion, definition, socket, io)
    case 'd': return remove(ev.d, session, connexion, definition, socket, io)
    case 'g': return get(ev.d, session, connexion, definition, socket, io)
    case 'c': return count(ev.d, session, connexion, definition, socket, io)
  }
}

/**
 * 
 * @param {*} config: configuration de l'application donnée par le ptl-node.backend.wap
 * @param {*} model: model oauth2 donnée par la classe Oauth2Model de ptl-node.library.wap 
 * @param {*} app: application express donnée par ptl-node.backend.wap 
 * @param {*} appSession: session de l'application donnée par ptl-node.backend.wap
 * @param {*} definitions: les définitions des tables
 * 
 * Exemple de définitions: seul le champ database est obligatoire
 * 
 * [
 *  {
 *    database: 'esign',
 *    tables: {
 *      docs: {
 *        userId: ownerId,
 *        validators: [
 *          (req, connexion) => {
 *            DO YOUR TESTS
 *          }
 *        ],
 *        name: {
 *          options: { min: 3, max: 255 },
 *          validators: [
 *            (value, connexion, req) => {
 *              DO YOUR TESTS
 *            }
 *          ]
 *        },
 *        folderId: {
 *          validators: [
 *            (value, connexion, req) => {
 *              CHECK IF FOLDER ID EXISTS AND IN GOOD groupClientId
 *            }
 *          ]
 *        }
 *      }
 *    }
 *  }
 * ]
 */
const ioAuto = async ( config) => {
  const connexions = {}
  const routes = []

  for (const d of config.definitions) {
    console.log('TRY TO DEFINE', d.database, config.sequelize)
    const database = d.database
    const defTables = d.tables || {}

    if (!connexions[database]) connexions[database] = await mysql.createPool({
      host: config.sequelize.host.host,
      user: config.sequelize.username,
      password: config.sequelize.password,
      database
    })
    const connexion = connexions[database]

    console.log(`SHOW TABLES FROM ${database}`)
    const [results] = await connexion.execute(`SHOW TABLES FROM ${database}`)
    const tables = results.map(r => r[`Tables_in_${database}`])
  
    for (const t of tables) {
      console.log(`SHOW FULL COLUMNS FROM ${t}`)
      const [rows, fields] = await connexion.execute(`SHOW FULL COLUMNS FROM ${t}`)
      const columns = []
      const defTable = defTables[t] || null
      let userId = null
      let groupClientId = null
      rows.forEach(r => {
        console.log('VALIDATION FOR', r.Field)
        const typeValidator = getValidator(r.Type)
        if (r.Field === 'userId') userId = 'userId'
        columns.push({
          field: r.Field,
          primary: r.Key === 'PRI',
          required: r.Null === 'NO',
          options: getOptions(defTable, r),
          default: r.Default,
          validators: [ typeValidator, ...(defTable && defTable[r.Field] && defTable[r.Field].validators && defTable[r.Field].validators.length ? defTable[r.Field].validators : [])]
        })
      })

      routes.push({
        event: `${database}-${t}`,
        database,
        table: t,
        columns,
        rights: defTable ? defTable.rights : d.rights || [{ rights: null }],
        connected: defTable ? !defTable.unlogged : true,
        private: defTable ? !defTable.private : userId,
        userId: defTable && defTable.userId ? defTable.userId : userId,
        validators: defTable && defTable.validators && defTable.validators.length ? defTable.validators : []
      })
    }
    console.log('IO ROUTES', routes)

    fs.writeFileSync('io-routes.txt', JSON.stringify(routes, null, 2))
  }

  // io.of('/auto').use(SocketIOSession(appSession, parser))
  // io.of('/auto').on('connection', (socket) => {
  //   const session = socket && socket.handshake && socket.handshake.session ? socket.handshake.session : null
  //   if (session && session.id) socket.join(session.id)
  //   routes.forEach(r => socket.on(r.event, listenToRouteEvent(connexions[r.database], session, r, brand, socket, io)))
  // })
}

module.exports = ioAuto
