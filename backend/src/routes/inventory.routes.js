const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const ctrl = require('../controllers/inventory.controller')

router.use(authMiddleware)

// Numbers
router.get('/',      ctrl.listNumbers)
router.post('/',     ctrl.createNumber)
router.patch('/:id', ctrl.updateNumber)
router.delete('/:id', ctrl.deleteNumber)

// Automations (nested under number)
router.get('/:numberId/automations',                                      ctrl.listAutomations)
router.post('/:numberId/automations',                                     ctrl.createAutomation)
router.patch('/:numberId/automations/:id',                                ctrl.updateAutomation)
router.delete('/:numberId/automations/:id',                               ctrl.deleteAutomation)

// Templates (nested under automation)
router.post('/:numberId/automations/:automationId/templates',             ctrl.createTemplate)
router.delete('/:numberId/automations/:automationId/templates/:templateId', ctrl.deleteTemplate)

// Health Logs (nested under number)
router.get('/:numberId/health-logs',         ctrl.listHealthLogs)
router.post('/:numberId/health-logs',        ctrl.createHealthLog)
router.delete('/:numberId/health-logs/:id',  ctrl.deleteHealthLog)

module.exports = router
