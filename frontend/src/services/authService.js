import api from './api'

export async function login({ email, password }) {
  const { data } = await api.post('/api/auth/login', { email, password })
  return data // { token, user }
}

export async function register({ name, email, password }) {
  const { data } = await api.post('/api/auth/register', { name, email, password })
  return data // { user }
}

export async function logout() {
  try {
    await api.post('/api/auth/logout')
  } finally {
    // Always clear local state even if the request fails
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
}

export async function getMe() {
  const { data } = await api.get('/api/auth/me')
  return data
}

export async function updateMe(fields) {
  const { data } = await api.patch('/api/auth/me', fields)
  return data
}

export async function listUsers() {
  const { data } = await api.get('/api/auth/users')
  return data // { users: [...] }
}

export async function createUser(fields) {
  const { data } = await api.post('/api/auth/register', fields)
  return data // { user }
}

export async function deleteUser(id) {
  await api.delete(`/api/auth/users/${id}`)
}
