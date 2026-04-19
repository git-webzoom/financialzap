import api from './api'

// ─── Numbers ──────────────────────────────────────────────────────────────────

export async function listNumbers(filters = {}) {
  const { data } = await api.get('/api/inventory', { params: filters })
  return data.numbers
}

export async function createNumber(payload) {
  const { data } = await api.post('/api/inventory', payload)
  return data.number
}

export async function updateNumber(id, payload) {
  const { data } = await api.patch(`/api/inventory/${id}`, payload)
  return data.number
}

export async function deleteNumber(id) {
  await api.delete(`/api/inventory/${id}`)
}

// ─── Automations ──────────────────────────────────────────────────────────────

export async function listAutomations(numberId) {
  const { data } = await api.get(`/api/inventory/${numberId}/automations`)
  return data.automations
}

export async function createAutomation(numberId, payload) {
  const { data } = await api.post(`/api/inventory/${numberId}/automations`, payload)
  return data.automation
}

export async function updateAutomation(numberId, automationId, payload) {
  const { data } = await api.patch(`/api/inventory/${numberId}/automations/${automationId}`, payload)
  return data.automation
}

export async function deleteAutomation(numberId, automationId) {
  await api.delete(`/api/inventory/${numberId}/automations/${automationId}`)
}
