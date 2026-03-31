const authService = require('../services/auth.service')

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

async function getMe(req, res) {
  try {
    const profile = await authService.getProfile(req.user.sub)
    return res.json(profile)
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message })
  }
}

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────

async function updateMe(req, res) {
  try {
    const { name, email, currentPassword, newPassword } = req.body
    const profile = await authService.updateProfile(req.user.sub, { name, email, currentPassword, newPassword })
    return res.json(profile)
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message })
  }
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

async function register(req, res) {
  const { name, email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  }

  // Basic email format check — full validation is on the DB UNIQUE constraint
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email format' })
  }

  try {
    const user = await authService.register({ name, email: email.toLowerCase().trim(), password })
    return res.status(201).json({ user })
  } catch (err) {
    console.error('[register] erro:', err)
    const status = err.status || 500
    const message = status < 500 ? err.message : 'Internal server error'
    return res.status(status).json({ error: message })
  }
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

async function login(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  try {
    const result = await authService.login({ email: email.toLowerCase().trim(), password })
    return res.status(200).json(result)
  } catch (err) {
    const status = err.status || 500
    const message = status < 500 ? err.message : 'Internal server error'
    return res.status(status).json({ error: message })
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// JWTs are stateless — logout is handled client-side by discarding the token.
// This endpoint exists so the frontend has a consistent API call to hook into
// (e.g., future token blacklist, audit logging, clearing httpOnly cookies).

function logout(_req, res) {
  return res.status(200).json({ message: 'Logged out successfully' })
}

module.exports = { register, login, logout, getMe, updateMe }
