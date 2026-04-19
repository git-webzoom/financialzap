import api from './api'

// ─── Columns ──────────────────────────────────────────────────────────────────
export async function listColumns() {
  const { data } = await api.get('/api/kanban/columns')
  return data.columns
}

export async function createColumn(payload) {
  const { data } = await api.post('/api/kanban/columns', payload)
  return data.column
}

export async function updateColumn(id, payload) {
  const { data } = await api.patch(`/api/kanban/columns/${id}`, payload)
  return data.column
}

export async function deleteColumn(id) {
  await api.delete(`/api/kanban/columns/${id}`)
}

// ─── Cards ────────────────────────────────────────────────────────────────────
export async function listCards() {
  const { data } = await api.get('/api/kanban/cards')
  return data.cards
}

export async function createCard(payload) {
  const { data } = await api.post('/api/kanban/cards', payload)
  return data.card
}

export async function updateCard(id, payload) {
  const { data } = await api.patch(`/api/kanban/cards/${id}`, payload)
  return data.card
}

export async function deleteCard(id) {
  await api.delete(`/api/kanban/cards/${id}`)
}

// ─── Card WABAs ───────────────────────────────────────────────────────────────
export async function createWaba(cardId, payload) {
  const { data } = await api.post(`/api/kanban/cards/${cardId}/wabas`, payload)
  return data.waba
}

export async function updateWaba(cardId, wabaId, payload) {
  const { data } = await api.patch(`/api/kanban/cards/${cardId}/wabas/${wabaId}`, payload)
  return data.waba
}

export async function deleteWaba(cardId, wabaId) {
  await api.delete(`/api/kanban/cards/${cardId}/wabas/${wabaId}`)
}

// ─── Card Phones ──────────────────────────────────────────────────────────────
export async function createPhone(cardId, wabaId, payload) {
  const { data } = await api.post(`/api/kanban/cards/${cardId}/wabas/${wabaId}/phones`, payload)
  return data.phone
}

export async function deletePhone(cardId, wabaId, phoneId) {
  await api.delete(`/api/kanban/cards/${cardId}/wabas/${wabaId}/phones/${phoneId}`)
}
