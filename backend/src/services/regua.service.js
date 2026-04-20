const { getDb } = require('../db/database')

// ─── Grupos ───────────────────────────────────────────────────────────────────

async function listarGrupos() {
  const db = getDb()
  const { rows } = await db.execute({
    sql: `SELECT g.*, COUNT(r.id) AS total_registros
          FROM grupos g
          LEFT JOIN regua_disparos r ON r.grupo_id = g.id
          GROUP BY g.id
          ORDER BY g.nome ASC`,
    args: [],
  })
  return rows
}

async function criarGrupo({ nome, descricao }) {
  if (!nome?.trim()) {
    const err = new Error('nome é obrigatório')
    err.status = 400
    throw err
  }
  const db = getDb()
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO grupos (nome, descricao) VALUES (?, ?)',
    args: [nome.trim(), descricao ?? null],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM grupos WHERE id = ?',
    args: [lastInsertRowid],
  })
  return rows[0]
}

async function excluirGrupo(grupoId) {
  const db = getDb()
  const { rows: check } = await db.execute({
    sql: 'SELECT COUNT(*) AS cnt FROM regua_disparos WHERE grupo_id = ?',
    args: [grupoId],
  })
  if (Number(check[0].cnt) > 0) {
    const err = new Error('Não é possível excluir um grupo com registros vinculados. Remova os registros primeiro.')
    err.status = 400
    throw err
  }
  await db.execute({ sql: 'DELETE FROM grupos WHERE id = ?', args: [grupoId] })
}

// ─── Registros ────────────────────────────────────────────────────────────────

async function listarRegistros(filtros = {}) {
  const db = getDb()
  let sql = `SELECT r.*, g.nome AS grupo_nome
             FROM regua_disparos r
             JOIN grupos g ON g.id = r.grupo_id
             WHERE 1=1`
  const args = []

  if (filtros.data) {
    sql += ' AND r.data_disparo = ?'
    args.push(filtros.data)
  }
  if (filtros.grupo_id) {
    sql += ' AND r.grupo_id = ?'
    args.push(Number(filtros.grupo_id))
  }
  if (filtros.status) {
    sql += ' AND r.status = ?'
    args.push(filtros.status)
  }

  sql += ' ORDER BY r.data_disparo DESC, r.criado_em DESC'

  const { rows } = await db.execute({ sql, args })
  return rows
}

async function criarRegistro({ grupo_id, data_disparo, regua, status, responsavel, observacao }) {
  if (!grupo_id)      { const e = new Error('grupo_id é obrigatório');     e.status = 400; throw e }
  if (!data_disparo)  { const e = new Error('data_disparo é obrigatório'); e.status = 400; throw e }
  if (!regua?.trim()) { const e = new Error('regua é obrigatório');        e.status = 400; throw e }

  const validStatus = ['ativo', 'pausado', 'agendado']
  const st = status && validStatus.includes(status) ? status : 'ativo'

  const db  = getDb()
  const now = new Date().toISOString()
  const { lastInsertRowid } = await db.execute({
    sql: `INSERT INTO regua_disparos (grupo_id, data_disparo, regua, status, responsavel, observacao, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [Number(grupo_id), data_disparo, regua.trim(), st, responsavel ?? null, observacao ?? null, now, now],
  })
  const { rows } = await db.execute({
    sql: `SELECT r.*, g.nome AS grupo_nome FROM regua_disparos r JOIN grupos g ON g.id = r.grupo_id WHERE r.id = ?`,
    args: [lastInsertRowid],
  })
  return rows[0]
}

async function editarRegistro(id, { grupo_id, data_disparo, regua, status, responsavel, observacao }) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM regua_disparos WHERE id = ?',
    args: [id],
  })
  if (!rows.length) {
    const err = new Error('Registro não encontrado')
    err.status = 404
    throw err
  }
  const cur = rows[0]
  const validStatus = ['ativo', 'pausado', 'agendado']
  const now = new Date().toISOString()

  const newGrupo    = grupo_id      !== undefined ? Number(grupo_id)   : cur.grupo_id
  const newData     = data_disparo  !== undefined ? data_disparo       : cur.data_disparo
  const newRegua    = regua         !== undefined ? regua.trim()       : cur.regua
  const newStatus   = status && validStatus.includes(status) ? status  : cur.status
  const newResp     = responsavel   !== undefined ? responsavel        : cur.responsavel
  const newObs      = observacao    !== undefined ? observacao         : cur.observacao

  await db.execute({
    sql: `UPDATE regua_disparos SET grupo_id=?, data_disparo=?, regua=?, status=?, responsavel=?, observacao=?, atualizado_em=? WHERE id=?`,
    args: [newGrupo, newData, newRegua, newStatus, newResp, newObs, now, id],
  })
  const { rows: updated } = await db.execute({
    sql: `SELECT r.*, g.nome AS grupo_nome FROM regua_disparos r JOIN grupos g ON g.id = r.grupo_id WHERE r.id = ?`,
    args: [id],
  })
  return updated[0]
}

async function excluirRegistro(id) {
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM regua_disparos WHERE id = ?', args: [id] })
}

async function obterResumo() {
  const db  = getDb()
  const today = new Date().toISOString().slice(0, 10)

  const { rows: totais } = await db.execute({
    sql: `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'ativo'    THEN 1 ELSE 0 END) AS ativos,
            SUM(CASE WHEN status = 'pausado'  THEN 1 ELSE 0 END) AS pausados,
            SUM(CASE WHEN status = 'agendado' THEN 1 ELSE 0 END) AS agendados,
            SUM(CASE WHEN data_disparo = ?    THEN 1 ELSE 0 END) AS registros_hoje
          FROM regua_disparos`,
    args: [today],
  })
  const r = totais[0]
  return {
    total:            Number(r.total)           ?? 0,
    ativos:           Number(r.ativos)          ?? 0,
    pausados:         Number(r.pausados)        ?? 0,
    agendados:        Number(r.agendados)       ?? 0,
    registros_hoje:   Number(r.registros_hoje)  ?? 0,
  }
}

module.exports = { listarGrupos, criarGrupo, excluirGrupo, listarRegistros, criarRegistro, editarRegistro, excluirRegistro, obterResumo }
