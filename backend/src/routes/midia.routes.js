const router = require('express').Router()
const { authMiddleware }        = require('../middlewares/auth.middleware')
const { mediaUploadMiddleware } = require('../middlewares/upload.middleware')
const ctrl = require('../controllers/midia.controller')

router.use(authMiddleware)

router.post('/upload', mediaUploadMiddleware, ctrl.upload)
router.get('/',        ctrl.list)
router.delete('/:id',  ctrl.remove)

module.exports = router
