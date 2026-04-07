const wabaService   = require('../services/waba.service')
const metaService   = require('../services/meta.service')

// POST /api/wabas/lookup
// Body: { access_token }
// Returns: { wabas: [{ waba_id, name }] }
async function lookup(req, res) {
  const { access_token } = req.body
  if (!access_token) {
    return res.status(400).json({ error: 'access_token é obrigatório.' })
  }
  try {
    const wabas = await metaService.getWabasFromToken(access_token)
    return res.json({ wabas })
  } catch (err) {
    const metaMsg = err.response?.data?.error?.message || err.message || 'Erro ao consultar a Meta.'
    const status  = err.status || err.response?.status || 500
    return res.status(status).json({ error: metaMsg })
  }
}

// POST /api/wabas/connect
// Body: { access_token, waba_id }
async function connect(req, res) {
  const { access_token, waba_id } = req.body

  if (!access_token || !waba_id) {
    return res.status(400).json({ error: 'access_token and waba_id are required' })
  }

  try {
    const waba = await wabaService.connectWaba(req.user.sub, waba_id, access_token)
    res.status(201).json({ waba })
  } catch (err) {
    const status = err.status || err.response?.status || 500
    const message = err.response?.data?.error?.message || err.message || 'Failed to connect WABA'
    res.status(status).json({ error: message })
  }
}

