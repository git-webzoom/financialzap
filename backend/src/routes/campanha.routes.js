const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const { csvUploadMiddleware } = require('../middlewares/upload.middleware')
const ctrl = require('../controllers/campanha.controller')

// POST /api/campanhas/upload-csv
router.post('/upload-csv', authMiddleware, csvUploadMiddleware, ctrl.uploadCSV)

module.exports = router
