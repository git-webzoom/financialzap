const midiaService = require('../services/midia.service')

// POST /api/midia/upload
async function upload(req, res) {
  const { phone_number_id } = req.body
  if (!phone_number_id) return res.status(400).json({ error: 'phone_number_id é obrigatório.' })
  if (!req.file)        return res.status(400).json({ error: 'Nenhum arquivo enviado.' })

  try {
    const media = await midiaService.uploadMedia(req.user.sub, phone_number_id, req.file)
    res.status(201).json({ media })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// GET /api/midia
async function list(req, res) {
  try {
    const type   = req.query.type?.toUpperCase() || null
    const medias = await midiaService.listMedia(req.user.sub, type)
    res.json({ medias })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// DELETE /api/midia/:id
async function remove(req, res) {
  try {
    await midiaService.deleteMedia(req.user.sub, Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

module.exports = { upload, list, remove }
