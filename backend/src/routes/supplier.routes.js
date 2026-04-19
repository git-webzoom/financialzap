const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const ctrl = require('../controllers/supplier.controller')

router.use(authMiddleware)

router.get('/',    ctrl.list)
router.get('/:id', ctrl.get)
router.post('/',   ctrl.create)
router.patch('/:id', ctrl.update)
router.delete('/:id', ctrl.remove)

router.post('/:id/logs',          ctrl.createLog)
router.delete('/:id/logs/:logId', ctrl.deleteLog)

module.exports = router
