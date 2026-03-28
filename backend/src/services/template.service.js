const { getDb } = require('../db/database')
const metaService = require('./meta.service')
const wabaService = require('./waba.service')

// ─── List templates (from local DB) ──────────────────────────────────────────

/**
 * List all templates for the authenticated user.
 * Optionally filter by wabaId.
 * Never calls the Meta API — reads from local cache only.
 */
async function listTemplates(userId, wabaId = null) {
  const db = getDb()

  const sql = wabaId
    ? `SELECT t.*, w.name AS waba_name
       FROM templates t
       JOIN wabas w ON w.waba_id = t.waba_id
       WHERE w.user_id = ? AND t.waba_id = ?
       ORDER BY t.created_at DESC`
    : `SELECT t.*, w.name AS waba_name
       FROM templates t
       JOIN wabas w ON w.waba_id = t.waba_id
       WHERE w.user_id = ?
       ORDER BY t.created_at DESC`

  const args = wabaId ? [userId, wabaId] : [userId]
  const { rows } = await db.execute({ sql, args })

  return rows.map((r) => ({
    ...r,
    structure: r.structure ? JSON.parse(r.structure) : [],
  }))
}

// ─── Create template (Meta API → local DB) ───────────────────────────────────

/**
 * Create a template on Meta then save it locally.
 * payload follows the Meta message_templates format.
 */
async function createTemplate(userId, wabaId, payload) {
  const db = getDb()

  // Verify ownership and get decrypted token
  const { rows } = await db.execute({
    sql: 'SELECT waba_id, access_token_enc FROM wabas WHERE waba_id = ? AND user_id = ?',
    args: [wabaId, userId],
  })
  if (!rows.length) {
    const err = new Error('WABA not found')
    err.status = 404
    throw err
  }

  const token = wabaService.getDecryptedToken(rows[0])

  // Call Meta API
  let metaResult
  try {
    metaResult = await metaService.createTemplate(wabaId, token, payload)
  } catch (err) {
    const metaError = err.response?.data?.error?.message || err.message
    throw new Error(`Meta API error: ${metaError}`)
  }

  // Save locally (upsert — Meta may return the same id if template already exists)
  const now = new Date().toISOString()
  await db.execute({
    sql: `
      INSERT INTO templates (waba_id, template_id, name, status, category, language, structure, last_sync_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(waba_id, template_id) DO UPDATE SET
        name         = excluded.name,
        status       = excluded.status,
        category     = excluded.category,
        language     = excluded.language,
        structure    = excluded.structure,
        last_sync_at = excluded.last_sync_at
    `,
    args: [
      wabaId,
      metaResult.id,
      payload.name,
      metaResult.status ?? 'PENDING',
      payload.category  ?? null,
      payload.language  ?? null,
      JSON.stringify(payload.components ?? []),
      now,
    ],
  })

  return {
    template_id: metaResult.id,
    name:        payload.name,
    status:      metaResult.status ?? 'PENDING',
    category:    payload.category ?? null,
    language:    payload.language ?? null,
    structure:   payload.components ?? [],
  }
}

// ─── Sync templates for one WABA ─────────────────────────────────────────────

/**
 * Pull all templates from Meta for a given WABA and upsert into local DB.
 * Verifies ownership before syncing.
 * Returns the number of templates synced.
 */
async function syncByWaba(userId, wabaId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT waba_id, access_token_enc FROM wabas WHERE waba_id = ? AND user_id = ?',
    args: [wabaId, userId],
  })
  if (!rows.length) {
    const err = new Error('WABA not found')
    err.status = 404
    throw err
  }

  const token = wabaService.getDecryptedToken(rows[0])
  return wabaService.syncTemplates(wabaId, token)
}

// ─── Daily cron: sync all active WABAs ───────────────────────────────────────

/**
 * Called by the daily cron job.
 * Fetches all active WABAs and syncs their templates.
 */
async function syncAllWabas() {
  const db = getDb()
  const { rows } = await db.execute({
    sql: "SELECT waba_id, access_token_enc FROM wabas WHERE status = 'ACTIVE'",
    args: [],
  })

  let total = 0
  for (const waba of rows) {
    try {
      const token = wabaService.getDecryptedToken(waba)
      const count = await wabaService.syncTemplates(waba.waba_id, token)
      total += count
      console.log(`[cron:templates] WABA ${waba.waba_id} — ${count} templates synced`)
    } catch (err) {
      console.error(`[cron:templates] WABA ${waba.waba_id} sync failed:`, err.message)
    }
  }

  console.log(`[cron:templates] Daily sync complete — ${rows.length} WABAs, ${total} templates total`)
  return { wabas: rows.length, templates: total }
}

// ─── Delete template (Meta API → local DB) ───────────────────────────────────

async function deleteTemplate(userId, wabaId, templateId) {
  const db = getDb()

  // Fetch template name + verify ownership via waba
  const { rows } = await db.execute({
    sql: `SELECT t.name, w.access_token_enc
          FROM templates t
          JOIN wabas w ON w.waba_id = t.waba_id
          WHERE t.waba_id = ? AND t.template_id = ? AND w.user_id = ?`,
    args: [wabaId, templateId, userId],
  })
  if (!rows.length) {
    const err = new Error('Template not found')
    err.status = 404
    throw err
  }

  const { name, access_token_enc } = rows[0]
  const token = wabaService.getDecryptedToken({ access_token_enc })

  // Delete on Meta (by name — Meta's requirement)
  try {
    await metaService.deleteTemplate(wabaId, token, name)
  } catch (err) {
    // If Meta says it doesn't exist, proceed to delete locally anyway
    const metaMsg = err.response?.data?.error?.message || ''
    if (!metaMsg.includes('does not exist') && !metaMsg.includes('not found')) {
      throw new Error(`Meta API error: ${metaMsg || err.message}`)
    }
  }

  // Delete locally
  await db.execute({
    sql: 'DELETE FROM templates WHERE waba_id = ? AND template_id = ?',
    args: [wabaId, templateId],
  })
}

module.exports = {
  listTemplates,
  createTemplate,
  deleteTemplate,
  syncByWaba,
  syncAllWabas,
}
