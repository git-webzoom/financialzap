const { parse } = require('csv-parse/sync')

const PREVIEW_ROWS = 5

/**
 * Parse a CSV buffer and return column names + preview rows.
 *
 * @param {Buffer} buffer  — file buffer from Multer memoryStorage
 * @returns {{ columns: string[], preview: object[], total_rows: number }}
 */
function parseCSV(buffer) {
  const content = buffer.toString('utf-8')

  // Try to detect delimiter (comma, semicolon or tab)
  const delimiter = detectDelimiter(content)

  const records = parse(content, {
    delimiter,
    columns: true,          // first row becomes column names
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,              // strip BOM if present (Excel exports)
  })

  if (!records.length) {
    throw new Error('O arquivo CSV está vazio ou não contém linhas de dados.')
  }

  // Column names come from the first record's keys
  const columns = Object.keys(records[0])

  if (!columns.length) {
    throw new Error('Não foi possível identificar colunas no arquivo CSV.')
  }

  const preview = records.slice(0, PREVIEW_ROWS)

  return {
    columns,
    preview,
    rows: records,          // full parsed rows — sent back to frontend for submit payload
    total_rows: records.length,
  }
}

/**
 * Detect the most likely delimiter by counting occurrences in the first line.
 */
function detectDelimiter(content) {
  const firstLine = content.split('\n')[0] || ''
  const counts = {
    ',': (firstLine.match(/,/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

module.exports = { parseCSV }
