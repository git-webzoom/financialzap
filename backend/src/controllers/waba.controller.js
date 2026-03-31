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

module.exports = { lookup, connect, list, revoke, phoneNumbers, sync }
