const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const ctrl = require('../controllers/regua.controller')

router.use(authMiddleware)

// Grupos
router.get('/grupos',        ctrl.listarGrupos)
router.post('/grupos',       ctrl.criarGrupo)
router.delete('/grupos/:id', ctrl.excluirGrupo)

// Registros
router.get('/registros',        ctrl.listarRegistros)
router.post('/registros',       ctrl.criarRegistro)
router.put('/registros/:id',    ctrl.editarRegistro)
router.delete('/registros/:id', ctrl.excluirRegistro)

// Resumo
router.get('/resumo', ctrl.obterResumo)

module.exports = router
