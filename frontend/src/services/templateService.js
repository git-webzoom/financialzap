import api from './api'

// GET /api/templates — reads from local DB only
// Optional: ?waba_id= to filter by WABA
export async function listTemplates(wabaId = null) {
  const params = wabaId ? { waba_id: wabaId } : {}
  const { data } = await api.get('/api/templates', { params })
  return data // { templates: [...] }
}

// POST /api/templates — creates on Meta then saves locally
export async function createTemplate(payload) {
  const { data } = await api.post('/api/templates', payload)
  return data // { template }
}

// POST /api/templates/sync/:wabaId — syncs all templates of a WABA from Meta
export async function syncTemplates(wabaId) {
  const { data } = await api.post(`/api/templates/sync/${wabaId}`)
  return data // { ok, templates_synced }
}

// POST /api/templates/batch — creates N templates with incrementing name suffix
export async function batchCreateTemplates(payload) {
  const { data } = await api.post('/api/templates/batch', payload)
  return data // { results: [{ name, template_id, status, error }] }
}

// DELETE /api/templates/:wabaId/:templateId — deletes from Meta and local DB
export async function deleteTemplate(wabaId, templateId) {
  const { data } = await api.delete(`/api/templates/${wabaId}/${templateId}`)
  return data // { ok }
}

// PATCH /api/templates/:templateId/preview-url — salva URL de prévia localmente (não envia à Meta)
export async function updatePreviewUrl(templateId, previewUrl) {
  const { data } = await api.patch(`/api/templates/${templateId}/preview-url`, { preview_url: previewUrl })
  return data
}

// POST /api/templates/:templateId/test — send a test message via Meta Cloud API
// payload: { phone_number_id, to, variables?, media_url? }
export async function sendTestMessage(templateId, payload) {
  const { data } = await api.post(`/api/templates/${templateId}/test`, payload)
  return data // { ok, meta }
}
