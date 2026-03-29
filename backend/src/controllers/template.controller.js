const templateService = require('../services/template.service')

// GET /api/templates
// Query params: ?waba_id=<id>  (optional filter)
async function list(req, res) {
  try {
    const templates = await templateService.listTemplates(req.user.sub, req.query.waba_id || null)
    res.json({ templates })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// POST /api/templates
// Body: { waba_id, name, category, language, components }
async function create(req, res) {
  const { waba_id, name, category, language, components } = req.body

  if (!waba_id || !name || !category || !language || !components) {
    return res.status(400).json({ error: 'waba_id, name, category, language and components are required' })
  }

  try {
    const template = await templateService.createTemplate(req.user.sub, waba_id, {
      name,
      category,
      language,
      components,
    })
    res.status(201).json({ template })
  } catch (err) {
    const status = err.status || err.response?.status || 500
    res.status(status).json({ error: err.message })
  }
}

// POST /api/templates/sync/:wabaId
async function sync(req, res) {
  try {
    const count = await templateService.syncByWaba(req.user.sub, req.params.wabaId)
    res.json({ ok: true, templates_synced: count })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// POST /api/templates/batch
// Body: { waba_id, name_base, count, category, language, components }
async function batchCreate(req, res) {
  const { waba_id, name_base, count, category, language, components } = req.body

  if (!waba_id || !name_base || !count || !category || !language || !components) {
    return res.status(400).json({ error: 'waba_id, name_base, count, category, language and components are required' })
  }

  const n = parseInt(count, 10)
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    return res.status(400).json({ error: 'count deve ser um número inteiro entre 1 e 50' })
  }

  try {
    const result = await templateService.batchCreateTemplates(req.user.sub, waba_id, {
      nameBase: name_base,
      count: n,
      category,
      language,
      components,
    })
    res.status(201).json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// POST /api/templates/:templateId/test
// Body: { phone_number_id, to, variables?, media_url? }
async function sendTest(req, res) {
  const { templateId } = req.params
  const { phone_number_id, to, variables = {}, media_url = '' } = req.body

  if (!phone_number_id || !to) {
    return res.status(400).json({ error: 'phone_number_id e to são obrigatórios' })
  }

  try {
    const result = await templateService.sendTestMessage(
      req.user.sub,
      templateId,
      phone_number_id,
      to,
      variables,
      media_url,
    )
    res.json({ ok: true, meta: result })
  } catch (err) {
    const status = err.status || err.response?.status || 500
    const message = err.response?.data?.error?.message || err.message
    res.status(status).json({ error: message })
  }
}

// DELETE /api/templates/:wabaId/:templateId
async function remove(req, res) {
  try {
    await templateService.deleteTemplate(req.user.sub, req.params.wabaId, req.params.templateId)
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

module.exports = { list, create, batchCreate, sync, sendTest, remove }
