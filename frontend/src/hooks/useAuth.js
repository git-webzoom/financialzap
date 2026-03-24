import { useState, useCallback, useEffect } from 'react'
import * as authService from '../services/authService'

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState(getStoredUser)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Keep user in sync if localStorage changes in another tab
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'user') setUser(getStoredUser())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setLoading(true)
    setError(null)
    try {
      const { token, user } = await authService.login({ email, password })
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user)
      return user
    } catch (err) {
      const message = err.response?.data?.error || 'Erro ao fazer login'
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async ({ name, email, password }) => {
    setLoading(true)
    setError(null)
    try {
      const { user } = await authService.register({ name, email, password })
      return user
    } catch (err) {
      const message = err.response?.data?.error || 'Erro ao criar conta'
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setLoading(true)
    try {
      await authService.logout()
    } catch {
      // Ignora erros do backend — o logout local sempre acontece
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { user, loading, error, clearError, login, register, logout, isAuthenticated: !!user }
}
