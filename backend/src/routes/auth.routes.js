// /api/auth/*
const router = require('express').Router()
const { register, login, logout } = require('../controllers/auth.controller')
const { authMiddleware } = require('../middlewares/auth.middleware')

router.post('/register', register)
router.post('/login',    login)
router.post('/logout',   authMiddleware, logout)  // token required to logout

module.exports = router
