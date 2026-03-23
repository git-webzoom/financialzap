import api from './api'

export async function login({ email, password }) {
  const { data } = await api.post('/auth/login', { email, password })
  return data // { token, user }
}

export async function register({ name, email, password }) {
  const { data } = await api.post('/auth/register', { name, email, password })
  return data // { user }
}

export async function logout() {
  try {
    await api.post('/auth/logout')
  } finally {
    // Always clear local state even if the request fails
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
}
