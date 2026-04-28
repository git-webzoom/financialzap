import { useState, useEffect, useCallback, useRef } from 'react'
import * as midiaService from '../../services/midiaService'
import * as wabaService  from '../../services/wabaService'

const FILTER_LABELS = { ALL: 'Todos', IMAGE: 'Imagens', VIDEO: 'Vídeos', DOCUMENT: 'Documentos' }

const TYPE_ICONS = {
  IMAGE:    <IconImage />,
  VIDEO:    <IconVideo />,
  DOCUMENT: <IconDocument />,
}

function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Midia() {
  const [medias,           setMedias]          = useState([])
  const [loading,          setLoading]         = useState(true)
  const [error,            setError]           = useState('')
  const [filter,           setFilter]          = useState('ALL')
  const [showUpload,       setShowUpload]       = useState(false)
  const [wabas,            setWabas]           = useState([])
  const [phoneNumbers,     setPhoneNumbers]    = useState([])
  const [selectedWabaId,   setSelectedWabaId]  = useState('')
  const [selectedPhoneId,  setSelectedPhoneId] = useState('')
  const [selectedFile,     setSelectedFile]    = useState(null)
  const [dragging,         setDragging]        = useState(false)
  const [uploading,        setUploading]       = useState(false)
  const [uploadError,      setUploadError]     = useState('')
  const [deleting,         setDeleting]        = useState(null)
  const [copied,           setCopied]          = useState(null)
  const fileInputRef = useRef(null)

  const loadMedias = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { medias: data } = await midiaService.listMedia()
      setMedias(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar mídias')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMedias() }, [loadMedias])

  useEffect(() => {
    wabaService.listWabas().then(data => {
      // listWabas returns { groups: [{ business_name, wabas: [...] }] }
      const allWabas = (data.groups || []).flatMap(g => g.wabas || [])
      setWabas(allWabas)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedWabaId) { setPhoneNumbers([]); setSelectedPhoneId(''); return }
    wabaService.getPhoneNumbers(selectedWabaId)
      .then(data => {
        const phones = data.phone_numbers || data.phones || []
        setPhoneNumbers(phones)
        setSelectedPhoneId(phones[0]?.phone_number_id || '')
      })
      .catch(() => { setPhoneNumbers([]); setSelectedPhoneId('') })
  }, [selectedWabaId])

  const filtered = filter === 'ALL' ? medias : medias.filter(m => m.media_type === filter)

  function handleFileSelect(file) {
    if (!file) return
    setSelectedFile(file)
    setUploadError('')
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  async function handleUpload() {
    if (!selectedPhoneId || !selectedFile) return
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('phone_number_id', selectedPhoneId)
      await midiaService.uploadMedia(fd)
      setSelectedFile(null)
      setShowUpload(false)
      await loadMedias()
    } catch (err) {
      setUploadError(err.response?.data?.error || err.message || 'Erro ao enviar mídia')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id) {
    if (deleting) return
    setDeleting(id)
    try {
      await midiaService.deleteMedia(id)
      setMedias(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir mídia')
    } finally {
      setDeleting(null)
    }
  }

  function handleCopy(handle) {
    navigator.clipboard.writeText(handle).then(() => {
      setCopied(handle)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="mdia-page">

        {/* ── Header ── */}
        <div className="mdia-topbar">
          <div>
            <h1 className="mdia-title">Galeria de Mídia</h1>
            <p className="mdia-sub">Imagens, vídeos e documentos para uso nos templates</p>
          </div>
          <button
            className="mdia-btn mdia-btn--primary"
            onClick={() => { setShowUpload(v => !v); setUploadError('') }}
          >
            <IconPlus /> Enviar mídia
          </button>
        </div>

        {/* ── Upload Panel ── */}
        {showUpload && (
          <div className="mdia-upload-panel">
            <div className="mdia-upload-title">Enviar nova mídia</div>

            {/* WABA + Phone selectors */}
            <div className="mdia-upload-row">
              <div className="mdia-field">
                <label className="mdia-label">WABA</label>
                <select
                  className="mdia-select"
                  value={selectedWabaId}
                  onChange={e => setSelectedWabaId(e.target.value)}
                  disabled={uploading}
                >
                  <option value="">Selecione a WABA</option>
                  {wabas.map(w => (
                    <option key={w.waba_id} value={w.waba_id}>{w.name || w.waba_id}</option>
                  ))}
                </select>
              </div>
              <div className="mdia-field">
                <label className="mdia-label">Número de origem</label>
                <select
                  className="mdia-select"
                  value={selectedPhoneId}
                  onChange={e => setSelectedPhoneId(e.target.value)}
                  disabled={uploading || !selectedWabaId || phoneNumbers.length === 0}
                >
                  <option value="">Selecione o número</option>
                  {phoneNumbers.map(p => (
                    <option key={p.phone_number_id} value={p.phone_number_id}>
                      {p.display_phone_number || p.verified_name || p.phone_number_id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Drop zone */}
            <div
              className={`mdia-dropzone${dragging ? ' mdia-dropzone--active' : ''}${selectedFile ? ' mdia-dropzone--has-file' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => !selectedFile && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.mp4,.pdf"
                style={{ display: 'none' }}
                onChange={e => handleFileSelect(e.target.files[0])}
              />
              {selectedFile ? (
                <div className="mdia-file-selected">
                  <span className="mdia-file-icon">
                    {selectedFile.type.startsWith('image/') ? <IconImage /> :
                     selectedFile.type === 'video/mp4' ? <IconVideo /> : <IconDocument />}
                  </span>
                  <div className="mdia-file-info">
                    <span className="mdia-file-name">{selectedFile.name}</span>
                    <span className="mdia-file-size">{formatSize(selectedFile.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="mdia-file-clear"
                    onClick={e => { e.stopPropagation(); setSelectedFile(null) }}
                    disabled={uploading}
                  >
                    <IconClose />
                  </button>
                </div>
              ) : (
                <div className="mdia-dropzone-inner">
                  <IconUpload />
                  <span className="mdia-dropzone-text">Arraste o arquivo ou clique para selecionar</span>
                  <span className="mdia-dropzone-hint">JPG, PNG, WEBP — máx 5 MB · MP4 — máx 16 MB · PDF — máx 100 MB</span>
                </div>
              )}
            </div>

            {uploadError && <div className="mdia-upload-error">{uploadError}</div>}

            <div className="mdia-upload-actions">
              <button
                type="button"
                className="mdia-btn mdia-btn--secondary"
                onClick={() => { setShowUpload(false); setSelectedFile(null); setUploadError('') }}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mdia-btn mdia-btn--primary"
                onClick={handleUpload}
                disabled={!selectedPhoneId || !selectedFile || uploading}
              >
                {uploading ? <><span className="mdia-spinner" /> Enviando…</> : <><IconUpload /> Enviar</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Notice ── */}
        <div className="mdia-notice">
          <IconInfo />
          Handles expiram em 30 dias após o upload. Reenvie o arquivo se necessário.
        </div>

        {/* ── Filters ── */}
        <div className="mdia-filters">
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`mdia-filter-pill${filter === key ? ' mdia-filter-pill--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              {key !== 'ALL' && (
                <span className="mdia-filter-count">
                  {medias.filter(m => m.media_type === key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Error ── */}
        {error && <div className="mdia-error">{error}</div>}

        {/* ── Loading ── */}
        {loading && (
          <div className="mdia-loading">
            <span className="mdia-spinner mdia-spinner--lg" />
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && (
          <div className="mdia-empty">
            <IconGallery />
            <span>Nenhuma mídia encontrada</span>
            <span className="mdia-empty-sub">
              {filter !== 'ALL' ? 'Tente outro filtro ou envie uma mídia.' : 'Clique em "Enviar mídia" para começar.'}
            </span>
          </div>
        )}

        {/* ── Grid ── */}
        {!loading && filtered.length > 0 && (
          <div className="mdia-grid">
            {filtered.map(m => (
              <div key={m.id} className="mdia-card">
                <div className="mdia-card-icon">{TYPE_ICONS[m.media_type]}</div>
                <div className="mdia-card-body">
                  <div className="mdia-card-name" title={m.original_name}>{m.original_name}</div>
                  <div className="mdia-card-meta">
                    <span>{m.display_phone_number || m.verified_name || '—'}</span>
                    <span className="mdia-card-dot">·</span>
                    <span>{formatSize(m.file_size)}</span>
                    <span className="mdia-card-dot">·</span>
                    <span>{formatDate(m.created_at)}</span>
                  </div>
                  <div className="mdia-card-handle-row">
                    <code className="mdia-card-handle" title={m.handle_id}>
                      {m.handle_id.length > 20 ? m.handle_id.slice(0, 20) + '…' : m.handle_id}
                    </code>
                    <button
                      className={`mdia-copy-btn${copied === m.handle_id ? ' mdia-copy-btn--ok' : ''}`}
                      onClick={() => handleCopy(m.handle_id)}
                      title="Copiar handle"
                    >
                      {copied === m.handle_id ? <IconCheck /> : <IconCopy />}
                    </button>
                  </div>
                </div>
                <div className="mdia-card-type-badge mdia-card-type-badge--{m.media_type.toLowerCase()}">
                  {m.media_type}
                </div>
                <button
                  className="mdia-card-delete"
                  onClick={() => handleDelete(m.id)}
                  disabled={deleting === m.id}
                  title="Excluir mídia"
                >
                  {deleting === m.id ? <span className="mdia-spinner" /> : <IconTrash />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconImage() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="7" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 14l4-4 3 3 3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconVideo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="1.5" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M13.5 8l5-3v10l-5-3V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  )
}

function IconDocument() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M11.5 2H5a1.5 1.5 0 00-1.5 1.5v13A1.5 1.5 0 005 18h10a1.5 1.5 0 001.5-1.5V7L11.5 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M11.5 2v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 13V4M6 7l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12M5 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l1 9.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5L13 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 8.5l4 4 7-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconGallery() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="32" height="24" rx="4" stroke="currentColor" strokeWidth="2"/>
      <circle cx="14" cy="18" r="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M4 28l8-8 6 6 6-6 8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 7v5M8 5.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .mdia-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 28px 32px;
    max-width: 1100px;
  }

  /* ── Topbar ── */
  .mdia-topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .mdia-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #e8edf5;
    margin: 0 0 4px;
    letter-spacing: -0.4px;
  }
  .mdia-sub {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #4a5568;
    margin: 0;
  }

  /* ── Buttons ── */
  .mdia-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    border-radius: 8px;
    border: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
  }
  .mdia-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .mdia-btn--primary  { background: #22c55e; color: #0a0c0f; }
  .mdia-btn--primary:hover:not(:disabled)  { background: #16a34a; }
  .mdia-btn--secondary { background: #1a1f28; border: 1px solid #252c38; color: #8a94a6; }
  .mdia-btn--secondary:hover:not(:disabled) { background: #252c38; color: #e8edf5; }

  /* ── Upload panel ── */
  .mdia-upload-panel {
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 12px;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .mdia-upload-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #e8edf5;
  }
  .mdia-upload-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 600px) { .mdia-upload-row { grid-template-columns: 1fr; } }

  .mdia-field { display: flex; flex-direction: column; gap: 5px; }
  .mdia-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #8a94a6;
  }
  .mdia-select {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #e8edf5;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    padding: 9px 32px 9px 12px;
    outline: none;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%234a5568' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    transition: border-color 0.15s;
  }
  .mdia-select:focus { border-color: #22c55e60; }
  .mdia-select:disabled { opacity: 0.5; cursor: not-allowed; }
  .mdia-select option { background: #1a1f28; }

  /* ── Dropzone ── */
  .mdia-dropzone {
    border: 1.5px dashed #252c38;
    border-radius: 10px;
    padding: 28px 20px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mdia-dropzone:hover, .mdia-dropzone--active {
    border-color: #22c55e60;
    background: #22c55e08;
  }
  .mdia-dropzone--has-file { cursor: default; }
  .mdia-dropzone-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #4a5568;
  }
  .mdia-dropzone-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #8a94a6;
  }
  .mdia-dropzone-hint {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #374151;
    text-align: center;
  }

  .mdia-file-selected {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  .mdia-file-icon { color: #22c55e; flex-shrink: 0; }
  .mdia-file-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .mdia-file-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #e8edf5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mdia-file-size { font-size: 11px; color: #4a5568; font-family: 'JetBrains Mono', monospace; }
  .mdia-file-clear {
    width: 26px; height: 26px;
    background: none;
    border: 1px solid #252c38;
    border-radius: 6px;
    color: #4a5568;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
  }
  .mdia-file-clear:hover { color: #ef4444; background: #ef444410; border-color: #ef444440; }

  .mdia-upload-error {
    padding: 9px 12px;
    background: #ef444412;
    border: 1px solid #ef444430;
    border-radius: 7px;
    color: #fca5a5;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
  }
  .mdia-upload-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  /* ── Notice ── */
  .mdia-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    background: #f59e0b0a;
    border: 1px solid #f59e0b25;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #b45309;
  }

  /* ── Filters ── */
  .mdia-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mdia-filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid #252c38;
    background: #0f1215;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #4a5568;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .mdia-filter-pill:hover { color: #8a94a6; border-color: #374151; }
  .mdia-filter-pill--active {
    color: #22c55e;
    background: #22c55e10;
    border-color: #22c55e40;
  }
  .mdia-filter-count {
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    background: #1a1f28;
    padding: 1px 6px;
    border-radius: 10px;
  }
  .mdia-filter-pill--active .mdia-filter-count { background: #22c55e20; color: #86efac; }

  /* ── Error ── */
  .mdia-error {
    padding: 10px 14px;
    background: #ef444412;
    border: 1px solid #ef444430;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Loading ── */
  .mdia-loading {
    display: flex;
    justify-content: center;
    padding: 60px 0;
  }

  /* ── Empty ── */
  .mdia-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 60px 0;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
  }
  .mdia-empty-sub {
    font-size: 12px;
    font-weight: 400;
    color: #374151;
  }

  /* ── Grid ── */
  .mdia-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  }
  @media (max-width: 700px) { .mdia-grid { grid-template-columns: 1fr; } }

  /* ── Card ── */
  .mdia-card {
    position: relative;
    background: #0f1215;
    border: 1px solid #1a1f28;
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    transition: border-color 0.15s;
  }
  .mdia-card:hover { border-color: #252c38; }

  .mdia-card-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #1a1f28;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #22c55e;
    flex-shrink: 0;
  }

  .mdia-card-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .mdia-card-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #e8edf5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 48px;
  }
  .mdia-card-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #4a5568;
    flex-wrap: wrap;
  }
  .mdia-card-dot { color: #252c38; }

  .mdia-card-handle-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }
  .mdia-card-handle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #4a5568;
    background: #1a1f28;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #252c38;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
  }
  .mdia-copy-btn {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    background: none;
    border: 1px solid #252c38;
    border-radius: 5px;
    color: #4a5568;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
  }
  .mdia-copy-btn:hover { color: #e8edf5; background: #1a1f28; border-color: #374151; }
  .mdia-copy-btn--ok { color: #22c55e !important; border-color: #22c55e40 !important; background: #22c55e10 !important; }

  .mdia-card-type-badge {
    position: absolute;
    top: 12px;
    right: 44px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
    background: #1a1f28;
    color: #4a5568;
    border: 1px solid #252c38;
  }

  .mdia-card-delete {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    background: none;
    border: 1px solid #252c38;
    border-radius: 6px;
    color: #4a5568;
    cursor: pointer;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
  }
  .mdia-card-delete:hover:not(:disabled) { color: #ef4444; background: #ef444410; border-color: #ef444440; }
  .mdia-card-delete:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Spinner ── */
  .mdia-spinner {
    display: inline-block;
    width: 13px; height: 13px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: mdia-spin 0.7s linear infinite;
    opacity: 0.6;
  }
  .mdia-spinner--lg { width: 28px; height: 28px; border-width: 3px; color: #22c55e; }
  @keyframes mdia-spin { to { transform: rotate(360deg); } }

  @media (max-width: 640px) {
    .mdia-page { padding: 16px; }
  }
`
