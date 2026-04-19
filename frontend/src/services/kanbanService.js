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
