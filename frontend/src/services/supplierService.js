import api from './api'

export async function listSuppliers(filters = {}) {
  const params = {}
  if (filters.type)   params.type   = filters.type
  if (filters.status) params.status = filters.status
  const { data } = await api.get('/api/suppliers', { params })
  return data.suppliers
}

export async function getSupplier(id) {
  const { data } = await api.get(`/api/suppliers/${id}`)
  return data.supplier
}

export async function createSupplier(payload) {
  const { data } = await api.post('/api/suppliers', payload)
  return data.supplier
}

export async function updateSupplier(id, payload) {
  const { data } = await api.patch(`/api/suppliers/${id}`, payload)
  return data.supplier
}

export async function deleteSupplier(id) {
  await api.delete(`/api/suppliers/${id}`)
}

export async function createLog(supplierId, payload) {
  const { data } = await api.post(`/api/suppliers/${supplierId}/logs`, payload)
  return data.log
}

export async function deleteLog(supplierId, logId) {
  await api.delete(`/api/suppliers/${supplierId}/logs/${logId}`)
}
