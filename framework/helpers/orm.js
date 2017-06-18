let jsonSql = require('json-sql')({ separatedValues: false })
let dblite = require('./dblite')
let PIFY = require('./index').PIFY

class Model {
  constructor(schema, db) {
    this.schema = schema
    this.db = db
    this.fieldsType = {}
    this.allFields = []
    for (let i in schema.tableFields) {
      let field = schema.tableFields[i]
      this.allFields.push(field.name)
      switch (field.type) {
        case 'Number':
        case 'BigInt':
          this.fieldsType[field.name] = Number
          break
        default:
          this.fieldsType[field.name] = String
          break
      }
    }
  }

  sync() {
    let sql = jsonSql.build(this.schema).query
    return this.db.query(sql)
  }

  parseRows(fields, rows) {
    return rows.map((row) => {
      let newItem = {}
      for (let i = 0; i < row.length; ++i) {
        let fieldName = fields[i]
        newItem[fieldName] = this.fieldsType[fieldName](row[i])
      }
      return newItem
    })
  }

  async findAll(options) {
    let fields = options.fields || this.allFields
    let sql = jsonSql.build({
      type: 'select',
      table: this.schema.table,
      fields: fields
    }).query
    
    let results = await this.db.query(sql)
    return this.parseRows(fields, results)
  }

  async findOne(options) {
    let fields = options.fields || this.allFields
    let sql = jsonSql.build({
      type: 'select',
      table: this.schema.table,
      fields: fields,
      condition: options.condition
    }).query
    let results = await this.db.query(sql)
    if (!results || results.length === 0) return null
    return this.parseRows(fields, results)[0]
  }

  create(values) {
    let sql = jsonSql.build({
      type: 'insert',
      table: this.schema.table,
      values: values
    }).query
    return this.db.query(sql)
  }
}

class Transaction {
  constructor(db) {
    this.db = db
  }

  commit() {
    return this.db.query('release savepoint tmp')
  }

  rollback() {
    return this.db.query('rollback to savepoint tmp')
  }
}


class Orm {
  constructor(database, user, password, options) {
    this.options = options
    this.dblite = dblite(options.storage)
  }

  define(_arg1_, schema) {
    schema.type = 'create'
    return new Model(schema, this)
  }

  query(sql) {
    return PIFY(this.dblite.query)(sql)
  }

  async transaction() {
    await this.query('savepoint tmp')
    return new Transaction(this)
  }

  async close() {
    this.dblite.close()
    await PIFY(function (cb) {
      setTimeout(cb, 1000)
    })()
  }

}


module.exports = Orm