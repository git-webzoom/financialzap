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
