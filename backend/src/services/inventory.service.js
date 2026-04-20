const { getDb } = require('../db/database')

const TIER_LIMITS = { TIER_1: 250, TIER_2: 2000, TIER_3: 10000, TIER_4: 100000 }

// ─── Numbers ──────────────────────────────────────────────────────────────────

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

  // Attach automations (with daily_volume) to each number
  const { rows: autoRows } = await db.execute({
    sql: `SELECT na.id, na.number_id, na.automation_name, na.tool_name, na.daily_volume
          FROM number_automations na
          JOIN number_inventory ni ON ni.id = na.number_id
          WHERE ni.user_id = ?
          ORDER BY na.created_at ASC`,
    args: [userId],
  })

  const rawAutos = autoRows.map(a => ({ id: a.id, number_id: a.number_id, automation_name: a.automation_name, tool_name: a.tool_name, daily_volume: a.daily_volume ?? 0 }))
  const autosWithTemplates = await _attachTemplates(db, rawAutos)

  const autosByNumber = {}
  for (const a of autosWithTemplates) {
    if (!autosByNumber[a.number_id]) autosByNumber[a.number_id] = []
    autosByNumber[a.number_id].push(a)
  }

  return rows.map(r => {
    const automations = autosByNumber[r.id] ?? []
    const total_daily_volume = automations.reduce((sum, a) => sum + (a.daily_volume ?? 0), 0)
    const tier_limit = TIER_LIMITS[r.messaging_limit_tier] ?? null
    return { ...r, automations, total_daily_volume, tier_limit }
  })
}

