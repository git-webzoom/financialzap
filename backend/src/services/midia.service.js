const { getDb }   = require('../db/database')
const metaService = require('./meta.service')
const wabaService = require('./waba.service')

const MIME_TO_TYPE = {
  'image/jpeg': 'IMAGE', 'image/png': 'IMAGE', 'image/webp': 'IMAGE',
  'video/mp4':  'VIDEO',
  'application/pdf': 'DOCUMENT',
}

const SIZE_LIMITS = {
  'image/jpeg': 5  * 1024 * 1024,
  'image/png':  5  * 1024 * 1024,
  'image/webp': 5  * 1024 * 1024,
  'video/mp4':  16 * 1024 * 1024,
  'application/pdf': 100 * 1024 * 1024,
}

async function uploadMedia(userId, phoneNumberId, file) {
  const db = getDb()

  const mediaType = MIME_TO_TYPE[file.mimetype]
  if (!mediaType) {
    const err = new Error('Tipo de arquivo não suportado.')
    err.status = 400
    throw err
  }

  const limit = SIZE_LIMITS[file.mimetype]
  if (file.size > limit) {
    const mb = Math.round(limit / 1024 / 1024)
    const err = new Error(`Arquivo excede o limite de ${mb} MB para este tipo.`)
    err.status = 400
    throw err
  }

  // Verify ownership: phone_number_id must belong to user via waba
  const { rows: pRows } = await db.execute({
    sql: `SELECT pn.phone_number_id, pn.waba_id, w.access_token_enc
          FROM phone_numbers pn
          JOIN wabas w ON w.waba_id = pn.waba_id
          WHERE pn.phone_number_id = ? AND w.user_id = ?`,
    args: [phoneNumberId, userId],
  })
  if (!pRows.length) {
    const err = new Error('Número não encontrado ou sem permissão.')
    err.status = 403
    throw err
  }

  const { waba_id, access_token_enc } = pRows[0]
  const token = wabaService.getDecryptedToken({ access_token_enc })

  console.log('[midia.service] uploading to Meta — phoneNumberId:', phoneNumberId, 'mime:', file.mimetype, 'size:', file.size)

  let metaResult
  try {
    metaResult = await metaService.uploadMedia(phoneNumberId, token, file.buffer, file.mimetype, file.originalname)
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message
    console.error('[midia.service] uploadMedia Meta error:', JSON.stringify(err.response?.data || err.message))
    throw new Error(`Meta API error: ${msg}`)
  }

  const handleId = metaResult.id
  if (!handleId) throw new Error('Meta não retornou um handle_id válido.')

  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO media_uploads
            (user_id, waba_id, phone_number_id, handle_id, original_name, mime_type, file_size, media_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, waba_id, phoneNumberId, handleId, file.originalname, file.mimetype, file.size, mediaType, now],
  })

  const { rows: inserted } = await db.execute({
    sql: 'SELECT * FROM media_uploads WHERE handle_id = ?',
    args: [handleId],
  })
  return inserted[0]
}

async function listMedia(userId, mediaType = null) {
  const db = getDb()
  const sql = mediaType
    ? `SELECT m.*, w.name AS waba_name, pn.display_phone_number, pn.verified_name
       FROM media_uploads m
       JOIN wabas w ON w.waba_id = m.waba_id
       JOIN phone_numbers pn ON pn.phone_number_id = m.phone_number_id
       WHERE m.user_id = ? AND m.media_type = ?
       ORDER BY m.created_at DESC`
    : `SELECT m.*, w.name AS waba_name, pn.display_phone_number, pn.verified_name
       FROM media_uploads m
       JOIN wabas w ON w.waba_id = m.waba_id
       JOIN phone_numbers pn ON pn.phone_number_id = m.phone_number_id
       WHERE m.user_id = ?
       ORDER BY m.created_at DESC`
  const args = mediaType ? [userId, mediaType] : [userId]
  const { rows } = await db.execute({ sql, args })
  return rows
}

async function deleteMedia(userId, mediaId) {
  const db = getDb()

  const { rows } = await db.execute({
    sql: `SELECT m.*, w.access_token_enc
          FROM media_uploads m
          JOIN wabas w ON w.waba_id = m.waba_id
          WHERE m.id = ? AND m.user_id = ?`,
    args: [mediaId, userId],
  })
  if (!rows.length) {
    const err = new Error('Mídia não encontrada.')
    err.status = 404
    throw err
  }

  const record = rows[0]
  const token = wabaService.getDecryptedToken({ access_token_enc: record.access_token_enc })

  try {
    await metaService.deleteMedia(record.handle_id, token)
  } catch (err) {
    const status = err.response?.status
    const msg    = err.response?.data?.error?.message || err.message
    console.warn('[midia.service] deleteMedia Meta error (proceeding locally):', msg)
    if (status >= 500) throw new Error('Meta API indisponível — tente novamente em instantes.')
  }

  await db.execute({ sql: 'DELETE FROM media_uploads WHERE id = ?', args: [mediaId] })
}

module.exports = { uploadMedia, listMedia, deleteMedia }
