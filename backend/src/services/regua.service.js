const { getDb } = require('../db/database')

// Ordem canônica dos dias da semana para ordenação
const ORDEM_DIA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 }
const VALID_STATUS = ['ativo', 'pausado', 'agendado']
const VALID_DIAS   = Object.keys(ORDEM_DIA)

// ─── Grupos ───────────────────────────────────────────────────────────────────

async function listarGrupos() {
  const db = getDb()
  const { rows } = await db.execute({
    sql: `SELECT g.*,
            COUNT(d.id)                                         AS total_disparos,
            SUM(CASE WHEN d.status = 'ativo' THEN 1 ELSE 0 END) AS disparos_ativos
          FROM grupos g
          LEFT JOIN regua_disparos d ON d.grupo_id = g.id
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
  const { rows } = await db.execute({ sql: 'SELECT * FROM grupos WHERE id = ?', args: [lastInsertRowid] })
  return rows[0]
}

async function excluirGrupo(grupoId) {
  const db = getDb()
  const { rows: check } = await db.execute({
    sql: 'SELECT COUNT(*) AS cnt FROM regua_disparos WHERE grupo_id = ?',
    args: [grupoId],
  })
  if (Number(check[0].cnt) > 0) {
    const err = new Error('Não é possível excluir um grupo com disparos vinculados. Remova os disparos primeiro.')
    err.status = 400
    throw err
  }
  await db.execute({ sql: 'DELETE FROM grupos WHERE id = ?', args: [grupoId] })
}

// ─── Disparos ────────────────────────────────────────────────────────────────

async function listarDisparosPorGrupo(grupoId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM regua_disparos WHERE grupo_id = ? ORDER BY criado_em ASC',
    args: [Number(grupoId)],
  })

  // Ordenar em memória: recorrentes por dia_semana → horario, avulsos por data_fixa → horario
  return rows.slice().sort((a, b) => {
    if (a.tipo === 'recorrente' && b.tipo === 'recorrente') {
      const dA = ORDEM_DIA[a.dia_semana] ?? 99
      const dB = ORDEM_DIA[b.dia_semana] ?? 99
      if (dA !== dB) return dA - dB
      return (a.horario || '').localeCompare(b.horario || '')
    }
    if (a.tipo === 'avulso' && b.tipo === 'avulso') {
      const cmp = (a.data_fixa || '').localeCompare(b.data_fixa || '')
      if (cmp !== 0) return cmp
      return (a.horario || '').localeCompare(b.horario || '')
    }
    // recorrentes antes de avulsos
    return a.tipo === 'recorrente' ? -1 : 1
  })
}

function _validarDisparo({ nome, tipo, dia_semana, data_fixa, horario }) {
  if (!nome?.trim())  { const e = new Error('nome é obrigatório');    e.status = 400; throw e }
  if (!horario?.trim()) { const e = new Error('horario é obrigatório'); e.status = 400; throw e }
  if (!['recorrente', 'avulso'].includes(tipo)) {
    const e = new Error("tipo deve ser 'recorrente' ou 'avulso'"); e.status = 400; throw e
  }
  if (tipo === 'recorrente') {
    if (!dia_semana || !VALID_DIAS.includes(dia_semana)) {
      const e = new Error('dia_semana é obrigatório para tipo recorrente'); e.status = 400; throw e
    }
  }
  if (tipo === 'avulso') {
    if (!data_fixa) {
      const e = new Error('data_fixa é obrigatória para tipo avulso'); e.status = 400; throw e
    }
  }
}

const VALID_COPY = ['texto', 'video', 'imagem']

async function criarDisparo(grupoId, { nome, tipo = 'recorrente', dia_semana, data_fixa, horario, ferramenta, tipo_copy, status, responsavel, observacao }) {
  _validarDisparo({ nome, tipo, dia_semana, data_fixa, horario })

  const st  = status && VALID_STATUS.includes(status) ? status : 'ativo'
  const tc  = tipo_copy && VALID_COPY.includes(tipo_copy) ? tipo_copy : null
  const db  = getDb()
  const now = new Date().toISOString()

  const { lastInsertRowid } = await db.execute({
    sql: `INSERT INTO regua_disparos
            (grupo_id, nome, tipo, dia_semana, data_fixa, horario, ferramenta, tipo_copy, status, responsavel, observacao, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      Number(grupoId),
      nome.trim(),
      tipo,
      tipo === 'recorrente' ? dia_semana : null,
      tipo === 'avulso'     ? data_fixa  : null,
      horario.trim(),
      ferramenta ?? null,
      tc,
      st,
      responsavel ?? null,
      observacao  ?? null,
      now, now,
    ],
  })
  const { rows } = await db.execute({ sql: 'SELECT * FROM regua_disparos WHERE id = ?', args: [lastInsertRowid] })
  return rows[0]
}

