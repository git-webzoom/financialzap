const { getDb } = require('../db/database')

async function listNumbers(userId, filters = {}) {
  const db = getDb()
  let sql  = 'SELECT * FROM number_inventory WHERE user_id = ?'
  const args = [userId]

  if (filters.status) {
    sql += ' AND status = ?'
    args.push(filters.status)
  }
  if (filters.origin) {
    sql += ' AND origin = ?'
    args.push(filters.origin)
  }

  sql += ' ORDER BY created_at DESC'
  const { rows } = await db.execute({ sql, args })
  return rows
}

async function createNumber(userId, { phone_number, origin, supplier, bm_name, waba_name, automation_name, status, notes }) {
  const db = getDb()
  if (!phone_number) {
    const err = new Error('phone_number é obrigatório')
    err.status = 400
    throw err
  }
  if (!['own', 'rented'].includes(origin)) {
    const err = new Error('origin deve ser "own" ou "rented"')
    err.status = 400
    throw err
  }
  const resolvedStatus = status || 'free'
  if (!['free', 'in_use', 'reserved'].includes(resolvedStatus)) {
    const err = new Error('status deve ser "free", "in_use" ou "reserved"')
    err.status = 400
    throw err
  }
  const now = new Date().toISOString()
  const { lastInsertRowid } = await db.execute({
    sql: `INSERT INTO number_inventory
            (user_id, phone_number, origin, supplier, bm_name, waba_name, automation_name, status, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, phone_number, origin, supplier ?? null, bm_name ?? null, waba_name ?? null, automation_name ?? null, resolvedStatus, notes ?? null, now, now],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM number_inventory WHERE id = ?',
    args: [lastInsertRowid],
  })
  return rows[0]
}

async function updateNumber(userId, numberId, fields) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM number_inventory WHERE id = ? AND user_id = ?',
    args: [numberId, userId],
  })
  if (!rows.length) {
    const err = new Error('Número não encontrado')
    err.status = 404
    throw err
  }
  const current = rows[0]
  const now = new Date().toISOString()

  const newPhone       = fields.phone_number    !== undefined ? fields.phone_number    : current.phone_number
  const newOrigin      = fields.origin          !== undefined ? fields.origin          : current.origin
  const newSupplier    = fields.supplier        !== undefined ? fields.supplier        : current.supplier
  const newBmName      = fields.bm_name         !== undefined ? fields.bm_name         : current.bm_name
  const newWabaName    = fields.waba_name       !== undefined ? fields.waba_name       : current.waba_name
  const newAutoName    = fields.automation_name !== undefined ? fields.automation_name : current.automation_name
  const newStatus      = fields.status          !== undefined ? fields.status          : current.status
  const newNotes       = fields.notes           !== undefined ? fields.notes           : current.notes

  await db.execute({
    sql: `UPDATE number_inventory SET
            phone_number = ?, origin = ?, supplier = ?, bm_name = ?, waba_name = ?,
            automation_name = ?, status = ?, notes = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
    args: [newPhone, newOrigin, newSupplier, newBmName, newWabaName, newAutoName, newStatus, newNotes, now, numberId, userId],
  })

  const { rows: updated } = await db.execute({
    sql: 'SELECT * FROM number_inventory WHERE id = ?',
    args: [numberId],
  })
  return updated[0]
}

async function deleteNumber(userId, numberId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT id FROM number_inventory WHERE id = ? AND user_id = ?',
    args: [numberId, userId],
  })
  if (!rows.length) {
    const err = new Error('Número não encontrado')
    err.status = 404
    throw err
  }
  await db.execute({
    sql: 'DELETE FROM number_inventory WHERE id = ? AND user_id = ?',
    args: [numberId, userId],
  })
}

module.exports = { listNumbers, createNumber, updateNumber, deleteNumber }
