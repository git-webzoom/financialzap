import { useState, useCallback } from 'react'
import * as svc from '../services/fluxoService'

export function useFluxo() {
  const [grupos,          setGrupos]          = useState([])
  const [grupoSelecionado, setGrupoSelecionado] = useState(null)
  const [disparos,        setDisparos]        = useState([])
  const [resumo,          setResumo]          = useState({ total_grupos: 0, total_disparos: 0, disparos_ativos: 0, disparos_pausados: 0 })
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)

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
    if (grupoSelecionado?.id === id) setGrupoSelecionado(null)
  }, [grupoSelecionado])

  const selecionarGrupo = useCallback(async (grupo) => {
    setGrupoSelecionado(grupo)
    setLoading(true)
    setError(null)
    try {
      setDisparos(await svc.listarDisparos(grupo.id))
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar disparos')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDisparos = useCallback(async (grupoId) => {
    setLoading(true)
    setError(null)
    try {
      setDisparos(await svc.listarDisparos(grupoId))
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar disparos')
    } finally {
      setLoading(false)
    }
  }, [])

  const criarDisparo = useCallback(async (grupoId, payload) => {
    const disparo = await svc.criarDisparo(grupoId, payload)
    setDisparos(prev => [...prev, disparo])
    setGrupos(prev => prev.map(g => g.id === grupoId
      ? { ...g, total_disparos: (Number(g.total_disparos) || 0) + 1, disparos_ativos: disparo.status === 'ativo' ? (Number(g.disparos_ativos) || 0) + 1 : g.disparos_ativos }
      : g
    ))
    return disparo
  }, [])

  const editarDisparo = useCallback(async (id, payload) => {
    const disparo = await svc.editarDisparo(id, payload)
    setDisparos(prev => prev.map(d => d.id === id ? disparo : d))
    return disparo
  }, [])

  const excluirDisparo = useCallback(async (id) => {
    await svc.excluirDisparo(id)
    setDisparos(prev => prev.filter(d => d.id !== id))
  }, [])

  const fetchResumo = useCallback(async () => {
    try {
      setResumo(await svc.obterResumo())
    } catch { /* não-crítico */ }
  }, [])

  return {
    grupos, grupoSelecionado, disparos, resumo, loading, error,
    fetchGrupos, criarGrupo, excluirGrupo, selecionarGrupo,
    fetchDisparos, criarDisparo, editarDisparo, excluirDisparo,
    fetchResumo,
    setGrupoSelecionado,
  }
}
