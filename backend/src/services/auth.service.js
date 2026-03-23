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

// ─── Verify token ─────────────────────────────────────────────────────────────

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret())
}

module.exports = { register, login, verifyToken }
