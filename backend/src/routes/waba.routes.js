const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const ctrl = require('../controllers/waba.controller')

// All WABA routes require a valid JWT
router.use(authMiddleware)

// Connect a new WABA via Embedded Signup OAuth token
router.post('/connect', ctrl.connect)

// List all WABAs of the authenticated user (grouped by Business Manager)
router.get('/', ctrl.list)

// Revoke / disconnect a WABA
router.delete('/:wabaId', ctrl.revoke)

// List phone numbers of a WABA (from local DB)
router.get('/:wabaId/phone-numbers', ctrl.phoneNumbers)

// Manually re-sync phone numbers + templates for a WABA
router.post('/:wabaId/sync', ctrl.sync)

module.exports = router
