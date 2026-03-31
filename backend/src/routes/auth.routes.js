// /api/auth/*
const router = require('express').Router()
const { register, login, logout, getMe, updateMe, listUsers, deleteUser } = require('../controllers/auth.controller')
const { authMiddleware } = require('../middlewares/auth.middleware')

router.post('/register',      register)
router.post('/login',         login)
router.post('/logout',        authMiddleware, logout)
router.get('/me',             authMiddleware, getMe)
router.patch('/me',           authMiddleware, updateMe)
router.get('/users',          authMiddleware, listUsers)
router.delete('/users/:id',   authMiddleware, deleteUser)

module.exports = router
