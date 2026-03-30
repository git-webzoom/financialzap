const { parseCSV } = require('../services/csv.service')
const { createCampanha, getCampanhaStatus, listCampanhas, getCampanhaContacts } = require('../services/campanha.service')

/**
 * POST /api/campanhas/upload-csv
 * Accepts a CSV file (multipart/form-data, field "file").
 * Returns: { columns, preview, total_rows }
 */
async function uploadCSV(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado. Envie o CSV no campo "file".' })
  }

  try {
    const result = parseCSV(req.file.buffer)
    return res.json(result)
  } catch (err) {
    return res.status(422).json({ error: err.message || 'Erro ao processar o arquivo CSV.' })
  }
}

/**
 * POST /api/campanhas
 * Creates a campaign and enqueues all dispatch jobs.
 * Body: full useCampanha draft including csvRows (full parsed rows).
 */
async function createCampanhaHandler(req, res) {
  try {
    const userId = req.user.id
    const result = await createCampanha(userId, req.body)
    return res.status(201).json(result)
  } catch (err) {
    return res.status(422).json({ error: err.message || 'Erro ao criar campanha.' })
  }
}

/**
 * GET /api/campanhas/:id/status
 * Returns real-time progress for a campaign (ownership verified).
 */
async function getCampanhaStatusHandler(req, res) {
  try {
    const userId = req.user.id
    const campaignId = Number(req.params.id)
    const data = await getCampanhaStatus(userId, campaignId)
    return res.json(data)
  } catch (err) {
    const status = err.message === 'Campanha não encontrada.' ? 404 : 500
    return res.status(status).json({ error: err.message })
  }
}

/**
 * GET /api/campanhas
 * Lists all campaigns for the authenticated user.
 */
async function listCampanhasHandler(req, res) {
  try {
    const userId = req.user.id
    const data = await listCampanhas(userId)
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

/**
 * GET /api/campanhas/:id/contacts
 * Returns paginated contacts for a campaign.
 */
async function getCampanhaContactsHandler(req, res) {
  try {
    const userId     = req.user.id
    const campaignId = Number(req.params.id)
    const data = await getCampanhaContacts(userId, campaignId, req.query)
    return res.json(data)
  } catch (err) {
    const status = err.message === 'Campanha não encontrada.' ? 404 : 500
    return res.status(status).json({ error: err.message })
  }
}

module.exports = { uploadCSV, createCampanhaHandler, getCampanhaStatusHandler, listCampanhasHandler, getCampanhaContactsHandler }