async function editarDisparo(id, body) {
  const db = getDb()
  const { rows } = await db.execute({ sql: 'SELECT * FROM regua_disparos WHERE id = ?', args: [id] })
  if (!rows.length) { const e = new Error('Disparo não encontrado'); e.status = 404; throw e }
  const cur = rows[0]

  const nome        = body.nome        !== undefined ? body.nome        : cur.nome
  const tipo        = body.tipo        !== undefined ? body.tipo        : cur.tipo
  const dia_semana  = body.dia_semana  !== undefined ? body.dia_semana  : cur.dia_semana
  const data_fixa   = body.data_fixa   !== undefined ? body.data_fixa   : cur.data_fixa
  const horario     = body.horario     !== undefined ? body.horario     : cur.horario
  const ferramenta  = body.ferramenta  !== undefined ? body.ferramenta  : cur.ferramenta
  const tipo_copy   = body.tipo_copy && VALID_COPY.includes(body.tipo_copy) ? body.tipo_copy : (body.tipo_copy === '' ? null : cur.tipo_copy)
  const status      = body.status && VALID_STATUS.includes(body.status) ? body.status : cur.status
  const responsavel = body.responsavel !== undefined ? body.responsavel : cur.responsavel
  const observacao  = body.observacao  !== undefined ? body.observacao  : cur.observacao

  _validarDisparo({ nome, tipo, dia_semana, data_fixa, horario })

  const now = new Date().toISOString()
  await db.execute({
    sql: `UPDATE regua_disparos
          SET nome=?, tipo=?, dia_semana=?, data_fixa=?, horario=?, ferramenta=?, tipo_copy=?, status=?, responsavel=?, observacao=?, atualizado_em=?
          WHERE id=?`,
    args: [
      nome.trim(),
      tipo,
      tipo === 'recorrente' ? dia_semana : null,
      tipo === 'avulso'     ? data_fixa  : null,
      horario.trim(),
      ferramenta ?? null,
      tipo_copy  ?? null,
      status,
      responsavel ?? null,
      observacao  ?? null,
      now,
      id,
    ],
  })
  const { rows: updated } = await db.execute({ sql: 'SELECT * FROM regua_disparos WHERE id = ?', args: [id] })
  return updated[0]
}

async function excluirDisparo(id) {
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM regua_disparos WHERE id = ?', args: [id] })
}

// ─── Resumo ───────────────────────────────────────────────────────────────────

async function obterResumo() {
  const db = getDb()
  const { rows: g } = await db.execute({ sql: 'SELECT COUNT(*) AS total_grupos FROM grupos', args: [] })
  const { rows: d } = await db.execute({
    sql: `SELECT
            COUNT(*) AS total_disparos,
            SUM(CASE WHEN status = 'ativo'   THEN 1 ELSE 0 END) AS disparos_ativos,
            SUM(CASE WHEN status = 'pausado' THEN 1 ELSE 0 END) AS disparos_pausados
          FROM regua_disparos`,
    args: [],
  })
  return {
    total_grupos:      Number(g[0].total_grupos)      || 0,
    total_disparos:    Number(d[0].total_disparos)    || 0,
    disparos_ativos:   Number(d[0].disparos_ativos)   || 0,
    disparos_pausados: Number(d[0].disparos_pausados) || 0,
  }
}

module.exports = {
  listarGrupos, criarGrupo, excluirGrupo,
  listarDisparosPorGrupo, criarDisparo, editarDisparo, excluirDisparo,
  obterResumo,
}
