const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const ctrl = require('../controllers/kanban.controller')

router.use(authMiddleware)

// Columns
router.get('/columns',       ctrl.listColumns)
router.post('/columns',      ctrl.createColumn)
router.patch('/columns/:id', ctrl.updateColumn)
router.delete('/columns/:id', ctrl.deleteColumn)

// Cards
router.get('/cards',         ctrl.listCards)
router.post('/cards',        ctrl.createCard)
router.patch('/cards/:id',   ctrl.updateCard)
router.delete('/cards/:id',  ctrl.deleteCard)

// WABAs nested under card
router.post('/cards/:cardId/wabas',              ctrl.createWaba)
router.patch('/cards/:cardId/wabas/:wabaId',     ctrl.updateWaba)
router.delete('/cards/:cardId/wabas/:wabaId',    ctrl.deleteWaba)

// Phones nested under WABA
router.post('/cards/:cardId/wabas/:wabaId/phones',              ctrl.createPhone)
router.delete('/cards/:cardId/wabas/:wabaId/phones/:phoneId',   ctrl.deletePhone)

module.exports = router
