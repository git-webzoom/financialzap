const { verifyToken } = require('../services/auth.service')

// Extracts and verifies the Bearer JWT from the Authorization header.
// On success, sets req.user = { sub, email, iat, exp } and calls next().
// On failure, responds with 401 — never calls next() with an error so that
// downstream route handlers can always trust req.user is populated.
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' })
  }

  const token = authHeader.slice(7) // remove "Bearer "

  try {
    req.user = verifyToken(token)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { authMiddleware }
