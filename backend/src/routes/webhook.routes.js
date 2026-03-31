const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/webhook.controller')

// GET  /api/webhook — Meta verification challenge
router.get('/', controller.verify)

// POST /api/webhook — incoming status notifications
router.post('/', controller.receive)

module.exports = router
