const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const ctrl = require('../controllers/template.controller')

// All template routes require a valid JWT
router.use(authMiddleware)

// List all templates from local DB (optionally filtered by ?waba_id=)
router.get('/', ctrl.list)

// Create a new template on Meta and save locally
router.post('/', ctrl.create)

// Batch create N templates with incrementing name suffix
router.post('/batch', ctrl.batchCreate)

// Manually sync all templates for a WABA from Meta API
router.post('/sync/:wabaId', ctrl.sync)

// Delete a template from Meta and local DB
router.delete('/:wabaId/:templateId', ctrl.remove)

module.exports = router
