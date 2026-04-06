/**
 * campanha.service.js
 * Lógica de negócio de campanhas — divisão de contatos entre templates.
 */

/**
 * Divide um array de contatos entre templates de forma sequencial (fatias).
 *
 * Modos suportados:
 *  - equal   : divide igualmente; sobra vai para o último template
 *  - weighted: cada template recebe a porcentagem definida em `weights`
 *
 * @param {object[]} contacts   — array de contatos (qualquer shape)
 * @param {string[]} templateIds — IDs dos templates na ordem desejada
 * @param {object}  options
 * @param {'equal'|'weighted'} [options.mode='equal']
 * @param {number[]} [options.weights]  — porcentagens (ex: [40, 35, 25]), soma deve ser 100
 *
 * @returns {{ templateId: string, contacts: object[], count: number }[]}
 */
function divideContacts(contacts, templateIds, options = {}) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    throw new Error('contacts deve ser um array não vazio.')
  }
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    throw new Error('templateIds deve ser um array não vazio.')
  }

  const mode = options.mode ?? 'equal'

  if (mode === 'equal') {
    return _divideEqual(contacts, templateIds)
  }
  if (mode === 'weighted') {
    return _divideWeighted(contacts, templateIds, options.weights)
  }

  throw new Error(`Modo desconhecido: "${mode}". Use "equal" ou "weighted".`)
}

// ─── Equal split ──────────────────────────────────────────────────────────────

function _divideEqual(contacts, templateIds) {
  const n = templateIds.length
  const base = Math.floor(contacts.length / n)
  const result = []
  let offset = 0

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1
    // Last template absorbs all remaining contacts
    const count = isLast ? contacts.length - offset : base
    result.push({
      templateId: templateIds[i],
      contacts:   contacts.slice(offset, offset + count),
      count,
    })
    offset += count
  }

  return result
}

// ─── Weighted split ───────────────────────────────────────────────────────────

function _divideWeighted(contacts, templateIds, weights) {
  if (!Array.isArray(weights) || weights.length !== templateIds.length) {
    throw new Error('weights deve ser um array com o mesmo número de elementos que templateIds.')
  }

  const allNumbers = weights.every(w => typeof w === 'number' && w >= 0)
  if (!allNumbers) {
    throw new Error('Todos os pesos devem ser números não negativos.')
  }

  const total = weights.reduce((s, w) => s + w, 0)
  if (total === 0) {
    throw new Error('A soma dos pesos não pode ser zero.')
  }

  // Normalize weights to fractions then convert to absolute counts using
  // the largest-remainder method to avoid off-by-one due to rounding.
  const n = templateIds.length
  const exactCounts = weights.map(w => (w / total) * contacts.length)
  const floored     = exactCounts.map(Math.floor)
  const remainder   = contacts.length - floored.reduce((s, c) => s + c, 0)

  // Give the extra contacts to the templates with the largest fractional parts
  const fractions = exactCounts.map((exact, i) => ({ i, frac: exact - floored[i] }))
  fractions.sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < remainder; k++) {
    floored[fractions[k].i]++
  }

  const result = []
  let offset = 0
  for (let i = 0; i < n; i++) {
    const count = floored[i]
    result.push({
      templateId: templateIds[i],
      contacts:   contacts.slice(offset, offset + count),
      count,
    })
    offset += count
  }

  return result
}

// ─── Create campaign ──────────────────────────────────────────────────────────

const { getDb }          = require('../db/database')
const { disparosQueue }  = require('../queue')

/**
 * Persists a campaign + all contacts in the DB, then enqueues every contact
 * as a BullMQ job respecting the configured speed (messages/second).
 *
 * @param {number} userId
 * @param {object} draft  — full useCampanha draft from the frontend
 *   draft.name, draft.wabaId, draft.phoneNumberId, draft.speed,
 *   draft.scheduleType, draft.scheduledAt,
 *   draft.templates  [{ templateId, wabaId, name, language, structure }]
 *   draft.splitMode, draft.weights
 *   draft.columns, draft.phoneColumn
 *   draft.preview  (only first 5 rows — we need full CSV rows here)
 *   draft.csvRows  (full parsed rows array)
 *   draft.personalisation { [templateId]: { fixedVars, dynamicVars, mediaUrl } }
 */
