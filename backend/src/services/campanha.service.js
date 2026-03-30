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

module.exports = { divideContacts }
