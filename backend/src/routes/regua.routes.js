const router = require('express').Router()
const { authMiddleware } = require('../middlewares/auth.middleware')
const ctrl = require('../controllers/regua.controller')

router.use(authMiddleware)

// Grupos
router.get('/grupos',        ctrl.listarGrupos)
router.post('/grupos',       ctrl.criarGrupo)
router.delete('/grupos/:id', ctrl.excluirGrupo)

// Disparos de um grupo
router.get('/grupos/:grupoId/disparos',  ctrl.listarDisparos)
router.post('/grupos/:grupoId/disparos', ctrl.criarDisparo)

// Disparo individual (editar / excluir)
router.put('/disparos/:id',    ctrl.editarDisparo)
router.delete('/disparos/:id', ctrl.excluirDisparo)

// Resumo
router.get('/resumo', ctrl.obterResumo)

module.exports = router