async function createCampanha(userId, draft) {
  const db = getDb()

  const {
    name, wabaId, phoneNumberId, speed = 1,
    scheduleType, scheduledAt,
    templates, splitMode, weights,
    phoneColumn, csvRows = [],
    personalisation = {},
  } = draft

  if (!name?.trim())     throw new Error('Nome da campanha é obrigatório.')
  if (!wabaId)           throw new Error('WABA é obrigatória.')
  if (!phoneNumberId)    throw new Error('Número de origem é obrigatório.')
  if (!templates?.length) throw new Error('Selecione ao menos um template.')
  if (!phoneColumn)      throw new Error('Coluna do telefone não definida.')
  if (!csvRows.length)   throw new Error('Nenhum contato no CSV.')

  const scheduledAtVal = scheduleType === 'scheduled' && scheduledAt ? scheduledAt : null

  // 1. Insert campaign row
  const campaignRes = await db.execute({
    sql: `INSERT INTO campaigns
          (user_id, name, waba_id, phone_number_id, status, speed_per_second,
           scheduled_at, total_contacts, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    args: [
      userId, name.trim(), wabaId, phoneNumberId,
      'pending', Math.max(1, Math.min(80, Number(speed) || 1)),
      scheduledAtVal, csvRows.length,
    ],
  })
  const campaignId = Number(campaignRes.lastInsertRowid)

  // 2. Divide contacts per template
  const templateIds = templates.map(t => t.templateId)
  const slices = divideContacts(csvRows, templateIds, {
    mode:    splitMode || 'equal',
    weights: weights?.length ? weights : undefined,
  })

  const templateMap = Object.fromEntries(templates.map(t => [t.templateId, t]))

  // 3. Build resolved contacts list (no DB yet)
  const resolved = []  // { phone, templateId, variables, mediaUrl, tpl }

  for (const slice of slices) {
    const tpl  = templateMap[slice.templateId]
    const pers = personalisation[slice.templateId] || {}
    const { varTemplates = {}, mediaUrl = '' } = pers

    for (const row of slice.contacts) {
      const phone = String(row[phoneColumn] || '').replace(/\D/g, '')
      if (!phone) continue

      const variables = {}
      for (const [varIdx, tplStr] of Object.entries(varTemplates)) {
        variables[varIdx] = String(tplStr).replace(/\{\{([^}]+)\}\}/g, (match, col) =>
          row[col] !== undefined ? String(row[col]) : match
        )
      }

      resolved.push({ phone, templateId: slice.templateId, variables, mediaUrl, tpl })
    }
  }

  if (!resolved.length) {
    // clean up empty campaign
    await db.execute({ sql: 'DELETE FROM campaigns WHERE id = ?', args: [campaignId] })
    throw new Error('Nenhum contato válido encontrado no CSV (verifique a coluna do telefone).')
  }

  // 4. Batch-insert all contacts in one transaction (avoids N round-trips)
  const CHUNK = 500  // libsql limit per batch call
  const contactIds = []

  for (let i = 0; i < resolved.length; i += CHUNK) {
    const chunk = resolved.slice(i, i + CHUNK)
    const stmts = chunk.map(c => ({
      sql:  `INSERT INTO campaign_contacts (campaign_id, phone, template_id, variables, status) VALUES (?,?,?,?,'pending')`,
      args: [campaignId, c.phone, c.templateId, JSON.stringify(c.variables)],
    }))
    const results = await db.batch(stmts, 'write')
    results.forEach(r => contactIds.push(Number(r.lastInsertRowid)))
  }

  // 5. Build jobs array using the returned IDs
  const baseDelay = scheduledAtVal ? Math.max(0, new Date(scheduledAtVal) - Date.now()) : 0
  const jobs = resolved.map((c, i) => ({
    name: `disparo:${campaignId}:${contactIds[i]}`,
    data: {
      contactId:      contactIds[i],
      campaignId,
      phoneNumberId,
      wabaId,
      to:             c.phone,
      templateId:     c.templateId,
      templateName:   c.tpl.name,
      language:       c.tpl.language || 'pt_BR',
      variables:      c.variables,
      mediaUrl:       c.mediaUrl || null,
      structure:      c.tpl.structure || [],
      speedPerSecond: Number(speed) || 1,
    },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      delay: baseDelay,
    },
  }))

  // Update total_contacts with actual non-empty phones
  await db.execute({
    sql: `UPDATE campaigns SET total_contacts = ? WHERE id = ?`,
    args: [jobs.length, campaignId],
  })

  // 6. Enqueue all jobs with rate limiting
  const speedPerSec = Math.max(1, Math.min(80, Number(speed) || 1))
  const delayBetween = Math.floor(1000 / speedPerSec)  // ms between each job

  const jobsWithDelay = jobs.map((job, i) => ({
    ...job,
    opts: { ...job.opts, delay: (job.opts.delay || 0) + i * delayBetween },
  }))

  // 7. Mark campaign as queuing (pre-status before jobs are enqueued)
  await db.execute({
    sql: `UPDATE campaigns SET status = 'queuing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [campaignId],
  })

  // 8. Enqueue jobs in background — do NOT await so the HTTP response returns immediately.
  //    On completion, set status to running or scheduled.
  setImmediate(async () => {
    try {
      await disparosQueue.addBulk(jobsWithDelay)
      const newStatus = scheduledAtVal ? 'scheduled' : 'running'
      await db.execute({
        sql: `UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [newStatus, campaignId],
      })
    } catch (err) {
      console.error(`[createCampanha] addBulk failed for campaign ${campaignId}:`, err.message)
      await db.execute({
        sql: `UPDATE campaigns SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [campaignId],
      }).catch(() => {})
    }
  })

  return { campaign_id: campaignId, total_enqueued: jobs.length }
}

