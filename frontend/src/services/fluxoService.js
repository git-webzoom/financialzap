import api from './api'

// ─── Grupos ───────────────────────────────────────────────────────────────────

export async function listarGrupos() {
  const { data } = await api.get('/api/fluxo/grupos')
  return data.grupos
}

export async function criarGrupo(payload) {
  const { data } = await api.post('/api/fluxo/grupos', payload)
  return data.grupo
}

export async function excluirGrupo(id) {
  await api.delete(`/api/fluxo/grupos/${id}`)
}

// ─── Disparos ────────────────────────────────────────────────────────────────

export async function listarDisparos(grupoId) {
  const { data } = await api.get(`/api/fluxo/grupos/${grupoId}/disparos`)
  return data.disparos
}

export async function criarDisparo(grupoId, payload) {
  const { data } = await api.post(`/api/fluxo/grupos/${grupoId}/disparos`, payload)
  return data.disparo
}

export async function editarDisparo(id, payload) {
  const { data } = await api.put(`/api/fluxo/disparos/${id}`, payload)
  return data.disparo
}

export async function excluirDisparo(id) {
  await api.delete(`/api/fluxo/disparos/${id}`)
}

// ─── Resumo ───────────────────────────────────────────────────────────────────

export async function obterResumo() {
  const { data } = await api.get('/api/fluxo/resumo')
  return data
}
