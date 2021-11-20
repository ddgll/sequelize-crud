const ucFirst = (string) => string.charAt(0).toUpperCase() + string.slice(1)

const getImportsString = () => {
  return `
const Op = require('sequelize').Op
`
}

const getExportString = (Name) => {
  return `
module.exports = {
  get${Name},
  post${Name},
  put${Name},
  delete${Name}
}
`
}

const catchStr = `next(e)`

const getGETString = (name, Name, primary) => {
  return `
const get${Name} = (models) => async (req, res, next) => {
  try {
    if (req.params.${primary}) {
      const entity = await models.${name}.findOne({
        where: {
          ${primary}: req.params.${primary}
        }
      })
      if (!entity) return res.status(404).json({ error: 'bad_request', 'error_description': '${name}NotFound' })
      res.status(200).json(entity)
    } else if (req.gci) {
      let where = {}
      if (req.query.last) {
        where.updatedAt = {
          [Op.gt]: req.query.last
        }
      }
      const ${name} = await models.${name}.findAll({ where })
      res.status(200).json(${name})
    } else {
      return res.status(400).json({ error: 'bad_request', 'error_description': 'parameters' })
    }
  } catch (e) {
    ${catchStr}
  }
}
`
}

const getValidationCondition = (column, options) => {
  switch (options.type.constructor.name) {
    case 'INTEGER':
      return `validators.integer(body.${column})`
    case 'FLOAT':
      return `validators.float(body.${column})`
    case 'ENUM':
      // `const arrayValues = [${options.type.values.reduce((a, acc) => acc.length ? acc + `,'${a}'` : `'${a}'`, '')}]`
      return `validators.enum(body.${column}, { values: [ ${options.type.values.reduce((acc, a) => acc.length ? acc + `, '${a}'` : `'${a}'`, '')} ] })`
    case 'STRING':
      return `validators.string(body.${column}, { max: ${options.type.options.length} })`
    case 'Function':
      switch (options.type.types.mysql[0]) {
        case 'DATETIME':
          return `validators.datetime(body.${column})`
        case 'DATE':
          return `validators.date(body.${column})`
        case 'TIME':
          return `validators.time(body.${column})`
        case 'INTEGER':
        case 'LONG':
          return `validators.integer(body.${column})`
        case 'FLOAT':
          return `validators.float(body.${column})`
        case 'STRING':
          return `validators.string(body.${column}, { max: ${options.type.options.length} })`
        case 'VAR_STRING':
          return `validators.string(body.${column}, { max: 255 })`
        case 'BLOB':
        case 'TEXT':
          return `validators.string(body.${column}, { max: 65535 })`
        case 'LONGTEXT':
        case 'MEDIUMTEXT':
          return `validators.string(body.${column})`
        default:
          console.log('CHECK WAP CRUD FOR VALIDATION "FUNCTION TYPE" NOT FOUND')
          console.log(column, options.type, options.type.key, options.type.options)
          process.exit(2)
      }
    default:
      console.log('CHECK WAP CRUD FOR VALIDATION "TYPE" NOT FOUND')
      console.log(column, options.type.constructor.name, JSON.stringify(options.type))
      process.exit(1)
  }
}

const getEntityString = (schema, tabs, api) => {
  let str = ''
  str += 'const body = req.body || {}\n'
  if (!api) {
    let validation = ''
    for (let i = 0; i < tabs; i++) validation += '  '
    validation += 'const validationErrors = []'
    for (const column in schema) {
      const options = schema[column]
      if (column === 'createdAt' || column === 'updatedAt' || column === 'deletedAt') continue
      validation += '\n'
      for (let i = 0; i < tabs; i++) validation += '  '
      validation += `if (!${getValidationCondition(column, options)}) validationErrors.push('${column}')`
    }
    validation += `\n`
    for (let i = 0; i < tabs; i++) validation += '  '
    validation += `if (validationErrors.length) return res.status(400).json({ error: 'bad_request', 'error_description': 'wrong.parameters', validationErrors })`
    str += validation + '\n'
  }
  for (let i = 0; i < tabs; i++) str += '  '
  str += 'const entity = Object.assign({}, {\n'
  for (const column in schema) {
    const options = schema[column]
    if (options.primaryKey || column === 'createdAt' || column === 'updatedAt' || column === 'deletedAt') continue
    for (let i = 0, l = tabs + 1; i < l; i++) str += '  '
    str += `${column}: body.${column},` + '\n'
  }
  str = str.substr(0, str.length - 2) + '\n'
  for (let i = 0; i < tabs; i++) str += '  '
  str += '})'
  return str
}

const getPOSTString = (name, Name, primary, schema, api) => {
  return `
const post${Name} = (models) => async (req, res, next) => {
  try {
    ${getEntityString(schema, 2)}
    const createdEntity = await models.${name}.create(entity)
    res.status(200).json(createdEntity)
  } catch (e) {
    ${catchStr}
  }
}
`
}

const getEntityPutString = (schema, tabs) => {
  let str = ''
  str += 'const body = req.body || {}\n'
  for (const column in schema) {
    const options = schema[column]
    if (options.primaryKey || column === 'createdAt' || column === 'updatedAt' || column === 'deletedAt' || column === 'groupClientId') continue
    for (let i = 0, l = tabs; i < l; i++) str += '  '
    str += `if (typeof body.${column} !== 'undefined' && ${getValidationCondition(column, options)}) entity.${column} = body.${column}` + '\n'
  }
  return str
}

const getPUTString = (name, Name, primary, schema, api) => {
  return `
const put${Name} = (models) => async (req, res, next) => {
  try {
    let entity = await models.${name}.findOne({
      where: {
        ${primary}: req.params.${primary}
      }
    })
    if (!entity) return res.status(404).json({ error: 'not_found', 'error_description': '${name}NotFound' })
    ${getEntityPutString(schema, 2)}
    const updatedEntity = await entity.save()
    res.status(200).json(updatedEntity)
  } catch (e) {
    ${catchStr}
  }
}
`
}

const getDELETEString = (name, Name, primary, api) => {
  return `
const delete${Name} = (models) => async (req, res, next) => {
  try {
    let entity = await models.${name}.findOne({
      where: {
        ${primary}: req.params.${primary}
      }
    })
    if (!entity) return res.status(404).json({ error: 'not_found', 'error_description': '${name}NotFound' })
    const removedEntity = await entity.destroy()
    res.status(200).json(removedEntity)
  } catch (e) {
    ${catchStr}
  }
}
`
}

const define = (name, schema) => {
  let primary = 'id'
  // for (const column in schema) {
  //   const options = schema[column]
  //   if (options.primaryKey) primary = column
  //   let type
  //   if (typeof options.type === 'function' && options.type.key) {
  //     type = options.type.key
  //   } else {
  //     console.log(column, options.type, typeof options.type)
  //   }
  //   // console.log(column, type)
  // }
  const Name = ucFirst(name)
  const string = getImportsString() +
                getGETString(name, Name, primary) +
                getPOSTString(name, Name, primary, schema, argv.a) +
                getPUTString(name, Name, primary, schema, argv.a) +
                getDELETEString(name, Name, primary, argv.a) +
                getExportString(Name)
  fs.writeFileSync(serviceFilePath, string)
}