// ─── Get campaign contacts ────────────────────────────────────────────────────

/**
 * Returns paginated contacts for a campaign (ownership verified via campaign query).
 * @param {number} userId
 * @param {number} campaignId
 * @param {object} opts  — { page=1, limit=50, status? }
 */
async function getCampanhaContacts(userId, campaignId, opts = {}) {
  const db = getDb()

  // Verify ownership
  const own = await db.execute({
    sql: 'SELECT id FROM campaigns WHERE id = ? AND user_id = ?',
    args: [campaignId, userId],
  })
  if (!own.rows.length) throw new Error('Campanha não encontrada.')

  const page   = Math.max(1, parseInt(opts.page)  || 1)
  const limit  = Math.max(1, Math.min(200, parseInt(opts.limit) || 50))
  const offset = (page - 1) * limit

  let sql  = 'SELECT id, phone, template_id, status, error_message, sent_at FROM campaign_contacts WHERE campaign_id = ?'
  const args = [campaignId]

  if (opts.status) {
    sql += ' AND status = ?'
    args.push(opts.status)
  }

  const countSql = sql.replace('SELECT id, phone, template_id, status, error_message, sent_at', 'SELECT COUNT(*) as total')
  const countRes = await db.execute({ sql: countSql, args })
  const total    = Number(countRes.rows[0].total)

  sql += ' ORDER BY id ASC LIMIT ? OFFSET ?'
  args.push(limit, offset)

  const rows = await db.execute({ sql, args })

  return {
    contacts: rows.rows,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

// ─── Get campaign status ──────────────────────────────────────────────────────

/**
 * Returns real-time progress for a campaign.
 * Verifies ownership via user_id.
 */
async function getCampanhaStatus(userId, campaignId) {
  const db = getDb()
  const rows = await db.execute({
    sql: `SELECT id, name, status, total_contacts, sent, delivered, read_count, failed,
                 speed_per_second, scheduled_at, created_at, updated_at
          FROM campaigns
          WHERE id = ? AND user_id = ?`,
    args: [campaignId, userId],
  })
  if (!rows.rows.length) throw new Error('Campanha não encontrada.')
  return rows.rows[0]
}

/**
 * List all campaigns for a user (summary view).
 */
async function listCampanhas(userId) {
  const db = getDb()
  const rows = await db.execute({
    sql: `SELECT id, name, status, total_contacts, sent, delivered, read_count, failed,
                 speed_per_second, scheduled_at, created_at, updated_at
          FROM campaigns
          WHERE user_id = ?
          ORDER BY created_at DESC`,
    args: [userId],
  })
  return rows.rows
}

// ─── Cancel campaign ──────────────────────────────────────────────────────────

/**
 * Cancels a campaign: removes pending/delayed BullMQ jobs and marks the
 * campaign as 'cancelled'. Only allowed when status is pending/scheduled/running.
 */
async function cancelCampanha(userId, campaignId) {
  const db = getDb()

  // Verify ownership + status
  const res = await db.execute({
    sql: 'SELECT id, status FROM campaigns WHERE id = ? AND user_id = ?',
    args: [campaignId, userId],
  })
  if (!res.rows.length) throw new Error('Campanha não encontrada.')
  const { status } = res.rows[0]
  if (!['pending', 'queuing', 'scheduled', 'running'].includes(status)) {
    throw new Error(`Não é possível cancelar uma campanha com status "${status}".`)
  }

  // Mark pending contacts as cancelled
  // (Worker checks status before sending, so queued jobs will be skipped)
  await db.execute({
    sql: `UPDATE campaign_contacts SET status = 'cancelled'
          WHERE campaign_id = ? AND status = 'pending'`,
    args: [campaignId],
  })

  await db.execute({
    sql: `UPDATE campaigns SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [campaignId],
  })
}

// ─── Delete campaign ──────────────────────────────────────────────────────────

/**
 * Deletes a campaign and all its contacts (cascade).
 * If the campaign is still active (running), it must be cancelled first.
 */
async function deleteCampanha(userId, campaignId) {
  const db = getDb()

  const res = await db.execute({
    sql: 'SELECT id, status FROM campaigns WHERE id = ? AND user_id = ?',
    args: [campaignId, userId],
  })
  if (!res.rows.length) throw new Error('Campanha não encontrada.')
  const { status } = res.rows[0]

  // Auto-cancel before deleting if still active
  if (['pending', 'queuing', 'scheduled', 'running'].includes(status)) {
    await cancelCampanha(userId, campaignId)
  }

  await db.execute({
    sql: 'DELETE FROM campaigns WHERE id = ?',
    args: [campaignId],
  })
}

module.exports = {
  divideContacts,
  createCampanha,
  getCampanhaStatus,
  listCampanhas,
  getCampanhaContacts,
  cancelCampanha,
  deleteCampanha,
}
