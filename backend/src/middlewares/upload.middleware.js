const multer = require('multer')

// Store CSV in memory (no disk writes) — max 10 MB
const storage = multer.memoryStorage()

const ALLOWED_MIMES = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.oasis.opendocument.spreadsheet',                    // ods
]

const ALLOWED_EXTS = ['.csv', '.xlsx', '.xls', '.ods']

function fileFilter(_req, file, cb) {
  const ext = '.' + file.originalname.toLowerCase().split('.').pop()
  const ok  = ALLOWED_MIMES.includes(file.mimetype) || ALLOWED_EXTS.includes(ext)
  if (ok) {
    cb(null, true)
  } else {
    cb(new Error('Formato não suportado. Envie um arquivo CSV ou planilha Excel (.xlsx, .xls).'), false)
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