async function createNumber(userId, { phone_number, origin, supplier, bm_name, waba_name, status, notes, quality_rating, messaging_limit_tier }) {
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
            (user_id, phone_number, origin, supplier, bm_name, waba_name, status, notes,
             quality_rating, messaging_limit_tier, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, phone_number, origin, supplier ?? null, bm_name ?? null, waba_name ?? null,
           resolvedStatus, notes ?? null, quality_rating ?? null, messaging_limit_tier ?? null, now, now],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM number_inventory WHERE id = ?',
    args: [lastInsertRowid],
  })
  const r = rows[0]
  return { ...r, automations: [], total_daily_volume: 0, tier_limit: TIER_LIMITS[r.messaging_limit_tier] ?? null }
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

  const newPhone    = fields.phone_number          !== undefined ? fields.phone_number          : current.phone_number
  const newOrigin   = fields.origin                !== undefined ? fields.origin                : current.origin
  const newSupplier = fields.supplier              !== undefined ? fields.supplier              : current.supplier
  const newBmName   = fields.bm_name               !== undefined ? fields.bm_name               : current.bm_name
  const newWabaName = fields.waba_name             !== undefined ? fields.waba_name             : current.waba_name
  const newStatus   = fields.status                !== undefined ? fields.status                : current.status
  const newNotes    = fields.notes                 !== undefined ? fields.notes                 : current.notes
  const newQuality  = fields.quality_rating        !== undefined ? fields.quality_rating        : current.quality_rating
  const newTier     = fields.messaging_limit_tier  !== undefined ? fields.messaging_limit_tier  : current.messaging_limit_tier

  await db.execute({
    sql: `UPDATE number_inventory SET
            phone_number = ?, origin = ?, supplier = ?, bm_name = ?, waba_name = ?,
            status = ?, notes = ?, quality_rating = ?, messaging_limit_tier = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
    args: [newPhone, newOrigin, newSupplier, newBmName, newWabaName, newStatus, newNotes,
           newQuality, newTier, now, numberId, userId],
  })

  const { rows: updated } = await db.execute({
    sql: 'SELECT * FROM number_inventory WHERE id = ?',
    args: [numberId],
  })
  const { rows: autoRows } = await db.execute({
    sql: 'SELECT id, automation_name, tool_name, daily_volume FROM number_automations WHERE number_id = ? ORDER BY created_at ASC',
    args: [numberId],
  })
  const r = updated[0]
  const rawAutos = autoRows.map(a => ({ ...a, daily_volume: a.daily_volume ?? 0 }))
  const automations = await _attachTemplates(db, rawAutos)
  const total_daily_volume = automations.reduce((sum, a) => sum + a.daily_volume, 0)
  return { ...r, automations, total_daily_volume, tier_limit: TIER_LIMITS[r.messaging_limit_tier] ?? null }
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

// ─── Automations ──────────────────────────────────────────────────────────────

async function _attachTemplates(db, automations) {
  if (!automations.length) return automations
  const ids = automations.map(a => a.id)
  const placeholders = ids.map(() => '?').join(',')
  const { rows } = await db.execute({
    sql: `SELECT * FROM automation_templates WHERE automation_id IN (${placeholders}) ORDER BY created_at ASC`,
    args: ids,
  })
  const byAuto = {}
  for (const t of rows) {
    if (!byAuto[t.automation_id]) byAuto[t.automation_id] = []
    byAuto[t.automation_id].push({ id: t.id, template_name: t.template_name })
  }
  return automations.map(a => ({ ...a, templates: byAuto[a.id] ?? [] }))
}

async function listAutomations(numberId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT id, automation_name, tool_name, daily_volume, created_at, updated_at FROM number_automations WHERE number_id = ? ORDER BY created_at ASC',
    args: [numberId],
  })
  const autos = rows.map(r => ({ ...r, daily_volume: r.daily_volume ?? 0 }))
  return _attachTemplates(db, autos)
}

async function createAutomation(numberId, { automation_name, daily_volume, tool_name }) {
  const db = getDb()
  if (!automation_name) {
    const err = new Error('automation_name é obrigatório')
    err.status = 400
    throw err
  }
  const now = new Date().toISOString()
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO number_automations (number_id, automation_name, daily_volume, tool_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [numberId, automation_name, daily_volume ?? 0, tool_name ?? null, now, now],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM number_automations WHERE id = ?',
    args: [lastInsertRowid],
  })
  const [auto] = await _attachTemplates(db, [{ ...rows[0], daily_volume: rows[0].daily_volume ?? 0 }])
  return auto
}

async function updateAutomation(automationId, { automation_name, daily_volume, tool_name }) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM number_automations WHERE id = ?',
    args: [automationId],
  })
  if (!rows.length) {
    const err = new Error('Automação não encontrada')
    err.status = 404
    throw err
  }
  const current = rows[0]
  const now = new Date().toISOString()
  const newName   = automation_name !== undefined ? automation_name : current.automation_name
  const newVolume = daily_volume    !== undefined ? daily_volume    : current.daily_volume
  const newTool   = tool_name       !== undefined ? tool_name       : current.tool_name

  await db.execute({
    sql: 'UPDATE number_automations SET automation_name = ?, daily_volume = ?, tool_name = ?, updated_at = ? WHERE id = ?',
    args: [newName, newVolume ?? 0, newTool ?? null, now, automationId],
  })
  const { rows: updated } = await db.execute({
    sql: 'SELECT * FROM number_automations WHERE id = ?',
    args: [automationId],
  })
  const [auto] = await _attachTemplates(db, [{ ...updated[0], daily_volume: updated[0].daily_volume ?? 0 }])
  return auto
}

async function createTemplate(automationId, templateName) {
  const db = getDb()
  if (!templateName?.trim()) {
    const err = new Error('template_name é obrigatório')
    err.status = 400
    throw err
  }
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO automation_templates (automation_id, template_name) VALUES (?, ?)',
    args: [automationId, templateName.trim()],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM automation_templates WHERE id = ?',
    args: [lastInsertRowid],
  })
  return { id: rows[0].id, template_name: rows[0].template_name }
}

async function deleteTemplate(automationId, templateId) {
  const db = getDb()
  await db.execute({
    sql: 'DELETE FROM automation_templates WHERE id = ? AND automation_id = ?',
    args: [templateId, automationId],
  })
}

async function deleteAutomation(automationId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT id FROM number_automations WHERE id = ?',
    args: [automationId],
  })
  if (!rows.length) {
    const err = new Error('Automação não encontrada')
    err.status = 404
    throw err
  }
  await db.execute({
    sql: 'DELETE FROM number_automations WHERE id = ?',
    args: [automationId],
  })
}

// ─── Health Logs ──────────────────────────────────────────────────────────────

async function listHealthLogs(userId, numberId) {
  const db = getDb()
  // Verify ownership
  const { rows: numRows } = await db.execute({
    sql: 'SELECT id FROM number_inventory WHERE id = ? AND user_id = ?',
    args: [numberId, userId],
  })
  if (!numRows.length) {
    const err = new Error('Número não encontrado')
    err.status = 404
    throw err
  }
  const { rows } = await db.execute({
    sql: 'SELECT * FROM number_health_logs WHERE number_id = ? ORDER BY occurred_at DESC',
    args: [numberId],
  })
  return rows
}

async function createHealthLog(userId, numberId, { event_type, description, occurred_at }) {
  const db = getDb()
  const { rows: numRows } = await db.execute({
    sql: 'SELECT id FROM number_inventory WHERE id = ? AND user_id = ?',
    args: [numberId, userId],
  })
  if (!numRows.length) {
    const err = new Error('Número não encontrado')
    err.status = 404
    throw err
  }
  const validTypes = ['banned', 'flagged', 'tier_up', 'tier_down', 'recovered', 'deactivated', 'other']
  if (!validTypes.includes(event_type)) {
    const err = new Error(`event_type inválido. Use: ${validTypes.join(', ')}`)
    err.status = 400
    throw err
  }
  const ts = occurred_at || new Date().toISOString()
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO number_health_logs (number_id, event_type, description, occurred_at) VALUES (?, ?, ?, ?)',
    args: [numberId, event_type, description ?? null, ts],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM number_health_logs WHERE id = ?',
    args: [lastInsertRowid],
  })
  return rows[0]
}

async function deleteHealthLog(userId, numberId, logId) {
  const db = getDb()
  const { rows: numRows } = await db.execute({
    sql: 'SELECT id FROM number_inventory WHERE id = ? AND user_id = ?',
    args: [numberId, userId],
  })
  if (!numRows.length) {
    const err = new Error('Número não encontrado')
    err.status = 404
    throw err
  }
  const { rows } = await db.execute({
    sql: 'SELECT id FROM number_health_logs WHERE id = ? AND number_id = ?',
    args: [logId, numberId],
  })
  if (!rows.length) {
    const err = new Error('Log não encontrado')
    err.status = 404
    throw err
  }
  await db.execute({
    sql: 'DELETE FROM number_health_logs WHERE id = ?',
    args: [logId],
  })
}

module.exports = {
  listNumbers, createNumber, updateNumber, deleteNumber,
  listAutomations, createAutomation, updateAutomation, deleteAutomation,
  createTemplate, deleteTemplate,
  listHealthLogs, createHealthLog, deleteHealthLog,
}
