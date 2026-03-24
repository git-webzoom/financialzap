// Instância do Axios com baseURL e interceptor de token JWT
import axios from 'axios'

// VITE_API_URL deve ser a URL raiz do backend, ex: https://api.dominio.com
// Todas as rotas nos services já incluem o prefixo /api/
const baseURL = import.meta.env.VITE_API_URL || ''
console.log('[api.js] VITE_API_URL =', import.meta.env.VITE_API_URL)
console.log('[api.js] baseURL configurada =', baseURL || '(relativa — usando proxy Vite)')

const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
