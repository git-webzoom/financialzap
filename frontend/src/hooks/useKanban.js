import { useState, useCallback } from 'react'
import * as kanbanService from '../services/kanbanService'

export function useKanban() {
  const [columns, setColumns] = useState([])
  const [cards,   setCards]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const loadBoard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cols, cds] = await Promise.all([
        kanbanService.listColumns(),
        kanbanService.listCards(),
      ])
      setColumns(cols)
      setCards(cds)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar o board')
    } finally {
      setLoading(false)
    }
  }, [])

  const createColumn = useCallback(async (payload) => {
    const col = await kanbanService.createColumn(payload)
    setColumns(prev => [...prev, col])
    return col
  }, [])

  const updateColumn = useCallback(async (id, payload) => {
    const col = await kanbanService.updateColumn(id, payload)
    setColumns(prev => prev.map(c => c.id === id ? col : c))
    return col
  }, [])

  const deleteColumn = useCallback(async (id) => {
    await kanbanService.deleteColumn(id)
    setColumns(prev => prev.filter(c => c.id !== id))
  }, [])

  const createCard = useCallback(async (payload) => {
    const card = await kanbanService.createCard(payload)
    setCards(prev => [...prev, card])
    return card
  }, [])

  const updateCard = useCallback(async (id, payload) => {
    const card = await kanbanService.updateCard(id, payload)
    setCards(prev => prev.map(c => c.id === id ? card : c))
    return card
  }, [])

  const deleteCard = useCallback(async (id) => {
    await kanbanService.deleteCard(id)
    setCards(prev => prev.filter(c => c.id !== id))
  }, [])

  // Optimistic move — updates local state immediately, then persists
  const moveCard = useCallback(async (cardId, toColumnId, newPosition) => {
    setCards(prev => {
      const card = prev.find(c => c.id === cardId)
      if (!card) return prev
      // Remove from origin and insert in destination
      const without = prev.filter(c => c.id !== cardId)
      const updated = { ...card, column_id: toColumnId, position: newPosition }
      return [...without, updated]
    })
    try {
      const card = await kanbanService.updateCard(cardId, { column_id: toColumnId, position: newPosition })
      setCards(prev => prev.map(c => c.id === cardId ? card : c))
    } catch (err) {
      // Revert on error
      setError(err.response?.data?.error || 'Erro ao mover card')
      loadBoard()
    }
  }, [loadBoard])

  // Optimistic column reorder — swaps positions locally then persists both
  const moveColumn = useCallback(async (activeId, overId) => {
    // Capture positions before optimistic update
    const activePos = columns.findIndex(c => c.id === activeId)
    const overPos   = columns.findIndex(c => c.id === overId)
    if (activePos === -1 || overPos === -1 || activePos === overPos) return

    setColumns(prev => {
      const next = [...prev]
      const [moved] = next.splice(activePos, 1)
      next.splice(overPos, 0, moved)
      return next.map((c, i) => ({ ...c, position: i }))
    })
    try {
      const newCols = await Promise.all([
        kanbanService.updateColumn(activeId, { position: overPos }),
        kanbanService.updateColumn(overId,   { position: activePos }),
      ])
      setColumns(prev => prev.map(c => {
        const updated = newCols.find(u => u.id === c.id)
        return updated ?? c
      }))
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao reordenar colunas')
      loadBoard()
    }
  }, [columns, loadBoard])

  return { columns, cards, loading, error, loadBoard, createColumn, updateColumn, deleteColumn, createCard, updateCard, deleteCard, moveCard, moveColumn }
}
