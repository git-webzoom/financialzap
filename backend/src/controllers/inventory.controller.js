const inventory = require('../services/inventory.service')

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

module.exports = { listNumbers, createNumber, updateNumber, deleteNumber }
