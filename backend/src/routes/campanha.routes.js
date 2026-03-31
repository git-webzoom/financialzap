const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const { csvUploadMiddleware } = require('../middlewares/upload.middleware')
const ctrl = require('../controllers/campanha.controller')

// CSV upload (must come before POST /)
router.post('/upload-csv', authMiddleware, csvUploadMiddleware, ctrl.uploadCSV)

// Campaign CRUD + status + contacts + cancel + delete
router.post('/',                authMiddleware, ctrl.createCampanhaHandler)
router.get('/',                 authMiddleware, ctrl.listCampanhasHandler)
router.get('/:id/status',       authMiddleware, ctrl.getCampanhaStatusHandler)
router.get('/:id/contacts',     authMiddleware, ctrl.getCampanhaContactsHandler)
router.patch('/:id/cancel',     authMiddleware, ctrl.cancelCampanhaHandler)
router.delete('/:id',           authMiddleware, ctrl.deleteCampanhaHandler)

module.exports = router
