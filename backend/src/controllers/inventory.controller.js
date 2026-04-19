const inventory = require('../services/inventory.service')
const { getDb } = require('../db/database')

// ─── Helper: verify number belongs to user ────────────────────────────────────
async function assertNumberOwnership(userId, numberId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT id FROM number_inventory WHERE id = ? AND user_id = ?',
    args: [numberId, userId],
  })
  if (!rows.length) {
    const err = new Error('Número não encontrado')
    err.status = 404
    throw err
  }
}

// ─── Numbers ──────────────────────────────────────────────────────────────────

async function listNumbers(req, res) {
  try {
    const { status, origin } = req.query
    const data = await inventory.listNumbers(req.user.sub, { status, origin })
    res.json({ numbers: data })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function createNumber(req, res) {
  try {
    const num = await inventory.createNumber(req.user.sub, req.body)
    res.status(201).json({ number: num })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function updateNumber(req, res) {
  try {
    const num = await inventory.updateNumber(req.user.sub, Number(req.params.id), req.body)
    res.json({ number: num })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function deleteNumber(req, res) {
  try {
    await inventory.deleteNumber(req.user.sub, Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// ─── Automations ──────────────────────────────────────────────────────────────

async function listAutomations(req, res) {
  try {
    const numberId = Number(req.params.numberId)
    await assertNumberOwnership(req.user.sub, numberId)
    const data = await inventory.listAutomations(numberId)
    res.json({ automations: data })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function createAutomation(req, res) {
  try {
    const numberId = Number(req.params.numberId)
    await assertNumberOwnership(req.user.sub, numberId)
    const { automation_name, template_name, daily_volume } = req.body
    if (!automation_name) return res.status(400).json({ error: 'automation_name é obrigatório' })
    const auto = await inventory.createAutomation(numberId, { automation_name, template_name, daily_volume })
    res.status(201).json({ automation: auto })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function updateAutomation(req, res) {
  try {
    const numberId = Number(req.params.numberId)
    await assertNumberOwnership(req.user.sub, numberId)
    const auto = await inventory.updateAutomation(Number(req.params.id), req.body)
    res.json({ automation: auto })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function deleteAutomation(req, res) {
  try {
    const numberId = Number(req.params.numberId)
    await assertNumberOwnership(req.user.sub, numberId)
    await inventory.deleteAutomation(Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

// ─── Health Logs ──────────────────────────────────────────────────────────────

async function listHealthLogs(req, res) {
  try {
    const numberId = Number(req.params.numberId)
    const data = await inventory.listHealthLogs(req.user.sub, numberId)
    res.json({ logs: data })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function createHealthLog(req, res) {
  try {
    const numberId = Number(req.params.numberId)
    const log = await inventory.createHealthLog(req.user.sub, numberId, req.body)
    res.status(201).json({ log })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function deleteHealthLog(req, res) {
  try {
    const numberId = Number(req.params.numberId)
    await inventory.deleteHealthLog(req.user.sub, numberId, Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

module.exports = {
  listNumbers, createNumber, updateNumber, deleteNumber,
  listAutomations, createAutomation, updateAutomation, deleteAutomation,
  listHealthLogs, createHealthLog, deleteHealthLog,
}
