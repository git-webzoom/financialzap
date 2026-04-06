/**
 * campanha.service.js
 * Lógica de negócio de campanhas — divisão de contatos entre templates.
 */

/**
 * Divide um array de contatos entre templates de forma sequencial (fatias).
 */
function divideContacts(contacts, templateIds, options = {}) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    throw new Error('contacts deve ser um array não vazio.')
  }
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    throw new Error('templateIds deve ser um array não vazio.')
  }

  const mode = options.mode ?? 'equal'

  if (mode === 'equal')    return _divideEqual(contacts, templateIds)
  if (mode === 'weighted') return _divideWeighted(contacts, templateIds, options.weights)

  throw new Error(`Modo desconhecido: "${mode}". Use "equal" ou "weighted".`)
}

function _divideEqual(contacts, templateIds) {
  const n = templateIds.length
  const base = Math.floor(contacts.length / n)
  const result = []
  let offset = 0
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1
    const count = isLast ? contacts.length - offset : base
    result.push({ templateId: templateIds[i], contacts: contacts.slice(offset, offset + count), count })
    offset += count
  }
  return result
}

function _divideWeighted(contacts, templateIds, weights) {
  if (!Array.isArray(weights) || weights.length !== templateIds.length) {
    throw new Error('weights deve ser um array com o mesmo número de elementos que templateIds.')
  }
  const allNumbers = weights.every(w => typeof w === 'number' && w >= 0)
  if (!allNumbers) throw new Error('Todos os pesos devem ser números não negativos.')
  const total = weights.reduce((s, w) => s + w, 0)
  if (total === 0) throw new Error('A soma dos pesos não pode ser zero.')

  const n = templateIds.length
  const exactCounts = weights.map(w => (w / total) * contacts.length)
  const floored     = exactCounts.map(Math.floor)
  const remainder   = contacts.length - floored.reduce((s, c) => s + c, 0)
  const fractions   = exactCounts.map((exact, i) => ({ i, frac: exact - floored[i] }))
  fractions.sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < remainder; k++) floored[fractions[k].i]++

  const result = []
  let offset = 0
  for (let i = 0; i < n; i++) {
    const count = floored[i]
    result.push({ templateId: templateIds[i], contacts: contacts.slice(offset, offset + count), count })
    offset += count
  }
  return result
}

// ─── Create campaign ──────────────────────────────────────────────────────────

const { getDb }         = require('../db/database')
const { disparosQueue } = require('../queue')

/**
 * Enfileira os jobs de uma campanha no BullMQ com espaçamento entre eles.
 * Usado tanto para disparo imediato quanto para quando o agendamento dispara.
 * Não usa delay para o horário (esse controle é feito pelo cron de agendamento).
 * Só usa delayBetween para controlar a velocidade (msg/s).
 */
async function enqueueJobs(campaignId) {
  const db = getDb()

  // Busca campanha
  const campRes = await db.execute({
    sql: `SELECT id, waba_id, phone_number_id, speed_per_second FROM campaigns WHERE id = ?`,
    args: [campaignId],
  })
  if (!campRes.rows.length) throw new Error(`Campaign ${campaignId} not found`)
  const { waba_id: wabaId, phone_number_id: phoneNumberId, speed_per_second } = campRes.rows[0]

  // Busca todos os contatos pending
  const contactsRes = await db.execute({
    sql: `SELECT cc.id, cc.phone, cc.template_id, cc.variables, cc.media_url,
                 t.name AS template_name, t.language, t.structure
          FROM campaign_contacts cc
          JOIN templates t ON t.template_id = cc.template_id
          WHERE cc.campaign_id = ? AND cc.status = 'pending'
          ORDER BY cc.id ASC`,
    args: [campaignId],
  })
  const contacts = contactsRes.rows

  if (!contacts.length) {
    console.log(`[enqueueJobs] Campaign ${campaignId}: no pending contacts`)
    return 0
  }

  const speedPerSec   = Math.max(1, Math.min(80, Number(speed_per_second) || 1))
  const delayBetween  = Math.floor(1000 / speedPerSec)

  const jobs = contacts.map((c, i) => ({
    name: `disparo:${campaignId}:${c.id}`,
    data: {
      contactId:      c.id,
      campaignId,
      phoneNumberId,
      wabaId,
      to:             c.phone,
      templateId:     c.template_id,
      templateName:   c.template_name,
      language:       c.language || 'pt_BR',
      variables:      c.variables ? JSON.parse(c.variables) : {},
      mediaUrl:       c.media_url || null,
      structure:      c.structure ? JSON.parse(c.structure) : [],
      speedPerSecond: speedPerSec,
    },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      delay: i * delayBetween,
      removeOnComplete: { count: 500 },
      removeOnFail:     { count: 500 },
    },
  }))

  // Enqueue in chunks to avoid Redis timeouts with large campaigns
  const CHUNK = 200
  for (let i = 0; i < jobs.length; i += CHUNK) {
    await disparosQueue.addBulk(jobs.slice(i, i + CHUNK))
  }

  console.log(`[enqueueJobs] Campaign ${campaignId}: enqueued ${jobs.length} jobs at ${speedPerSec} msg/s`)
  return jobs.length
}

