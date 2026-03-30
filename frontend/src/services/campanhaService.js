import api from './api'

/**
 * POST /api/campanhas/upload-csv
 * field: "file" (multipart/form-data)
 * Returns: { columns: string[], preview: object[], total_rows: number }
 */
export async function uploadCSV(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/api/campanhas/upload-csv', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/**
 * POST /api/campanhas
 * Creates the campaign, saves contacts and enqueues dispatch jobs.
 * Returns: { campaign_id, ... }
 */
export async function createCampanha(payload) {
  const { data } = await api.post('/api/campanhas', payload)
  return data
}

/**
 * GET /api/campanhas/:id/status
 * Returns real-time progress: { total, sent, delivered, failed, status }
 */
export async function getCampanhaStatus(campaignId) {
  const { data } = await api.get(`/api/campanhas/${campaignId}/status`)
  return data
}
