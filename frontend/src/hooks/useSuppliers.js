import { useState, useCallback } from 'react'
import * as svc from '../services/supplierService'

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  const load = useCallback(async (filters = {}) => {
    setLoading(true)
    setError(null)
    try {
      const data = await svc.listSuppliers(filters)
      setSuppliers(data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (payload) => {
    const supplier = await svc.createSupplier(payload)
    setSuppliers(prev => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name)))
    return supplier
  }, [])

  const update = useCallback(async (id, payload) => {
    const supplier = await svc.updateSupplier(id, payload)
    setSuppliers(prev => prev.map(s => s.id === id ? supplier : s))
    return supplier
  }, [])

  const remove = useCallback(async (id) => {
    await svc.deleteSupplier(id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }, [])

  const createLog = useCallback(async (supplierId, payload) => {
    const log = await svc.createLog(supplierId, payload)
    // Update log_count for this supplier in the list
    setSuppliers(prev => prev.map(s =>
      s.id === supplierId ? { ...s, log_count: (Number(s.log_count) || 0) + 1 } : s
    ))
    return log
  }, [])

  const deleteLog = useCallback(async (supplierId, logId) => {
    await svc.deleteLog(supplierId, logId)
    setSuppliers(prev => prev.map(s =>
      s.id === supplierId ? { ...s, log_count: Math.max(0, (Number(s.log_count) || 0) - 1) } : s
    ))
  }, [])

  return { suppliers, loading, error, load, create, update, remove, createLog, deleteLog }
}
