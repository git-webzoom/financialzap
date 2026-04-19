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
router.get('/:numberId/automations',         ctrl.listAutomations)
router.post('/:numberId/automations',        ctrl.createAutomation)
router.patch('/:numberId/automations/:id',   ctrl.updateAutomation)
router.delete('/:numberId/automations/:id',  ctrl.deleteAutomation)

module.exports = router
