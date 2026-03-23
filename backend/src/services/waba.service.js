const crypto = require('crypto')
const { getDb } = require('../db/database')
const metaService = require('./meta.service')

// ─── Encryption helpers ───────────────────────────────────────────────────────
// Tokens OAuth dos clientes são criptografados com AES-256-GCM antes de
// persistir no banco. A chave deve ter exatamente 32 bytes (256 bits).

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY
  if (!key || Buffer.from(key).length < 32) {
    throw new Error('ENCRYPTION_KEY must be set and at least 32 characters long')
  }
  return Buffer.from(key).slice(0, 32)
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(12):tag(16):ciphertext — all hex-encoded, colon-separated
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decrypt(encoded) {
  const [ivHex, tagHex, dataHex] = encoded.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(data) + decipher.final('utf8')
}

// ─── Connect WABA ─────────────────────────────────────────────────────────────

/**
 * Full OAuth connect flow:
 * 1. Fetch WABA info + business_id from Meta
 * 2. Save WABA to DB (token encrypted)
 * 3. Sync phone numbers
 * 4. Sync templates
 */
async function connectWaba(userId, wabaId, accessToken) {
  // 1. Fetch WABA metadata from Meta
  const wabaInfo = await metaService.getWabaInfo(wabaId, accessToken)

  const businessId   = wabaInfo.owner_business_info?.id   ?? null
  const businessName = wabaInfo.owner_business_info?.name ?? null
  const currency     = wabaInfo.currency     ?? null
  const timezone     = wabaInfo.timezone_id  ?? null
  const name         = wabaInfo.name         ?? null

  // 2. Save WABA (upsert — reconnect updates the token)
  const db = getDb()
  const tokenEnc = encrypt(accessToken)
  const now = new Date().toISOString()

  await db.execute({
    sql: `
      INSERT INTO wabas (user_id, waba_id, name, access_token_enc, business_id, business_name, currency, timezone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      ON CONFLICT(waba_id) DO UPDATE SET
        name             = excluded.name,
        access_token_enc = excluded.access_token_enc,
        business_id      = excluded.business_id,
        business_name    = excluded.business_name,
        currency         = excluded.currency,
        timezone         = excluded.timezone,
        status           = 'ACTIVE'
    `,
    args: [userId, wabaId, name, tokenEnc, businessId, businessName, currency, timezone],
  })

  // 3. Sync phone numbers
  await syncPhoneNumbers(wabaId, accessToken)

  // 4. Sync templates
  await syncTemplates(wabaId, accessToken)

  return {
    waba_id: wabaId,
    name,
    business_id: businessId,
    business_name: businessName,
    currency,
    timezone,
  }
}

// ─── List WABAs ───────────────────────────────────────────────────────────────

async function listWabasByUser(userId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: `
      SELECT w.id, w.waba_id, w.name, w.business_id, w.business_name,
             w.currency, w.timezone, w.status, w.created_at,
             (SELECT COUNT(*) FROM phone_numbers p WHERE p.waba_id = w.waba_id) AS phone_count,
             (SELECT COUNT(*) FROM templates t WHERE t.waba_id = w.waba_id)     AS template_count
      FROM wabas w
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `,
    args: [userId],
  })

  // Group by business for frontend display
  const byBusiness = {}
  for (const row of rows) {
    const key = row.business_id || '__no_bm__'
    if (!byBusiness[key]) {
      byBusiness[key] = {
        business_id:   row.business_id,
        business_name: row.business_name || 'Sem Business Manager',
        wabas: [],
      }
    }
    byBusiness[key].wabas.push({
      id:             row.id,
      waba_id:        row.waba_id,
      name:           row.name,
      currency:       row.currency,
      timezone:       row.timezone,
      status:         row.status,
      created_at:     row.created_at,
      phone_count:    Number(row.phone_count),
      template_count: Number(row.template_count),
    })
  }

  return Object.values(byBusiness)
}

// ─── Revoke WABA ──────────────────────────────────────────────────────────────

async function revokeWaba(userId, wabaId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT id FROM wabas WHERE waba_id = ? AND user_id = ?',
    args: [wabaId, userId],
  })
  if (!rows.length) {
    const err = new Error('WABA not found')
    err.status = 404
    throw err
  }
  await db.execute({
    sql: 'DELETE FROM wabas WHERE waba_id = ? AND user_id = ?',
    args: [wabaId, userId],
  })
}

// ─── Phone number sync ────────────────────────────────────────────────────────

async function syncPhoneNumbers(wabaId, accessToken) {
  const numbers = await metaService.getPhoneNumbers(wabaId, accessToken)
  const db = getDb()
  const now = new Date().toISOString()

  for (const n of numbers) {
    await db.execute({
      sql: `
        INSERT INTO phone_numbers
          (waba_id, phone_number_id, display_phone_number, verified_name, quality_rating,
           messaging_limit_tier, status, is_verified_business, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(phone_number_id) DO UPDATE SET
          display_phone_number = excluded.display_phone_number,
          verified_name        = excluded.verified_name,
          quality_rating       = excluded.quality_rating,
          messaging_limit_tier = excluded.messaging_limit_tier,
          status               = excluded.status,
          is_verified_business = excluded.is_verified_business,
          updated_at           = excluded.updated_at
      `,
      args: [
        wabaId,
        n.id,
        n.display_phone_number ?? null,
        n.verified_name        ?? null,
        n.quality_rating       ?? null,
        n.messaging_limit_tier ?? null,
        n.status               ?? null,
        n.is_verified_business ? 1 : 0,
        now,
      ],
    })
  }

  return numbers.length
}

// ─── Template sync ────────────────────────────────────────────────────────────

async function syncTemplates(wabaId, accessToken) {
  const templates = await metaService.getTemplates(wabaId, accessToken)
  const db = getDb()
  const now = new Date().toISOString()

  for (const t of templates) {
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
        t.id,
        t.name,
        t.status   ?? null,
        t.category ?? null,
        t.language ?? null,
        JSON.stringify(t.components ?? []),
        now,
      ],
    })
  }

  return templates.length
}

// ─── Get phone numbers for a WABA (from local DB) ────────────────────────────

async function getPhoneNumbersByWaba(wabaId, userId) {
  const db = getDb()
  // Verify ownership first
  const { rows: wabaRows } = await db.execute({
    sql: 'SELECT id FROM wabas WHERE waba_id = ? AND user_id = ?',
    args: [wabaId, userId],
  })
  if (!wabaRows.length) {
    const err = new Error('WABA not found')
    err.status = 404
    throw err
  }

  const { rows } = await db.execute({
    sql: 'SELECT * FROM phone_numbers WHERE waba_id = ? ORDER BY created_at ASC',
    args: [wabaId],
  })
  return rows
}

// ─── Decrypt token (used by other services that need to call Meta) ────────────

function getDecryptedToken(waba) {
  return decrypt(waba.access_token_enc)
}

module.exports = {
  connectWaba,
  listWabasByUser,
  revokeWaba,
  syncPhoneNumbers,
  syncTemplates,
  getPhoneNumbersByWaba,
  getDecryptedToken,
}
