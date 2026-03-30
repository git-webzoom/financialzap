const { parseCSV } = require('../services/csv.service')

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

module.exports = { uploadCSV }
