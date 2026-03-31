/**
 * webhook.controller.js
 * Handles Meta WhatsApp Cloud API webhook events.
 *
 * GET  /api/webhook  — verification challenge (Meta calls this once when you register)
 * POST /api/webhook  — incoming notifications (message status updates, inbound messages)
 */

const { getDb } = require('../db/database')

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || ''

// ─── Verification ─────────────────────────────────────────────────────────────

function verify(req, res) {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook] Verified successfully')
    return res.status(200).send(challenge)
  }

  console.warn('[webhook] Verification failed — token mismatch')
  return res.sendStatus(403)
}

// ─── Notification handler ─────────────────────────────────────────────────────

async function receive(req, res) {
  // Acknowledge immediately — Meta expects 200 within 5 s
  res.sendStatus(200)

  try {
    const body = req.body
    if (body.object !== 'whatsapp_business_account') return

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue
        const value = change.value

        for (const status of value.statuses || []) {
          await handleStatusUpdate(status)
        }
      }
    }
  } catch (err) {
    console.error('[webhook] Processing error:', err.message)
  }
}

// ─── Status update ────────────────────────────────────────────────────────────

async function handleStatusUpdate(status) {
  const { id: wamid, status: newStatus, timestamp } = status
  // newStatus: 'sent' | 'delivered' | 'read' | 'failed'

  if (!['delivered', 'read', 'failed'].includes(newStatus)) return

  const db = getDb()

  // Find the contact by wamid
  const { rows } = await db.execute({
    sql: 'SELECT id, campaign_id, status FROM campaign_contacts WHERE wamid = ?',
    args: [wamid],
  })
  if (!rows.length) return

  const contact = rows[0]
  const ts = timestamp ? new Date(Number(timestamp) * 1000).toISOString() : null

  if (newStatus === 'delivered' && contact.status !== 'read') {
    await db.execute({
      sql: `UPDATE campaign_contacts SET status = 'delivered', delivered_at = ? WHERE id = ?`,
      args: [ts, contact.id],
    })
    await db.execute({
      sql: `UPDATE campaigns SET delivered = delivered + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [contact.campaign_id],
    })
  } else if (newStatus === 'read') {
    // read implies delivered — update both if not already
    const updates = []
    if (contact.status !== 'read') {
      if (contact.status !== 'delivered') {
        await db.execute({
          sql: `UPDATE campaigns SET delivered = delivered + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [contact.campaign_id],
        })
      }
      await db.execute({
        sql: `UPDATE campaign_contacts SET status = 'read', read_at = ? WHERE id = ?`,
        args: [ts, contact.id],
      })
      await db.execute({
        sql: `UPDATE campaigns SET read_count = read_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [contact.campaign_id],
      })
    }
  } else if (newStatus === 'failed') {
    const errMsg = status.errors?.[0]?.message || 'Delivery failed'
    await db.execute({
      sql: `UPDATE campaign_contacts SET status = 'failed', error_message = ? WHERE id = ?`,
      args: [errMsg.slice(0, 500), contact.id],
    })
    // Only increment failed if not already failed
    if (contact.status !== 'failed') {
      await db.execute({
        sql: `UPDATE campaigns SET failed = failed + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [contact.campaign_id],
      })
    }
  }

  console.log(`[webhook] wamid=${wamid} status=${newStatus} contact=${contact.id} campaign=${contact.campaign_id}`)
}

module.exports = { verify, receive }
