import { useState, useCallback } from 'react'
import * as templateService from '../services/templateService'

export function useTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [error, setError]         = useState(null)

  const load = useCallback(async (wabaId = null) => {
    setLoading(true)
    setError(null)
    try {
      const data = await templateService.listTemplates(wabaId)
      setTemplates(Array.isArray(data.templates) ? data.templates : [])
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar templates')
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (payload) => {
    const data = await templateService.createTemplate(payload)
    return data.template
  }, [])

  const sync = useCallback(async (wabaId) => {
    setSyncing(true)
    setError(null)
    try {
      const result = await templateService.syncTemplates(wabaId)
      return result
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao sincronizar templates'
      setError(msg)
      throw new Error(msg)
    } finally {
      setSyncing(false)
    }
  }, [])

  return { templates, loading, syncing, error, load, create, sync }
}
