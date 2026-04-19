const kanban = require('../services/kanban.service')

// ─── Columns ──────────────────────────────────────────────────────────────────

async function listColumns(req, res) {
  try {
    const data = await kanban.listColumns(req.user.sub)
    res.json({ columns: data })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function createColumn(req, res) {
  const { title, color } = req.body
  if (!title) return res.status(400).json({ error: 'title é obrigatório' })
  try {
    const col = await kanban.createColumn(req.user.sub, { title, color })
    res.status(201).json({ column: col })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function updateColumn(req, res) {
  try {
    const col = await kanban.updateColumn(req.user.sub, Number(req.params.id), req.body)
    res.json({ column: col })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function deleteColumn(req, res) {
  try {
    await kanban.deleteColumn(req.user.sub, Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// ─── Cards ────────────────────────────────────────────────────────────────────

async function listCards(req, res) {
  try {
    const data = await kanban.listCards(req.user.sub)
    res.json({ cards: data })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function createCard(req, res) {
  const { column_id } = req.body
  if (!column_id) return res.status(400).json({ error: 'column_id é obrigatório' })
  try {
    const card = await kanban.createCard(req.user.sub, req.body)
    res.status(201).json({ card })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function updateCard(req, res) {
  try {
    const card = await kanban.updateCard(req.user.sub, Number(req.params.id), req.body)
    res.json({ card })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function deleteCard(req, res) {
  try {
    await kanban.deleteCard(req.user.sub, Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

module.exports = { listColumns, createColumn, updateColumn, deleteColumn, listCards, createCard, updateCard, deleteCard }
