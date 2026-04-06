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

  console.log('[webhook] Verify request — mode:', mode, 'token matches:', token === VERIFY_TOKEN)

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

    // Log every incoming webhook for diagnosis
    console.log('[webhook] Received body:', JSON.stringify(body))

    if (body.object !== 'whatsapp_business_account') {
      console.log('[webhook] Ignored — object is not whatsapp_business_account:', body.object)
      return
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        console.log('[webhook] Change field:', change.field)
        if (change.field !== 'messages') continue
        const value = change.value

        // Log statuses array
        if (value.statuses?.length) {
          console.log('[webhook] Statuses:', JSON.stringify(value.statuses))
        } else {
          console.log('[webhook] No statuses in this change (may be inbound message or other event)')
        }

        for (const status of value.statuses || []) {
          await handleStatusUpdate(status)
        }
      }
    }
  } catch (err) {
    console.error('[webhook] Processing error:', err.message, err.stack)
  }
}

// ─── Status update ────────────────────────────────────────────────────────────

async function handleStatusUpdate(status) {
  const { id: wamid, status: newStatus, timestamp } = status
  console.log(`[webhook] handleStatusUpdate — wamid=${wamid} newStatus=${newStatus}`)

  // newStatus: 'sent' | 'delivered' | 'read' | 'failed'
  if (!['delivered', 'read', 'failed'].includes(newStatus)) {
    console.log(`[webhook] Ignoring status "${newStatus}" (not delivered/read/failed)`)
    return
  }

  const db = getDb()

  // Find the contact by wamid
  const { rows } = await db.execute({
    sql: 'SELECT id, campaign_id, status FROM campaign_contacts WHERE wamid = ?',
    args: [wamid],
  })

  if (!rows.length) {
    console.log(`[webhook] No campaign_contact found for wamid=${wamid} — message may not be from a campaign`)
    return
  }

  const contact = rows[0]
  const ts = timestamp ? new Date(Number(timestamp) * 1000).toISOString() : null

  console.log(`[webhook] Found contact id=${contact.id} campaign_id=${contact.campaign_id} current_status=${contact.status} → new=${newStatus}`)

  if (newStatus === 'delivered' && contact.status !== 'read') {
    await db.execute({
      sql: `UPDATE campaign_contacts SET status = 'delivered', delivered_at = ? WHERE id = ?`,
      args: [ts, contact.id],
    })
    await db.execute({
      sql: `UPDATE campaigns SET delivered = delivered + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [contact.campaign_id],
    })
    console.log(`[webhook] Marked delivered — contact=${contact.id} campaign=${contact.campaign_id}`)

  } else if (newStatus === 'read') {
    if (contact.status !== 'read') {
      // If not yet delivered, count delivered too
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
      console.log(`[webhook] Marked read — contact=${contact.id} campaign=${contact.campaign_id}`)
    }

  } else if (newStatus === 'failed') {
    const errMsg = status.errors?.[0]?.message || 'Delivery failed'
    await db.execute({
      sql: `UPDATE campaign_contacts SET status = 'failed', error_message = ? WHERE id = ?`,
      args: [errMsg.slice(0, 500), contact.id],
    })
    if (contact.status !== 'failed') {
      await db.execute({
        sql: `UPDATE campaigns SET failed = failed + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [contact.campaign_id],
      })
    }
    console.log(`[webhook] Marked failed — contact=${contact.id} campaign=${contact.campaign_id} err="${errMsg}"`)
  }
}

module.exports = { verify, receive }
