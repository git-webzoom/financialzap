const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const ctrl = require('../controllers/waba.controller')

// All WABA routes require a valid JWT
router.use(authMiddleware)

// Lookup WABAs accessible by a token (before connecting)
router.post('/lookup', ctrl.lookup)

// Connect a new WABA via token + waba_id
router.post('/connect', ctrl.connect)

// List all WABAs of the authenticated user (grouped by Business Manager)
router.get('/', ctrl.list)

// Revoke / disconnect a WABA
router.delete('/:wabaId', ctrl.revoke)

// List phone numbers of a WABA (from local DB)
router.get('/:wabaId/phone-numbers', ctrl.phoneNumbers)

// Manually re-sync phone numbers + templates for a WABA
router.post('/:wabaId/sync', ctrl.sync)

// Subscribe to Meta webhook events for a WABA (required for delivered/read/failed)
router.post('/:wabaId/subscribe-webhook', ctrl.subscribeWebhook)

module.exports = router
