// /api/auth/*
const router = require('express').Router()
const { register, login, logout, getMe, updateMe } = require('../controllers/auth.controller')
const { authMiddleware } = require('../middlewares/auth.middleware')

router.post('/register',  register)
router.post('/login',     login)
router.post('/logout',    authMiddleware, logout)
router.get('/me',         authMiddleware, getMe)
router.patch('/me',       authMiddleware, updateMe)

module.exports = router
