const svc = require('../services/supplier.service')

async function list(req, res) {
  try {
    const { type, status } = req.query
    const data = await svc.listSuppliers(req.user.sub, { type, status })
    res.json({ suppliers: data })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function get(req, res) {
  try {
    const data = await svc.getSupplier(req.user.sub, Number(req.params.id))
    res.json({ supplier: data })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function create(req, res) {
  const { name, type } = req.body
  if (!name) return res.status(400).json({ error: 'name é obrigatório' })
  if (!type) return res.status(400).json({ error: 'type é obrigatório' })
  try {
    const supplier = await svc.createSupplier(req.user.sub, req.body)
    res.status(201).json({ supplier })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function update(req, res) {
  try {
    const supplier = await svc.updateSupplier(req.user.sub, Number(req.params.id), req.body)
    res.json({ supplier })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function remove(req, res) {
  try {
    await svc.deleteSupplier(req.user.sub, Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function createLog(req, res) {
  const { description } = req.body
  if (!description) return res.status(400).json({ error: 'description é obrigatório' })
  try {
    const log = await svc.createLog(Number(req.params.id), req.user.sub, req.body)
    res.status(201).json({ log })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function deleteLog(req, res) {
  try {
    await svc.deleteLog(Number(req.params.logId), req.user.sub)
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

module.exports = { list, get, create, update, remove, createLog, deleteLog }