async function createCampanha(userId, draft) {
  const db = getDb()

  const {
    name, wabaId, phoneNumberId, speed = 1,
    scheduleType, scheduledAt,
    templates, splitMode, weights,
    phoneColumn, csvRows = [],
    personalisation = {},
  } = draft

  if (!name?.trim())       throw new Error('Nome da campanha é obrigatório.')
  if (!wabaId)             throw new Error('WABA é obrigatória.')
  if (!phoneNumberId)      throw new Error('Número de origem é obrigatório.')
  if (!templates?.length)  throw new Error('Selecione ao menos um template.')
  if (!phoneColumn)        throw new Error('Coluna do telefone não definida.')
  if (!csvRows.length)     throw new Error('Nenhum contato no CSV.')

  const isScheduled    = scheduleType === 'scheduled' && scheduledAt
  const scheduledAtVal = isScheduled ? scheduledAt : null

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

  // 3. Build resolved contacts list
  const resolved = []

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
    await db.execute({ sql: 'DELETE FROM campaigns WHERE id = ?', args: [campaignId] })
    throw new Error('Nenhum contato válido encontrado no CSV (verifique a coluna do telefone).')
  }

  // 4. Batch-insert contacts
  const CHUNK = 500
  const contactIds = []

  for (let i = 0; i < resolved.length; i += CHUNK) {
    const chunk = resolved.slice(i, i + CHUNK)
    // Store mediaUrl per contact so enqueueJobs can recover it
    const stmts = chunk.map(c => ({
      sql:  `INSERT INTO campaign_contacts (campaign_id, phone, template_id, variables, media_url, status) VALUES (?,?,?,?,?,'pending')`,
      args: [campaignId, c.phone, c.templateId, JSON.stringify(c.variables), c.mediaUrl || null],
    }))
    const results = await db.batch(stmts, 'write')
    results.forEach(r => contactIds.push(Number(r.lastInsertRowid)))
  }

  // Update total_contacts with actual count
  await db.execute({
    sql: `UPDATE campaigns SET total_contacts = ? WHERE id = ?`,
    args: [resolved.length, campaignId],
  })

  // 5. For scheduled campaigns: just mark as scheduled and wait for cron
  //    For immediate campaigns: enqueue right away
  if (isScheduled) {
    await db.execute({
      sql: `UPDATE campaigns SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [campaignId],
    })
    console.log(`[createCampanha] Campaign ${campaignId} scheduled for ${scheduledAtVal}`)
  } else {
    await db.execute({
      sql: `UPDATE campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [campaignId],
    })
    // Enqueue in background so HTTP response returns immediately
    setImmediate(async () => {
      try {
        await enqueueJobs(campaignId)
      } catch (err) {
        console.error(`[createCampanha] enqueueJobs failed for campaign ${campaignId}:`, err.message)
        await db.execute({
          sql: `UPDATE campaigns SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [campaignId],
        }).catch(() => {})
      }
    })
  }

  return { campaign_id: campaignId, total_enqueued: resolved.length }
}

// ─── Cron: dispatch scheduled campaigns ──────────────────────────────────────

/**
 * Called every minute by the cron in server.js.
 * Finds campaigns that are scheduled and whose scheduled_at has passed,
 * then enqueues their jobs immediately.
 */
async function dispatchScheduledCampaigns() {
  const db = getDb()

  const { rows } = await db.execute({
    sql: `SELECT id, name, scheduled_at FROM campaigns
          WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP`,
    args: [],
  })

  if (!rows.length) return

  for (const campaign of rows) {
    console.log(`[cron:scheduled] Firing campaign ${campaign.id} "${campaign.name}" (was scheduled for ${campaign.scheduled_at})`)
    try {
      // Mark as running first so it doesn't get picked up again
      await db.execute({
        sql: `UPDATE campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [campaign.id],
      })
      await enqueueJobs(campaign.id)
    } catch (err) {
      console.error(`[cron:scheduled] Failed to dispatch campaign ${campaign.id}:`, err.message)
      await db.execute({
        sql: `UPDATE campaigns SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [campaign.id],
      }).catch(() => {})
    }
  }
}

// ─── Get campaign contacts ────────────────────────────────────────────────────

async function getCampanhaContacts(userId, campaignId, opts = {}) {
  const db = getDb()

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

async function cancelCampanha(userId, campaignId) {
  const db = getDb()

  const res = await db.execute({
    sql: 'SELECT id, status FROM campaigns WHERE id = ? AND user_id = ?',
    args: [campaignId, userId],
  })
  if (!res.rows.length) throw new Error('Campanha não encontrada.')
  const { status } = res.rows[0]
  if (!['pending', 'queuing', 'scheduled', 'running'].includes(status)) {
    throw new Error(`Não é possível cancelar uma campanha com status "${status}".`)
  }

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

async function deleteCampanha(userId, campaignId) {
  const db = getDb()

  const res = await db.execute({
    sql: 'SELECT id, status FROM campaigns WHERE id = ? AND user_id = ?',
    args: [campaignId, userId],
  })
  if (!res.rows.length) throw new Error('Campanha não encontrada.')
  const { status } = res.rows[0]

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
  enqueueJobs,
  dispatchScheduledCampaigns,
  getCampanhaStatus,
  listCampanhas,
  getCampanhaContacts,
  cancelCampanha,
  deleteCampanha,
}
