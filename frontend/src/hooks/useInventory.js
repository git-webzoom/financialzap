import { useState, useCallback } from 'react'
import * as inventoryService from '../services/inventoryService'

export function useInventory() {
  const [numbers, setNumbers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const load = useCallback(async (filters = {}) => {
    setLoading(true)
    setError(null)
    try {
      const data = await inventoryService.listNumbers(filters)
      setNumbers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar inventário')
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (payload) => {
    const num = await inventoryService.createNumber(payload)
    setNumbers(prev => [num, ...prev])
    return num
  }, [])

  const update = useCallback(async (id, payload) => {
    const num = await inventoryService.updateNumber(id, payload)
    setNumbers(prev => prev.map(n => n.id === id ? num : n))
    return num
  }, [])

  const remove = useCallback(async (id) => {
    await inventoryService.deleteNumber(id)
    setNumbers(prev => prev.filter(n => n.id !== id))
  }, [])

  return { numbers, loading, error, load, create, update, remove }
}
