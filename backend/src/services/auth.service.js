const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getDb } = require('../db/database')

const SALT_ROUNDS = 12

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long')
  }
  return secret
}

// ─── Register ─────────────────────────────────────────────────────────────────

async function register({ name, email, password }) {
  const db = getDb()

  const { rows } = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email],
  })

  if (rows.length > 0) {
    const err = new Error('Email already in use')
    err.status = 409
    throw err
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS)

  const result = await db.execute({
    sql: 'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    args: [name ?? null, email, password_hash],
  })

  return { id: Number(result.lastInsertRowid), email, name: name ?? null }
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function login({ email, password }) {
  const db = getDb()

  const { rows } = await db.execute({
    sql: 'SELECT id, email, name, password_hash FROM users WHERE email = ?',
    args: [email],
  })

  const user = rows[0] ?? null

  // Always run bcrypt compare to prevent timing-based email enumeration
  const hash = user ? user.password_hash : '$2a$12$invalidhashpaddingtomakeconstanttime'
  const valid = await bcrypt.compare(password, hash)

  if (!user || !valid) {
    const err = new Error('Invalid credentials')
    err.status = 401
    throw err
  }

  const token = jwt.sign(
    { sub: Number(user.id), email: user.email },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

  return {
    token,
    user: { id: Number(user.id), email: user.email, name: user.name },
  }
}

// ─── Get profile ──────────────────────────────────────────────────────────────

async function getProfile(userId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT id, name, email, created_at FROM users WHERE id = ?',
    args: [userId],
  })
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 })
  return rows[0]
}

// ─── Update profile ───────────────────────────────────────────────────────────

async function updateProfile(userId, { name, email, currentPassword, newPassword }) {
  const db = getDb()

  const { rows } = await db.execute({
    sql: 'SELECT id, email, password_hash FROM users WHERE id = ?',
    args: [userId],
  })
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 })
  const user = rows[0]

  const updates = []
  const args    = []

  // Name update
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw Object.assign(new Error('Nome inválido.'), { status: 400 })
    }
    updates.push('name = ?')
    args.push(name.trim())
  }

  // Email update
  if (email !== undefined) {
    const norm = email.toLowerCase().trim()
    if (!norm.includes('@')) {
      throw Object.assign(new Error('Email inválido.'), { status: 400 })
    }
    // Check uniqueness (exclude self)
    const { rows: existing } = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ? AND id != ?',
      args: [norm, userId],
    })
    if (existing.length) throw Object.assign(new Error('Email já está em uso.'), { status: 409 })
    updates.push('email = ?')
    args.push(norm)
  }

  // Password update — requires currentPassword
  if (newPassword !== undefined) {
    if (!currentPassword) {
      throw Object.assign(new Error('Senha atual é obrigatória para alterar a senha.'), { status: 400 })
    }
    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) throw Object.assign(new Error('Senha atual incorreta.'), { status: 401 })
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw Object.assign(new Error('Nova senha deve ter pelo menos 8 caracteres.'), { status: 400 })
    }
    updates.push('password_hash = ?')
    args.push(await bcrypt.hash(newPassword, SALT_ROUNDS))
  }

  if (!updates.length) throw Object.assign(new Error('Nenhum campo para atualizar.'), { status: 400 })

  args.push(userId)
  await db.execute({
    sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    args,
  })

  return getProfile(userId)
}

// ─── List all users ───────────────────────────────────────────────────────────

async function listUsers() {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC',
    args: [],
  })
  return rows
}

// ─── Delete user ──────────────────────────────────────────────────────────────

async function deleteUser(requesterId, targetId) {
  if (Number(requesterId) === Number(targetId)) {
    throw Object.assign(new Error('Você não pode excluir sua própria conta.'), { status: 400 })
  }
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT id FROM users WHERE id = ?',
    args: [targetId],
  })
  if (!rows.length) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 })
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [targetId] })
}

// ─── Verify token ─────────────────────────────────────────────────────────────

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret())
}

module.exports = { register, login, verifyToken, getProfile, updateProfile, listUsers, deleteUser }