// GET /api/wabas
async function list(req, res) {
  try {
    const groups = await wabaService.listWabasByUser(req.user.sub)
    res.json({ groups })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// DELETE /api/wabas/:wabaId
async function revoke(req, res) {
  try {
    await wabaService.revokeWaba(req.user.sub, req.params.wabaId)
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// GET /api/wabas/:wabaId/phone-numbers
async function phoneNumbers(req, res) {
  try {
    const numbers = await wabaService.getPhoneNumbersByWaba(req.params.wabaId, req.user.sub)
    res.json({ phone_numbers: numbers })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// POST /api/wabas/:wabaId/sync
// Manually re-sync phone numbers + templates for a WABA
async function sync(req, res) {
  try {
    const db = require('../db/database').getDb()
    const { rows } = await db.execute({
      sql: 'SELECT waba_id, access_token_enc FROM wabas WHERE waba_id = ? AND user_id = ?',
      args: [req.params.wabaId, req.user.sub],
    })

    if (!rows.length) {
      return res.status(404).json({ error: 'WABA not found' })
    }

    const waba = rows[0]
    const token = wabaService.getDecryptedToken(waba)

    const [phoneCount, templateCount] = await Promise.all([
      wabaService.syncPhoneNumbers(waba.waba_id, token),
      wabaService.syncTemplates(waba.waba_id, token),
    ])

    res.json({ ok: true, phone_numbers_synced: phoneCount, templates_synced: templateCount })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// POST /api/wabas/:wabaId/subscribe-webhook
// Re-subscribe to Meta webhook events for a WABA.
// Required for delivered/read/failed status updates to work.
async function subscribeWebhook(req, res) {
  try {
    const db = require('../db/database').getDb()
    const { rows } = await db.execute({
      sql: 'SELECT waba_id, access_token_enc FROM wabas WHERE waba_id = ? AND user_id = ?',
      args: [req.params.wabaId, req.user.sub],
    })
    if (!rows.length) return res.status(404).json({ error: 'WABA not found' })

    const token = wabaService.getDecryptedToken(rows[0])

    // Check current subscriptions
    let current = null
    try {
      current = await metaService.getWebhookSubscriptions(req.params.wabaId, token)
    } catch (err) {
      console.error('[subscribeWebhook] getWebhookSubscriptions failed:', err.response?.data?.error?.message || err.message)
    }

    // Subscribe
    const result = await metaService.subscribeWebhook(req.params.wabaId, token)
    console.log('[subscribeWebhook] Result:', JSON.stringify(result))

    res.json({ ok: true, result, current_subscriptions: current })
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message
    console.error('[subscribeWebhook] Error:', msg)
    res.status(err.status || 500).json({ error: msg })
  }
}

// GET /api/wabas/:wabaId/webhook-status
// Returns diagnostic info: whether the WABA is subscribed and recent delivery activity.
async function webhookStatus(req, res) {
  try {
    const db = require('../db/database').getDb()
    const { rows } = await db.execute({
      sql: 'SELECT waba_id, access_token_enc FROM wabas WHERE waba_id = ? AND user_id = ?',
      args: [req.params.wabaId, req.user.sub],
    })
    if (!rows.length) return res.status(404).json({ error: 'WABA not found' })

    const token = wabaService.getDecryptedToken(rows[0])

    // Check subscription status
    let subscribed = false
    let subscriptionData = null
    try {
      subscriptionData = await metaService.getWebhookSubscriptions(req.params.wabaId, token)
      subscribed = Array.isArray(subscriptionData?.data) && subscriptionData.data.length > 0
    } catch (err) {
      console.error('[webhookStatus] getWebhookSubscriptions failed:', err.response?.data?.error?.message || err.message)
    }

    // Count contacts with wamid saved (sent in last 24h)
    const { rows: wamidRows } = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM campaign_contacts
            JOIN campaigns ON campaigns.id = campaign_contacts.campaign_id
            WHERE campaigns.waba_id = ?
              AND campaign_contacts.wamid IS NOT NULL
              AND campaign_contacts.sent_at >= datetime('now','-24 hours')`,
      args: [req.params.wabaId],
    })
    const wamidSavedLast24h = Number(wamidRows[0]?.cnt || 0)

    // Count contacts with delivered/read status (last 24h)
    const { rows: deliveredRows } = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM campaign_contacts
            JOIN campaigns ON campaigns.id = campaign_contacts.campaign_id
            WHERE campaigns.waba_id = ?
              AND campaign_contacts.status IN ('delivered','read')
              AND campaign_contacts.delivered_at >= datetime('now','-24 hours')`,
      args: [req.params.wabaId],
    })
    const webhooksReceivedLast24h = Number(deliveredRows[0]?.cnt || 0)

    res.json({
      subscribed,
      subscription_data: subscriptionData,
      wamid_saved_last_24h: wamidSavedLast24h,
      webhooks_received_last_24h: webhooksReceivedLast24h,
    })
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message
    console.error('[webhookStatus] Error:', msg)
    res.status(500).json({ error: msg })
  }
}

// GET /api/wabas/:wabaId/webhook-debug
// Full diagnostic: tests subscription, wamid presence, and simulates a webhook lookup.
// Returns a human-readable report of every step.
async function webhookDebug(req, res) {
  const report = []
  const ok  = (msg, data) => report.push({ ok: true,  msg, data: data ?? undefined })
  const err = (msg, data) => report.push({ ok: false, msg, data: data ?? undefined })

  try {
    const db = require('../db/database').getDb()

    // 1. Fetch WABA from DB
    const { rows } = await db.execute({
      sql: 'SELECT waba_id, access_token_enc FROM wabas WHERE waba_id = ? AND user_id = ?',
      args: [req.params.wabaId, req.user.sub],
    })
    if (!rows.length) return res.status(404).json({ error: 'WABA not found' })
    ok('WABA encontrada no banco')

    const token = wabaService.getDecryptedToken(rows[0])
    ok('Token descriptografado com sucesso')

    // 2. Check subscription via Meta API
    try {
      const subs = await metaService.getWebhookSubscriptions(req.params.wabaId, token)
      const apps = subs?.data || []
      if (apps.length > 0) {
        ok(`WABA está inscrita no webhook — ${apps.length} app(s) inscrito(s)`, apps.map(a => a.whatsapp_business_api_data?.id || a.id))
      } else {
        err('WABA NÃO está inscrita no webhook — chame POST /:wabaId/subscribe-webhook', subs)
      }
    } catch (e) {
      err('Falha ao verificar subscription: ' + (e.response?.data?.error?.message || e.message))
    }

    // 3. Try to subscribe now
    try {
      const subResult = await metaService.subscribeWebhook(req.params.wabaId, token)
      ok('subscribeWebhook chamado com sucesso agora', subResult)
    } catch (e) {
      err('subscribeWebhook FALHOU: ' + (e.response?.data?.error?.message || e.message))
    }

    // 4. Check last 10 sent contacts — do they have wamid?
    const { rows: sentRows } = await db.execute({
      sql: `SELECT campaign_contacts.id, campaign_contacts.phone, campaign_contacts.status,
                   campaign_contacts.wamid, campaign_contacts.sent_at
            FROM campaign_contacts
            JOIN campaigns ON campaigns.id = campaign_contacts.campaign_id
            WHERE campaigns.waba_id = ?
              AND campaign_contacts.status IN ('sent','delivered','read','failed')
            ORDER BY campaign_contacts.sent_at DESC LIMIT 10`,
      args: [req.params.wabaId],
    })
    if (sentRows.length === 0) {
      err('Nenhum contato enviado encontrado para esta WABA')
    } else {
      const withWamid    = sentRows.filter(r => r.wamid)
      const withoutWamid = sentRows.filter(r => !r.wamid)
      if (withWamid.length > 0) {
        ok(`${withWamid.length}/${sentRows.length} contatos recentes têm wamid salvo`, withWamid.map(r => ({ id: r.id, phone: r.phone, wamid: r.wamid, status: r.status })))
      }
      if (withoutWamid.length > 0) {
        err(`${withoutWamid.length}/${sentRows.length} contatos recentes NÃO têm wamid — a Meta não retornou o ID na resposta de envio`, withoutWamid.map(r => ({ id: r.id, phone: r.phone, status: r.status })))
      }
    }

    // 5. Check if any webhooks were ever received (any delivered/read status)
    const { rows: dlvRows } = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM campaign_contacts
            JOIN campaigns ON campaigns.id = campaign_contacts.campaign_id
            WHERE campaigns.waba_id = ?
              AND campaign_contacts.status IN ('delivered','read')`,
      args: [req.params.wabaId],
    })
    const total = Number(dlvRows[0]?.cnt || 0)
    if (total > 0) {
      ok(`${total} contato(s) já tiveram status delivered/read — webhooks estão chegando`)
    } else {
      err('Nenhum contato com status delivered/read — webhooks nunca chegaram ou wamid não está sendo salvo')
    }

    res.json({ report })
  } catch (e) {
    err('Erro interno: ' + e.message)
    res.status(500).json({ report })
  }
}

module.exports = { lookup, connect, list, revoke, phoneNumbers, sync, subscribeWebhook, webhookStatus, webhookDebug }
