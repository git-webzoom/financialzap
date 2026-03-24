// Instância do Axios com baseURL e interceptor de token JWT
import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api'
console.log('[api.js] VITE_API_URL =', import.meta.env.VITE_API_URL)
console.log('[api.js] baseURL configurada =', baseURL)

const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
