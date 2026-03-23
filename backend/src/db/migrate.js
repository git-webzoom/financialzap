const fs = require('fs')
const path = require('path')
const { getDb } = require('./database')

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  const db = getDb()

  // @libsql/client executes each statement individually via executeMultiple
  await db.executeMultiple(schema)

  console.log('[db] Migration complete.')
}

module.exports = { migrate }
