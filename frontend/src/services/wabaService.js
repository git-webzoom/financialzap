import api from './api'

export async function connectWaba({ access_token, waba_id }) {
  const { data } = await api.post('/wabas/connect', { access_token, waba_id })
  return data // { waba }
}

export async function listWabas() {
  const { data } = await api.get('/wabas')
  return data // { groups: [{ business_id, business_name, wabas: [...] }] }
}

export async function revokeWaba(wabaId) {
  const { data } = await api.delete(`/wabas/${wabaId}`)
  return data
}

export async function getPhoneNumbers(wabaId) {
  const { data } = await api.get(`/wabas/${wabaId}/phone-numbers`)
  return data // { phone_numbers: [...] }
}

export async function syncWaba(wabaId) {
  const { data } = await api.post(`/wabas/${wabaId}/sync`)
  return data
}
