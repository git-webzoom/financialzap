import api from './api'

export async function uploadMedia(formData) {
  const { data } = await api.post('/api/midia/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data  // { media: { ... } }
}

export async function listMedia(type = null) {
  const params = type ? { type } : {}
  const { data } = await api.get('/api/midia', { params })
  return data  // { medias: [...] }
}

export async function deleteMedia(id) {
  const { data } = await api.delete(`/api/midia/${id}`)
  return data  // { ok: true }
}
