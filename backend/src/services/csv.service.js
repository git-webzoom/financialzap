const { parse } = require('csv-parse/sync')
const XLSX      = require('xlsx')

const PREVIEW_ROWS = 5

/**
 * Parse a CSV or Excel (xlsx/xls) buffer and return column names + preview rows.
 *
 * @param {Buffer} buffer    — file buffer from Multer memoryStorage
 * @param {string} [mimetype] — optional MIME type hint
 * @param {string} [originalname] — original filename for extension detection
 * @returns {{ columns: string[], preview: object[], rows: object[], total_rows: number }}
 */
function parseCSV(buffer, mimetype, originalname) {
  const ext = (originalname || '').split('.').pop().toLowerCase()
  const isExcel = ['xlsx', 'xls', 'ods'].includes(ext)
    || (mimetype && (mimetype.includes('spreadsheet') || mimetype.includes('excel')))

  const records = isExcel
    ? parseExcel(buffer)
    : parseCsvBuffer(buffer)

  if (!records.length) {
    throw new Error('O arquivo está vazio ou não contém linhas de dados.')
  }

  const columns = Object.keys(records[0])
  if (!columns.length) {
    throw new Error('Não foi possível identificar colunas no arquivo.')
  }

  return {
    columns,
    preview:    records.slice(0, PREVIEW_ROWS),
    rows:       records,
    total_rows: records.length,
  }
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function parseCsvBuffer(buffer) {
  const content   = buffer.toString('utf-8')
  const delimiter = detectDelimiter(content)

  return parse(content, {
    delimiter,
    columns:            true,
    skip_empty_lines:   true,
    trim:               true,
    relax_column_count: true,
    bom:                true,
  })
}

function detectDelimiter(content) {
  const firstLine = content.split('\n')[0] || ''
  const counts = {
    ',':  (firstLine.match(/,/g)  || []).length,
    ';':  (firstLine.match(/;/g)  || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

// ─── Excel ────────────────────────────────────────────────────────────────────

function parseExcel(buffer) {
  const workbook  = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Nenhuma planilha encontrada no arquivo.')

  const sheet = workbook.Sheets[sheetName]

  // sheet_to_json with header:1 gives array-of-arrays; then we use row 0 as headers
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',   // empty cells → ''
    raw:    false, // convert dates/numbers to strings
  })

  // Normalize: convert all values to strings
  return rows.map(row => {
    const normalized = {}
    for (const [k, v] of Object.entries(row)) {
      normalized[String(k).trim()] = v !== null && v !== undefined ? String(v) : ''
    }
    return normalized
  })
}

module.exports = { parseCSV }
