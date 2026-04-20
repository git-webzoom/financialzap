const svc = require('../services/fluxo.service')

async function listarGrupos(req, res) {
  try {
    res.json({ grupos: await svc.listarGrupos() })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function criarGrupo(req, res) {
  try {
    res.status(201).json({ grupo: await svc.criarGrupo(req.body) })
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

async function listarDisparos(req, res) {
  try {
    res.json({ disparos: await svc.listarDisparosPorGrupo(req.params.grupoId) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function criarDisparo(req, res) {
  try {
    res.status(201).json({ disparo: await svc.criarDisparo(req.params.grupoId, req.body) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function editarDisparo(req, res) {
  try {
    res.json({ disparo: await svc.editarDisparo(Number(req.params.id), req.body) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}

async function excluirDisparo(req, res) {
  try {
    await svc.excluirDisparo(Number(req.params.id))
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

module.exports = { listarGrupos, criarGrupo, excluirGrupo, listarDisparos, criarDisparo, editarDisparo, excluirDisparo, obterResumo }
