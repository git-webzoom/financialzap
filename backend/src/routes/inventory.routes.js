const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const ctrl = require('../controllers/inventory.controller')

router.use(authMiddleware)

router.get('/',     ctrl.listNumbers)
router.post('/',    ctrl.createNumber)
router.patch('/:id', ctrl.updateNumber)
router.delete('/:id', ctrl.deleteNumber)

module.exports = router
