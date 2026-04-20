const svc = require('../services/regua.service')

async function listarGrupos(req, res) {
  try {
    res.json({ grupos: await svc.listarGrupos() })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function criarGrupo(req, res) {
  try {
    const grupo = await svc.criarGrupo(req.body)
    res.status(201).json({ grupo })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function excluirGrupo(req, res) {
  try {
    await svc.excluirGrupo(Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function listarRegistros(req, res) {
  try {
    const { data, grupo_id, status } = req.query
    res.json({ registros: await svc.listarRegistros({ data, grupo_id, status }) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function criarRegistro(req, res) {
  try {
    const registro = await svc.criarRegistro(req.body)
    res.status(201).json({ registro })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function editarRegistro(req, res) {
  try {
    const registro = await svc.editarRegistro(Number(req.params.id), req.body)
    res.json({ registro })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function excluirRegistro(req, res) {
  try {
    await svc.excluirRegistro(Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function obterResumo(req, res) {
  try {
    res.json(await svc.obterResumo())
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

module.exports = { listarGrupos, criarGrupo, excluirGrupo, listarRegistros, criarRegistro, editarRegistro, excluirRegistro, obterResumo }
