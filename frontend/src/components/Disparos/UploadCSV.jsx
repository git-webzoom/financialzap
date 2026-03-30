import { useRef, useState } from 'react'

/**
 * Etapa 1 — Upload CSV
 * Props:
 *   onFile(file)          called when user picks a file (before upload)
 *   uploading             bool
 *   uploadError           string
 *   columns               string[]
 *   preview               object[]
 *   totalRows             number
 *   phoneColumn           string     currently selected phone column
 *   onPhoneColumn(col)    called when user picks the phone column
 */
export default function UploadCSV({ onFile, uploading, uploadError, columns, preview, totalRows, phoneColumn, onPhoneColumn }) {
  const inputRef  = useRef(null)
  const [dragging, setDragging] = useState(false)

  const hasResult = columns.length > 0

  function handleFiles(files) {
    const file = files[0]
    if (!file) return
    onFile(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleDragOver(e) { e.preventDefault(); setDragging(true)  }
  function handleDragLeave()  { setDragging(false) }

  return (
    <>
      <style>{CSS}</style>

      {/* Drop zone */}
      {!hasResult && (
        <div
          className={`ucsv-zone${dragging ? ' ucsv-zone--drag' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="ucsv-uploading">
              <span className="ucsv-spinner" />
              <span>Processando arquivo…</span>
            </div>
          ) : (
            <>
              <div className="ucsv-icon"><IconCSV /></div>
              <p className="ucsv-label">Arraste o CSV aqui ou <span className="ucsv-link">clique para selecionar</span></p>
              <p className="ucsv-hint">Apenas arquivos .csv · Máximo 10 MB</p>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div className="ucsv-error">⚠ {uploadError}</div>
      )}

      {/* Result */}
      {hasResult && (
        <div className="ucsv-result">
          <div className="ucsv-result-header">
            <div className="ucsv-result-info">
              <span className="ucsv-result-icon"><IconCSV /></span>
              <div>
                <p className="ucsv-result-title">{totalRows.toLocaleString('pt-BR')} contatos identificados</p>
                <p className="ucsv-result-sub">{columns.length} coluna{columns.length !== 1 ? 's' : ''}: {columns.join(', ')}</p>
              </div>
            </div>
            <button
              className="ucsv-change-btn"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              Trocar arquivo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => handleFiles(e.target.files)}
            />
          </div>

          {/* Column badges */}
          <div className="ucsv-cols">
            {columns.map(col => (
              <span key={col} className="ucsv-col-badge">{col}</span>
            ))}
          </div>

          {/* Phone column selector */}
          <div className="ucsv-phone-wrap">
            <div className="ucsv-phone-row">
              <span className="ucsv-phone-icon">📞</span>
              <div className="ucsv-phone-info">
                <p className="ucsv-phone-title">Qual coluna contém o telefone?</p>
                <p className="ucsv-phone-hint">
                  O número deve estar no formato internacional sem <code>+</code> — ex: <code>5511999990001</code>
                </p>
              </div>
              <select
                className="ucsv-phone-select"
                value={phoneColumn || ''}
                onChange={e => onPhoneColumn?.(e.target.value)}
              >
                <option value="">— selecione —</option>
                {columns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            {phoneColumn && (
              <div className="ucsv-phone-preview">
                <span className="ucsv-phone-preview-label">Prévia:</span>
                {preview.slice(0, 3).map((row, i) => (
                  <span key={i} className="ucsv-phone-sample">{row[phoneColumn] ?? '—'}</span>
                ))}
              </div>
            )}
          </div>

          {/* Preview table */}
          <div className="ucsv-preview-wrap">
            <p className="ucsv-preview-label">Prévia — primeiras {preview.length} linhas</p>
            <div className="ucsv-table-scroll">
              <table className="ucsv-table">
                <thead>
                  <tr>
                    {columns.map(col => <th key={col} className="ucsv-th">{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="ucsv-tr">
                      {columns.map(col => (
                        <td key={col} className="ucsv-td">{row[col] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function IconCSV() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="13" height="17" rx="2" stroke="#22c55e" strokeWidth="1.5"/>
      <path d="M16 2l5 5v13a2 2 0 01-2 2H7" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 2v5h5" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 12h8M7 15h5" stroke="#22c55e" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

const CSS = `
  .ucsv-zone {
    border: 2px dashed #252c38;
    border-radius: 14px;
    padding: 48px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    background: #0c0f13;
    text-align: center;
  }
  .ucsv-zone:hover, .ucsv-zone--drag {
    border-color: #22c55e60;
    background: #22c55e06;
  }
  .ucsv-icon { color: #22c55e; opacity: 0.7; }
  .ucsv-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    color: #8a94a6;
  }
  .ucsv-link { color: #22c55e; font-weight: 600; }
  .ucsv-hint { font-size: 12px; color: #374151; font-family: 'DM Sans', sans-serif; }
  .ucsv-uploading {
    display: flex; align-items: center; gap: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; color: #8a94a6;
  }
  .ucsv-spinner {
    width: 18px; height: 18px;
    border: 2px solid #252c38; border-top-color: #22c55e;
    border-radius: 50%;
    animation: ucsv-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes ucsv-spin { to { transform: rotate(360deg); } }

  .ucsv-error {
    padding: 10px 14px;
    background: #ef444412; border: 1px solid #ef444430;
    border-radius: 8px; font-size: 13px; color: #fca5a5;
    font-family: 'DM Sans', sans-serif;
  }

  .ucsv-result {
    background: #0f1215;
    border: 1px solid #1a1f28;
    border-radius: 12px;
    display: flex; flex-direction: column; gap: 16px;
    overflow: hidden;
  }
  .ucsv-result-header {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 20px;
    border-bottom: 1px solid #1a1f28;
    flex-wrap: wrap;
  }
  .ucsv-result-info { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
  .ucsv-result-icon { color: #22c55e; flex-shrink: 0; }
  .ucsv-result-title {
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    font-weight: 600; color: #e8edf5;
  }
  .ucsv-result-sub {
    font-size: 12px; color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ucsv-change-btn {
    padding: 6px 14px; background: #1a1f28;
    border: 1px solid #252c38; border-radius: 7px;
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    color: #8a94a6; cursor: pointer; white-space: nowrap;
    transition: color 0.15s, background 0.15s; flex-shrink: 0;
  }
  .ucsv-change-btn:hover:not(:disabled) { background: #252c38; color: #e8edf5; }
  .ucsv-change-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .ucsv-cols {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding: 0 20px;
  }
  .ucsv-col-badge {
    padding: 3px 10px;
    background: #22c55e10; border: 1px solid #22c55e25;
    border-radius: 100px; font-size: 11px;
    font-family: 'JetBrains Mono', monospace; color: #86efac;
  }

  .ucsv-preview-wrap { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 8px; }
  .ucsv-preview-label {
    font-size: 11px; color: #4a5568; text-transform: uppercase;
    letter-spacing: 0.5px; font-family: 'DM Sans', sans-serif;
  }
  .ucsv-table-scroll {
    overflow-x: auto; border-radius: 8px;
    border: 1px solid #1a1f28;
    -webkit-overflow-scrolling: touch;
  }
  .ucsv-table { width: 100%; border-collapse: collapse; min-width: 400px; }
  .ucsv-th {
    padding: 8px 12px; text-align: left;
    font-size: 11px; font-weight: 600; color: #4a5568;
    background: #0c0f13; border-bottom: 1px solid #1a1f28;
    white-space: nowrap; font-family: 'DM Sans', sans-serif;
  }
  .ucsv-td {
    padding: 8px 12px; font-size: 12px; color: #8a94a6;
    background: #0f1215; border-bottom: 1px solid #111519;
    font-family: 'JetBrains Mono', monospace; white-space: nowrap;
  }
  .ucsv-tr:last-child .ucsv-td { border-bottom: none; }

  /* ── Phone column selector ── */
  .ucsv-phone-wrap {
    margin: 0 20px;
    background: #22c55e08;
    border: 1px solid #22c55e25;
    border-radius: 10px;
    padding: 14px 16px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .ucsv-phone-row {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  .ucsv-phone-icon { font-size: 18px; flex-shrink: 0; }
  .ucsv-phone-info { flex: 1; min-width: 0; }
  .ucsv-phone-title {
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    font-weight: 600; color: #86efac; margin: 0;
  }
  .ucsv-phone-hint {
    font-size: 11px; color: #4a7c59;
    font-family: 'DM Sans', sans-serif; margin: 2px 0 0;
  }
  .ucsv-phone-hint code {
    font-family: 'JetBrains Mono', monospace;
    background: #22c55e15; border-radius: 3px; padding: 1px 4px;
    color: #86efac;
  }
  .ucsv-phone-select {
    background: #1a1f28; border: 1px solid #22c55e35;
    border-radius: 8px; color: #e8edf5;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    padding: 7px 30px 7px 12px; outline: none;
    appearance: none; cursor: pointer; flex-shrink: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%234a5568' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    transition: border-color 0.15s; min-width: 160px;
  }
  .ucsv-phone-select:focus { border-color: #22c55e60; }
  .ucsv-phone-select option { background: #1a1f28; }
  .ucsv-phone-preview {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  .ucsv-phone-preview-label {
    font-size: 11px; color: #4a5568; font-family: 'DM Sans', sans-serif;
  }
  .ucsv-phone-sample {
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: #22c55e; background: #22c55e10;
    border: 1px solid #22c55e25; border-radius: 5px; padding: 2px 8px;
  }

  @media (max-width: 640px) {
    .ucsv-zone { padding: 32px 16px; }
    .ucsv-result-header { flex-direction: column; align-items: flex-start; }
    .ucsv-change-btn { width: 100%; text-align: center; justify-content: center; }
    .ucsv-phone-select { width: 100%; }
    .ucsv-phone-wrap { margin: 0 14px; }
  }
`
