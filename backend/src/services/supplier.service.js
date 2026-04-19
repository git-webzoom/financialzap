const { getDb } = require('../db/database')

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertOwnership(db, userId, supplierId) {
  const { rows } = await db.execute({
    sql: 'SELECT id FROM suppliers WHERE id = ? AND user_id = ?',
    args: [supplierId, userId],
  })
  if (!rows.length) {
    const err = new Error('Fornecedor não encontrado')
    err.status = 404
    throw err
  }
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

async function listSuppliers(userId, filters = {}) {
  const db = getDb()
  let sql  = 'SELECT s.*, COUNT(sl.id) AS log_count FROM suppliers s LEFT JOIN supplier_logs sl ON sl.supplier_id = s.id WHERE s.user_id = ?'
  const args = [userId]

  if (filters.type) {
    sql += ' AND s.type = ?'
    args.push(filters.type)
  }
  if (filters.status) {
    sql += ' AND s.status = ?'
    args.push(filters.status)
  }

  sql += ' GROUP BY s.id ORDER BY s.name ASC'

  const { rows } = await db.execute({ sql, args })
  return rows
}

async function getSupplier(userId, supplierId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM suppliers WHERE id = ? AND user_id = ?',
    args: [supplierId, userId],
  })
  if (!rows.length) {
    const err = new Error('Fornecedor não encontrado')
    err.status = 404
    throw err
  }
  const supplier = rows[0]

  const { rows: logs } = await db.execute({
    sql: 'SELECT * FROM supplier_logs WHERE supplier_id = ? ORDER BY occurred_at DESC',
    args: [supplierId],
  })
  return { ...supplier, logs }
}

async function createSupplier(userId, { name, type, status, trust_score, contacts, notes }) {
  const db  = getDb()
  const now = new Date().toISOString()
  const { lastInsertRowid } = await db.execute({
    sql: `INSERT INTO suppliers (user_id, name, type, status, trust_score, contacts, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId,
      name,
      type,
      status ?? 'active',
      trust_score ?? null,
      contacts ?? null,
      notes ?? null,
      now,
      now,
    ],
  })
  const { rows } = await db.execute({
    sql: 'SELECT s.*, 0 AS log_count FROM suppliers s WHERE s.id = ?',
    args: [lastInsertRowid],
  })
  return rows[0]
}

async function updateSupplier(userId, supplierId, fields) {
  const db = getDb()
  await assertOwnership(db, userId, supplierId)

  const { rows } = await db.execute({
    sql: 'SELECT * FROM suppliers WHERE id = ?',
    args: [supplierId],
  })
  const cur = rows[0]
  const now = new Date().toISOString()

  const name        = fields.name        !== undefined ? fields.name        : cur.name
  const type        = fields.type        !== undefined ? fields.type        : cur.type
  const status      = fields.status      !== undefined ? fields.status      : cur.status
  const trust_score = fields.trust_score !== undefined ? fields.trust_score : cur.trust_score
  const contacts    = fields.contacts    !== undefined ? fields.contacts    : cur.contacts
  const notes       = fields.notes       !== undefined ? fields.notes       : cur.notes

  await db.execute({
    sql: `UPDATE suppliers SET name = ?, type = ?, status = ?, trust_score = ?, contacts = ?, notes = ?, updated_at = ?
          WHERE id = ?`,
    args: [name, type, status, trust_score, contacts, notes, now, supplierId],
  })

  const { rows: updated } = await db.execute({
    sql: `SELECT s.*, (SELECT COUNT(*) FROM supplier_logs WHERE supplier_id = s.id) AS log_count
          FROM suppliers s WHERE s.id = ?`,
    args: [supplierId],
  })
  return updated[0]
}

async function deleteSupplier(userId, supplierId) {
  const db = getDb()
  await assertOwnership(db, userId, supplierId)
  await db.execute({ sql: 'DELETE FROM suppliers WHERE id = ?', args: [supplierId] })
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

async function createLog(supplierId, userId, { description, occurred_at }) {
  const db = getDb()
  await assertOwnership(db, userId, supplierId)

  const ts = occurred_at ? occurred_at : new Date().toISOString()
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO supplier_logs (supplier_id, description, occurred_at) VALUES (?, ?, ?)',
    args: [supplierId, description, ts],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM supplier_logs WHERE id = ?',
    args: [lastInsertRowid],
  })
  return rows[0]
}

async function deleteLog(logId, userId) {
  const db = getDb()
  // Verify ownership via JOIN
  const { rows } = await db.execute({
    sql: `SELECT sl.id FROM supplier_logs sl
          JOIN suppliers s ON s.id = sl.supplier_id
          WHERE sl.id = ? AND s.user_id = ?`,
    args: [logId, userId],
  })
  if (!rows.length) {
    const err = new Error('Interação não encontrada')
    err.status = 404
    throw err
  }
  await db.execute({ sql: 'DELETE FROM supplier_logs WHERE id = ?', args: [logId] })
}

module.exports = {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createLog,
  deleteLog,
}
