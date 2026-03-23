import { useState, useCallback } from 'react'
import * as wabaService from '../services/wabaService'

export function useWabas() {
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await wabaService.listWabas()
      setGroups(Array.isArray(data.groups) ? data.groups : [])
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar WABAs')
    } finally {
      setLoading(false)
    }
  }, [])

  const connect = useCallback(async ({ access_token, waba_id }) => {
    const { waba } = await wabaService.connectWaba({ access_token, waba_id })
    await load() // refresh list
    return waba
  }, [load])

  const revoke = useCallback(async (wabaId) => {
    await wabaService.revokeWaba(wabaId)
    await load()
  }, [load])

  const sync = useCallback(async (wabaId) => {
    const result = await wabaService.syncWaba(wabaId)
    await load()
    return result
  }, [load])

  return { groups, loading, error, load, connect, revoke, sync }
}
