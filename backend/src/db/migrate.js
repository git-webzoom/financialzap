const fs = require('fs')
const path = require('path')
const { getDb } = require('./database')

async function migrate() {
  const raw = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  const db  = getDb()

  // Strip single-line comments, then split on semicolons.
  const stripped = raw
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--')
      return idx >= 0 ? line.slice(0, idx) : line
    })
    .join('\n')

  const statements = stripped
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const sql of statements) {
    await db.execute(sql)
  }

  // ── Column migrations (idempotent) ──
  // Add new columns to existing tables without breaking old databases.
  await addColumnIfMissing(db, 'templates',          'quality_score',   'TEXT')
  await addColumnIfMissing(db, 'templates',          'rejected_reason', 'TEXT')
  await addColumnIfMissing(db, 'campaign_contacts',  'wamid',           'TEXT')
  await addColumnIfMissing(db, 'campaign_contacts',  'delivered_at',    'DATETIME')
  await addColumnIfMissing(db, 'campaign_contacts',  'read_at',         'DATETIME')
  await addColumnIfMissing(db, 'campaigns',          'read_count',      'INTEGER DEFAULT 0')

  console.log('[db] Migration complete.')
}

async function addColumnIfMissing(db, table, column, type) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`)
  const exists = rows.some(r => r.name === column)
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
    console.log(`[db] Added column ${table}.${column}`)
  }
}

module.exports = { migrate }
