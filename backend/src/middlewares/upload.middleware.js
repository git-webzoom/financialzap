const multer = require('multer')

// Store CSV in memory (no disk writes) — max 10 MB
const storage = multer.memoryStorage()

function fileFilter(_req, file, cb) {
  const allowed = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain']
  const extOk = file.originalname.toLowerCase().endsWith('.csv')

  if (allowed.includes(file.mimetype) || extOk) {
    cb(null, true)
  } else {
    cb(new Error('Somente arquivos CSV são permitidos'), false)
  }
}

const uploadCSV = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('file')

// Wrap multer in a middleware that returns clean errors as JSON
function csvUploadMiddleware(req, res, next) {
  uploadCSV(req, res, (err) => {
    if (!err) return next()

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo permitido: 10 MB.' })
    }
    return res.status(400).json({ error: err.message || 'Erro no upload do arquivo.' })
  })
}

module.exports = { csvUploadMiddleware }
