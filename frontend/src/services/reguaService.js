import api from './api'

// ─── Grupos ───────────────────────────────────────────────────────────────────

export async function listarGrupos() {
  const { data } = await api.get('/api/regua/grupos')
  return data.grupos
}

export async function criarGrupo(payload) {
  const { data } = await api.post('/api/regua/grupos', payload)
  return data.grupo
}

export async function excluirGrupo(id) {
  await api.delete(`/api/regua/grupos/${id}`)
}

// ─── Registros ────────────────────────────────────────────────────────────────

export async function listarRegistros(filtros = {}) {
  const { data } = await api.get('/api/regua/registros', { params: filtros })
  return data.registros
}

export async function criarRegistro(payload) {
  const { data } = await api.post('/api/regua/registros', payload)
  return data.registro
}

export async function editarRegistro(id, payload) {
  const { data } = await api.put(`/api/regua/registros/${id}`, payload)
  return data.registro
}

export async function excluirRegistro(id) {
  await api.delete(`/api/regua/registros/${id}`)
}

// ─── Resumo ───────────────────────────────────────────────────────────────────

export async function obterResumo() {
  const { data } = await api.get('/api/regua/resumo')
  return data
}
