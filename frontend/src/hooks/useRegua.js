import { useState, useCallback } from 'react'
import * as svc from '../services/reguaService'

export function useRegua() {
  const [grupos,    setGrupos]    = useState([])
  const [registros, setRegistros] = useState([])
  const [resumo,    setResumo]    = useState({ total: 0, ativos: 0, pausados: 0, agendados: 0, registros_hoje: 0 })
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  const fetchGrupos = useCallback(async () => {
    try {
      setGrupos(await svc.listarGrupos())
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar grupos')
    }
  }, [])

  const criarGrupo = useCallback(async (payload) => {
    const grupo = await svc.criarGrupo(payload)
    setGrupos(prev => [...prev, grupo])
    return grupo
  }, [])

  const excluirGrupo = useCallback(async (id) => {
    await svc.excluirGrupo(id)
    setGrupos(prev => prev.filter(g => g.id !== id))
  }, [])

  const fetchRegistros = useCallback(async (filtros = {}) => {
    setLoading(true)
    setError(null)
    try {
      setRegistros(await svc.listarRegistros(filtros))
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar registros')
    } finally {
      setLoading(false)
    }
  }, [])

  const criarRegistro = useCallback(async (payload) => {
    const registro = await svc.criarRegistro(payload)
    setRegistros(prev => [registro, ...prev])
    return registro
  }, [])

  const editarRegistro = useCallback(async (id, payload) => {
    const registro = await svc.editarRegistro(id, payload)
    setRegistros(prev => prev.map(r => r.id === id ? registro : r))
    return registro
  }, [])

  const excluirRegistro = useCallback(async (id) => {
    await svc.excluirRegistro(id)
    setRegistros(prev => prev.filter(r => r.id !== id))
  }, [])

  const fetchResumo = useCallback(async () => {
    try {
      setResumo(await svc.obterResumo())
    } catch { /* resumo é não-crítico */ }
  }, [])

  return {
    grupos, registros, resumo, loading, error,
    fetchGrupos, criarGrupo, excluirGrupo,
    fetchRegistros, criarRegistro, editarRegistro, excluirRegistro,
    fetchResumo,
  }
}
