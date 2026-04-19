import api from './api'

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
