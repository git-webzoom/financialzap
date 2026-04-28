const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
const { v4: uuidv4 } = require('uuid')

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

// ─── Mídia para Meta API ──────────────────────────────────────────────────────

const MEDIA_ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4',
  'application/pdf',
]
const MEDIA_ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.pdf']

function mediaFileFilter(_req, file, cb) {
  const ext = '.' + file.originalname.toLowerCase().split('.').pop()
  const ok  = MEDIA_ALLOWED_MIMES.includes(file.mimetype) || MEDIA_ALLOWED_EXTS.includes(ext)
  if (ok) cb(null, true)
  else cb(new Error('Formato não suportado. Aceitos: JPG, PNG, WEBP, MP4, PDF.'), false)
}

// Disk storage for media — saves to backend/uploads/ with UUID filename
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const MIME_TO_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'video/mp4': '.mp4',
  'application/pdf': '.pdf',
}

const mediaDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

const uploadMedia = multer({
  storage: mediaDiskStorage,
  fileFilter: mediaFileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB (validação fina por tipo no service)
}).single('file')

function mediaUploadMiddleware(req, res, next) {
  uploadMedia(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande. Máximo: imagem 5 MB, vídeo 16 MB, PDF 100 MB.' })
    }
    return res.status(400).json({ error: err.message || 'Erro no upload do arquivo.' })
  })
}

module.exports = { csvUploadMiddleware, mediaUploadMiddleware }
