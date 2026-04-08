import api from './api'

export async function lookupWabas(access_token) {
  const { data } = await api.post('/api/wabas/lookup', { access_token })
  return data // { wabas: [{ waba_id, name }] }
}

export async function connectWaba({ access_token, waba_id }) {
  const { data } = await api.post('/api/wabas/connect', { access_token, waba_id })
  return data // { waba }
}

export async function listWabas() {
  const { data } = await api.get('/api/wabas')
  return data // { groups: [{ business_id, business_name, wabas: [...] }] }
}

export async function revokeWaba(wabaId) {
  const { data } = await api.delete(`/api/wabas/${wabaId}`)
  return data
}

export async function getPhoneNumbers(wabaId) {
  const { data } = await api.get(`/api/wabas/${wabaId}/phone-numbers`)
  return data // { phone_numbers: [...] }
}

export async function syncWaba(wabaId) {
  const { data } = await api.post(`/api/wabas/${wabaId}/sync`)
  return data
}

export async function subscribeWebhook(wabaId) {
  const { data } = await api.post(`/api/wabas/${wabaId}/subscribe-webhook`)
  return data
}

export async function getWebhookStatus(wabaId) {
  const { data } = await api.get(`/api/wabas/${wabaId}/webhook-status`)
  return data // { subscribed, wamid_saved_last_24h, webhooks_received_last_24h }
}

export async function webhookDebug(wabaId) {
  const { data } = await api.get(`/api/wabas/${wabaId}/webhook-debug`)
  return data // { report: [{ ok, msg, data }] }
}

export async function getWabaHealth(wabaId) {
  const { data } = await api.get(`/api/wabas/${wabaId}/health`)
  return data // { waba_id, account_review_status, ban_state, decision, phone_numbers: [...] }
}
