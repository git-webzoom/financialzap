const { createClient } = require('@libsql/client')
const path = require('path')

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', '..', 'financialzap.sqlite')

let db

function getDb() {
  if (!db) {
    db = createClient({
      url: `file:${DB_PATH}`,
    })
    // SQLite disables foreign key enforcement by default — enable it per connection.
    db.execute('PRAGMA foreign_keys = ON').catch((err) => {
      console.error('[db] Failed to enable foreign keys:', err.message)
    })
  }
  return db
}

module.exports = { getDb }
