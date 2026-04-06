/**
 * disparo.worker.js
 * BullMQ worker — processes one send-message job at a time per campaign,
 * honouring the configured speed (messages/second) via a rate limiter.
 *
 * Job data shape:
 * {
 *   contactId:      number   — campaign_contacts.id
 *   campaignId:     number   — campaigns.id
 *   phoneNumberId:  string   — Meta phone_number_id (sender)
 *   wabaId:         string
 *   to:             string   — destination phone E.164 without +
 *   templateId:     string   — Meta template_id
 *   templateName:   string
 *   language:       string
 *   variables:      { [varIndex]: string }
 *   mediaUrl:       string | null
 *   structure:      object[] — template components (to build payload)
 *   speedPerSecond: number   — used to set the BullMQ rate limiter
 * }
 */

const { Worker, RateLimiter } = require('bullmq')
const { getDb }         = require('../db/database')
const metaService       = require('../services/meta.service')
const { getDecryptedToken } = require('../services/waba.service')
const { connection, QUEUE_NAME } = require('../queue')

const MAX_RETRIES = 3

function buildMetaPayload({ to, templateName, language, variables, mediaUrl, structure }) {
  const components = []

  // Header media component
  const headerComp = Array.isArray(structure) && structure.find(c => c.type === 'HEADER')
  if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format) && mediaUrl) {
    const typeMap = { IMAGE: 'image', VIDEO: 'video', DOCUMENT: 'document' }
    const mediaType = typeMap[headerComp.format]
    components.push({
      type: 'header',
      parameters: [{ type: mediaType, [mediaType]: { link: mediaUrl } }],
    })
  }

  // Body variables component
  if (variables && Object.keys(variables).length > 0) {
    const sorted = Object.entries(variables)
      .filter(([, v]) => v)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, v]) => ({ type: 'text', text: String(v) }))
    if (sorted.length > 0) {
      components.push({ type: 'body', parameters: sorted })
    }
  }

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      ...(components.length > 0 ? { components } : {}),
    },
  }
}

async function processJob(job) {
  const db = getDb()
  const {
    contactId, campaignId, phoneNumberId, wabaId,
    to, templateId, templateName, language,
    variables, mediaUrl, structure,
  } = job.data

  // Skip if contact was cancelled while job was waiting in queue
  const contactRow = await db.execute({
    sql: 'SELECT status FROM campaign_contacts WHERE id = ?',
    args: [contactId],
  })
  if (contactRow.rows.length && contactRow.rows[0].status === 'cancelled') {
    return  // silently discard — campaign was cancelled
  }

  // Get decrypted token for this WABA
  const wabaRows = await db.execute({
    sql: 'SELECT access_token_enc FROM wabas WHERE waba_id = ?',
    args: [wabaId],
  })
  if (!wabaRows.rows.length) throw new Error(`WABA ${wabaId} not found`)
  const token = getDecryptedToken({ access_token_enc: wabaRows.rows[0].access_token_enc })

  const payload = buildMetaPayload({ to, templateName, language, variables, mediaUrl, structure })

  try {
    const sendResult = await metaService.sendMessage(phoneNumberId, token, payload)
    const wamid = sendResult?.messages?.[0]?.id || null

    // Mark contact as sent, save wamid for webhook correlation
    await db.execute({
      sql: `UPDATE campaign_contacts
            SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error_message = NULL, wamid = ?
            WHERE id = ?`,
      args: [wamid, contactId],
    })

    // Increment campaign sent counter
    await db.execute({
      sql: `UPDATE campaigns SET sent = sent + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [campaignId],
    })
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message || 'Unknown error'
    const isFinal = job.attemptsMade >= MAX_RETRIES - 1

    if (isFinal) {
      // Final failure — mark as failed in DB
      await db.execute({
        sql: `UPDATE campaign_contacts
              SET status = 'failed', error_message = ?
              WHERE id = ?`,
        args: [errMsg.slice(0, 500), contactId],
      })
      await db.execute({
        sql: `UPDATE campaigns SET failed = failed + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [campaignId],
      })
    }

    // Re-throw so BullMQ can retry with backoff
    throw err
  }
}

async function checkAndFinalizeCampaign(db, campaignId) {
  const rows = await db.execute({
    sql: `SELECT status, total_contacts, failed FROM campaigns WHERE id = ?`,
    args: [campaignId],
  })
  if (!rows.rows.length) return
  const { status, total_contacts, failed } = rows.rows[0]

  // Se já está num estado final, não mexe
  if (['done', 'done_with_errors', 'cancelled', 'failed'].includes(status)) return

  // Se estava agendado e algum job executou, muda para running
  if (status === 'scheduled') {
    await db.execute({
      sql: `UPDATE campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [campaignId],
    })
  }

  // Conta quantos contatos já foram resolvidos (sent + failed + cancelled)
  const countRes = await db.execute({
    sql: `SELECT COUNT(*) as total FROM campaign_contacts WHERE campaign_id = ? AND status IN ('sent','failed','cancelled')`,
    args: [campaignId],
  })
  const settled = Number(countRes.rows[0]?.total || 0)

  if (settled >= Number(total_contacts)) {
    const finalStatus = Number(failed) > 0 ? 'done_with_errors' : 'done'
    await db.execute({
      sql: `UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [finalStatus, campaignId],
    })
  }
}

async function onCompleted(job) {
  const db = getDb()
  await checkAndFinalizeCampaign(db, job.data.campaignId)
}

async function onFailed(job, err) {
  console.error(`[worker] Job ${job.id} failed (attempt ${job.attemptsMade}/${MAX_RETRIES}): ${err.message}`)

  // Só age na tentativa final (BullMQ chama onFailed em cada tentativa)
  if (job.attemptsMade < MAX_RETRIES) return

  const db = getDb()
  await checkAndFinalizeCampaign(db, job.data.campaignId)
}

let workerInstance = null

function startWorker() {
  if (workerInstance) return workerInstance

  workerInstance = new Worker(
    QUEUE_NAME,
    processJob,
    {
      connection,
      concurrency: 1,             // one job at a time — rate limit controls throughput
      limiter: {
        max:      1,              // 1 job per duration window
        duration: 1000,           // 1 second — overridden per-campaign via job.opts
      },
      defaultJobOptions: {
        attempts: MAX_RETRIES,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail:     { count: 500 },
      },
    }
  )

  workerInstance.on('completed', onCompleted)
  workerInstance.on('failed',    onFailed)

  workerInstance.on('error', (err) => {
    console.error('[worker] Worker error:', err.message)
  })

  console.log('[worker:disparos] Started')
  return workerInstance
}

module.exports = { startWorker }
