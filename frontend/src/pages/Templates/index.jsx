import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTemplates } from '../../hooks/useTemplates'
import { useWabas } from '../../hooks/useWabas'
import TemplateForm from '../../components/Templates/TemplateForm'
import * as wabaService from '../../services/wabaService'
import * as templateService from '../../services/templateService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeSync(isoDate) {
  if (!isoDate) return null
  const diff  = Date.now() - new Date(isoDate).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'agora mesmo'
  if (mins < 60)  return `há ${mins} min`
  if (hours < 24) return `há ${hours}h`
  return `há ${days} dia${days !== 1 ? 's' : ''}`
}

function formatDatePT(isoDate) {
  if (!isoDate) return '—'
  try {
    return new Date(isoDate).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return '—'
  }
}

const CATEGORY_LABELS = {
  MARKETING:      'Marketing',
  UTILITY:        'Utilidade',
  AUTHENTICATION: 'Autenticação',
}

const STATUS_CONFIG = {
  APPROVED: { label: 'Ativo — Qualidade p…', color: '#22c55e', bg: '#22c55e18', border: '#22c55e35' },
  PENDING:  { label: 'Pendente',             color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b35' },
  REJECTED: { label: 'Rejeitado',            color: '#ef4444', bg: '#ef444418', border: '#ef444435' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status?.toUpperCase()] ?? { label: status || '—', color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' }
  return (
    <span
      className="tbl-badge"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      <span className="tbl-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

const QUALITY_CONFIG = {
  GREEN:   { label: 'Alta',     color: '#22c55e', bg: '#22c55e18', border: '#22c55e35' },
  YELLOW:  { label: 'Média',    color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b35' },
  RED:     { label: 'Baixa',    color: '#ef4444', bg: '#ef444418', border: '#ef444435' },
  UNKNOWN: { label: 'N/D',      color: '#4a5568', bg: '#4a556815', border: '#4a556830' },
}

function QualityBadge({ score }) {
  if (!score) return <span className="tbl-dash">—</span>
  const cfg = QUALITY_CONFIG[score.toUpperCase()] ?? QUALITY_CONFIG.UNKNOWN
  return (
    <span
      className="tbl-badge"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      <span className="tbl-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function SortIcon({ active, dir }) {
  return (
    <span className={`tbl-sort-icon${active ? ' tbl-sort-icon--active' : ''}`}>
      {active && dir === 'asc' ? '↑' : active && dir === 'desc' ? '↓' : '↑↓'}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const COLS = [
  { key: 'name',        label: 'Nome do modelo' },
  { key: 'category',    label: 'Categoria' },
  { key: 'language',    label: 'Idioma' },
  { key: 'status',      label: 'Status' },
  { key: 'sent_count',  label: 'Disparos' },
  { key: 'created_at',  label: 'Criado em' },
]

export default function Templates() {
  const { templates, loading, syncing, error, load, create, sync, remove, batchCreate, sendTest } = useTemplates()
  const { groups, load: loadWabas } = useWabas()

  const wabas = useMemo(() => groups.flatMap(g => g.wabas), [groups])

  const [filterWabaId,  setFilterWabaId]  = useState('')
  const [showForm,      setShowForm]      = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [formError,     setFormError]     = useState('')
  const [syncFeedback,  setSyncFeedback]  = useState({})
  const [globalSyncing, setGlobalSyncing] = useState(false)
  const [statusFilter,  setStatusFilter]  = useState('ALL')
  const [selected,      setSelected]      = useState(new Set())
  const [sortKey,       setSortKey]       = useState('created_at')
  const [sortDir,       setSortDir]       = useState('desc')
  const [detailTemplate, setDetailTemplate] = useState(null) // template aberto no modal
  const [deleting,       setDeleting]       = useState(false)
  const [deleteError,    setDeleteError]    = useState('')
  const [testTemplate,   setTestTemplate]   = useState(null)  // template being tested
  const [page,           setPage]           = useState(1)

  const PAGE_SIZE = 12

  useEffect(() => { loadWabas() }, [loadWabas])
  useEffect(() => { load(filterWabaId || null) }, [load, filterWabaId])
  // Reset selection when data changes
  useEffect(() => { setSelected(new Set()) }, [templates])
  // Reset page when filter/sort changes
  useEffect(() => { setPage(1) }, [statusFilter, filterWabaId, sortKey, sortDir])

  const lastSync = useMemo(() => {
    if (!templates.length) return null
    const dates = templates.map(t => t.last_sync_at).filter(Boolean)
    if (!dates.length) return null
    return dates.reduce((latest, d) => (d > latest ? d : latest))
  }, [templates])

  const counts = useMemo(() => {
    const c = { ALL: templates.length, APPROVED: 0, PENDING: 0, REJECTED: 0 }
    for (const t of templates) {
      const s = t.status?.toUpperCase()
      if (c[s] !== undefined) c[s]++
    }
    return c
  }, [templates])

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return templates
    return templates.filter(t => t.status?.toUpperCase() === statusFilter)
  }, [templates, statusFilter])

  const NUMERIC_COLS = new Set(['sent_count'])

  const visible = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortKey] ?? ''
      let vb = b[sortKey] ?? ''
      if (NUMERIC_COLS.has(sortKey)) {
        va = Number(va) || 0
        vb = Number(vb) || 0
        return sortDir === 'asc' ? va - vb : vb - va
      }
      va = String(va).toLowerCase()
      vb = String(vb).toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleAll() {
    const pageIds = paginated.map(t => `${t.waba_id}:${t.template_id}`)
    if (allChecked) {
      setSelected(prev => { const next = new Set(prev); pageIds.forEach(id => next.delete(id)); return next })
    } else {
      setSelected(prev => { const next = new Set(prev); pageIds.forEach(id => next.add(id)); return next })
    }
  }

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSync() {
    const targetWabas = filterWabaId ? [filterWabaId] : wabas.map(w => w.waba_id)
    if (!targetWabas.length) return
    setGlobalSyncing(true)
    setSyncFeedback({})
    for (const wid of targetWabas) {
      try {
        const r = await sync(wid)
        setSyncFeedback(prev => ({ ...prev, [wid]: `${r.templates_synced} templates` }))
      } catch (err) {
        setSyncFeedback(prev => ({ ...prev, [wid]: `erro: ${err.message}` }))
      }
    }
    await load(filterWabaId || null)
    setGlobalSyncing(false)
  }

  async function handleDelete(t) {
    if (!window.confirm(`Excluir o template "${t.name}"? Esta ação é irreversível.`)) return
    setDeleting(true)
    setDeleteError('')
    try {
      await remove(t.waba_id, t.template_id)
      setDetailTemplate(null)
      await load(filterWabaId || null)
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Erro ao excluir template')
    } finally {
      setDeleting(false)
    }
  }

  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkError,    setBulkError]    = useState('')

  async function handleBulkDelete() {
    const count = selected.size
    if (!window.confirm(`Excluir ${count} template${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}? Esta ação é irreversível.`)) return
    setBulkDeleting(true)
    setBulkError('')
    let failed = 0
    for (const rowId of selected) {
      const [wabaId, templateId] = rowId.split(':')
      try {
        await remove(wabaId, templateId)
      } catch {
        failed++
      }
    }
    setSelected(new Set())
    await load(filterWabaId || null)
    setBulkDeleting(false)
    if (failed > 0) setBulkError(`${failed} template${failed !== 1 ? 's' : ''} não puderam ser excluídos.`)
  }

  async function handleCreate(payload) {
    setSubmitting(true)
    setFormError('')
    try {
      await create(payload)
      setShowForm(false)
      await load(filterWabaId || null)
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'Erro ao criar template')
    } finally {
      setSubmitting(false)
    }
  }

  const [batchResults, setBatchResults] = useState(null)

  async function handleBatchCreate(payload) {
    setSubmitting(true)
    setFormError('')
    setBatchResults(null)
    try {
      const { results } = await batchCreate(payload)
      setBatchResults(results)
      await load(filterWabaId || null)
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'Erro ao criar templates em lote')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendTest = useCallback(async (templateId, payload) => {
    return sendTest(templateId, payload)
  }, [sendTest])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const allChecked  = paginated.length > 0 && paginated.every(t => selected.has(`${t.waba_id}:${t.template_id}`))
  const someChecked = paginated.some(t => selected.has(`${t.waba_id}:${t.template_id}`)) && !allChecked

  return (
    <>
      <style>{CSS}</style>
      <div className="page-root">

        {/* ── Page header ── */}
        <div className="tp-header">
          <div className="tp-title-wrap">
            <h1 className="tp-title">Templates</h1>
            <p className="tp-sub">
              {loading ? 'Carregando…' : `${counts.ALL} template${counts.ALL !== 1 ? 's' : ''}`}
              {lastSync && (
                <span className="tp-sync-info"> · Última sincronização: {formatRelativeSync(lastSync)}</span>
              )}
            </p>
          </div>

          <div className="tp-header-actions">
            <button
              className="tp-btn tp-btn--sync"
              onClick={handleSync}
              disabled={globalSyncing || syncing || loading}
              title="Sincronizar templates da Meta"
            >
              <span className={globalSyncing || syncing ? 'tp-spin' : ''}><IconRefresh /></span>
              {globalSyncing || syncing ? 'Sincronizando…' : 'Sincronizar'}
            </button>
            <button
              className="tp-btn tp-btn--primary"
              onClick={() => { setShowForm(true); setFormError('') }}
              disabled={showForm}
            >
              <IconPlus /> Novo template
            </button>
          </div>
        </div>

        {/* ── Banners ── */}
        {error     && <div className="tp-banner tp-banner--err">⚠ {error}</div>}
        {bulkError && <div className="tp-banner tp-banner--err">⚠ {bulkError}</div>}
        {Object.keys(syncFeedback).length > 0 && (
          <div className="tp-banner tp-banner--ok">
            {Object.entries(syncFeedback).map(([wid, msg]) => (
              <div key={wid}>
                <span className="tp-sync-waba">{wabas.find(w => w.waba_id === wid)?.name || wid}</span>
                {' — '}{msg}
              </div>
            ))}
          </div>
        )}

        {/* ── Create form ── */}
        {showForm && (
          <div className="tp-form-panel">
            <div className="tp-form-header">
              <h2 className="tp-form-title">Novo template</h2>
              <button className="tp-close-btn" onClick={() => { setShowForm(false); setBatchResults(null) }} disabled={submitting}>
                <IconClose />
              </button>
            </div>
            <TemplateForm
              wabas={wabas}
              onSubmit={handleCreate}
              onBatchSubmit={handleBatchCreate}
              onCancel={() => { setShowForm(false); setBatchResults(null) }}
              submitting={submitting}
              error={formError}
              externalBatchResults={batchResults}
            />
          </div>
        )}

        {/* ── Filters ── */}
        <div className="tp-filters">
          <select
            className="tp-select"
            value={filterWabaId}
            onChange={e => setFilterWabaId(e.target.value)}
            disabled={loading}
          >
            <option value="">Todas as WABAs</option>
            {wabas.map(w => (
              <option key={w.waba_id} value={w.waba_id}>{w.name || w.waba_id}</option>
            ))}
          </select>

          <div className="tp-status-tabs">
            {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map(s => (
              <button
                key={s}
                className={`tp-tab${statusFilter === s ? ' tp-tab--active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {STATUS_TAB_LABELS[s]}
                <span className="tp-tab-count">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="tp-loading"><span className="tp-spinner" /> Carregando templates…</div>
        ) : visible.length === 0 ? (
          <EmptyState hasFilter={statusFilter !== 'ALL' || !!filterWabaId} />
        ) : (
          <>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="tbl-th tbl-th--check">
                    <input
                      type="checkbox"
                      className="tbl-checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked }}
                      onChange={toggleAll}
                    />
                  </th>
                  {COLS.map(col => (
                    <th
                      key={col.key}
                      className="tbl-th tbl-th--sortable"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </th>
                  ))}
                  <th className="tbl-th tbl-th--actions" />
                </tr>
              </thead>
              <tbody>
                {paginated.map(t => {
                  const rowId = `${t.waba_id}:${t.template_id}`
                  const isChecked = selected.has(rowId)
                  return (
                    <tr
                      key={rowId}
                      className={`tbl-row${isChecked ? ' tbl-row--selected' : ''}`}
                      onClick={e => { if (e.target.type !== 'checkbox') setDetailTemplate(t) }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="tbl-td tbl-td--check">
                        <input
                          type="checkbox"
                          className="tbl-checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(rowId)}
                        />
                      </td>
                      <td className="tbl-td tbl-td--name">
                        <span className="tbl-name">{t.name}</span>
                        {t.structure?.find?.(c => c.type === 'BODY')?.text && (
                          <span className="tbl-preview">
                            {t.structure.find(c => c.type === 'BODY').text.slice(0, 60)}…
                          </span>
                        )}
                      </td>
                      <td className="tbl-td">{CATEGORY_LABELS[t.category] || t.category || '—'}</td>
                      <td className="tbl-td">{t.language || '—'}</td>
                      <td className="tbl-td"><StatusBadge status={t.status} /></td>
                      <td className="tbl-td tbl-td--sent">
                        {t.sent_count > 0
                          ? <span className="tbl-sent-count">{Number(t.sent_count).toLocaleString('pt-BR')}</span>
                          : <span className="tbl-dash">—</span>
                        }
                      </td>
                      <td className="tbl-td tbl-td--date">{formatDatePT(t.created_at)}</td>
                      <td className="tbl-td tbl-td--actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="tbl-action-btn"
                          title="Enviar teste"
                          onClick={() => setTestTemplate(t)}
                        >
                          <IconBeaker />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination page={safePage} total={totalPages} onChange={setPage} />
          )}
          </>
        )}

        {/* ── Template detail modal ── */}
        {detailTemplate && (
          <TemplateModal
            template={detailTemplate}
            onClose={() => { setDetailTemplate(null); setDeleteError('') }}
            onDelete={handleDelete}
            deleting={deleting}
            deleteError={deleteError}
            onPreviewUrlSaved={() => load()}
          />
        )}

        {/* ── Test send modal ── */}
        {testTemplate && (
          <TestModal
            template={testTemplate}
            wabas={wabas}
            onClose={() => setTestTemplate(null)}
            onSend={handleSendTest}
          />
        )}

        {/* ── Selection bar ── */}
        {selected.size > 0 && (
          <div className="tp-sel-bar">
            <span className="tp-sel-count">
              {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
            </span>
            <div className="tp-sel-actions">
              <button
                className="tp-sel-delete"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                title="Excluir selecionados"
              >
                {bulkDeleting ? <><span className="tp-spinner" /> Excluindo…</> : <><IconTrash /> Excluir</>}
              </button>
              <button className="tp-sel-clear" onClick={() => setSelected(new Set())} disabled={bulkDeleting}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilter }) {
  return (
    <div className="tp-empty">
      <div className="tp-empty-icon"><IconTemplate /></div>
      <p className="tp-empty-title">
        {hasFilter ? 'Nenhum template encontrado' : 'Nenhum template ainda'}
      </p>
      <p className="tp-empty-sub">
        {hasFilter
          ? 'Tente mudar os filtros ou sincronize a WABA.'
          : 'Clique em "Novo template" para criar, ou "Sincronizar" para importar da Meta.'}
      </p>
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TAB_LABELS = {
  ALL:      'Todos',
  APPROVED: 'Aprovados',
  PENDING:  'Pendentes',
  REJECTED: 'Rejeitados',
}

// ─── Template detail modal ────────────────────────────────────────────────────

function TemplateModal({ template: t, onClose, onDelete, deleting, deleteError, onPreviewUrlSaved }) {
  const structure = Array.isArray(t.structure) ? t.structure : []
  const header   = structure.find(c => c.type === 'HEADER')
  const body     = structure.find(c => c.type === 'BODY')
  const footer   = structure.find(c => c.type === 'FOOTER')
  const buttons  = structure.find(c => c.type === 'BUTTONS')

  const isMedia = header && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format)
  const existingUrl = header?.example?.header_url?.[0] || ''

  const [urlInput,    setUrlInput]    = useState(existingUrl)
  const [urlSaving,   setUrlSaving]   = useState(false)
  const [urlError,    setUrlError]    = useState('')
  const [urlSaved,    setUrlSaved]    = useState(false)

  async function handleSaveUrl() {
    if (!urlInput.trim()) return
    setUrlSaving(true)
    setUrlError('')
    setUrlSaved(false)
    try {
      await templateService.updatePreviewUrl(t.template_id, urlInput.trim())
      setUrlSaved(true)
      if (onPreviewUrlSaved) onPreviewUrlSaved()
    } catch (err) {
      setUrlError(err.response?.data?.error || err.message)
    } finally {
      setUrlSaving(false)
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="tdm-backdrop" onClick={handleBackdrop}>
      <div className="tdm-panel">

        {/* Header */}
        <div className="tdm-header">
          <div className="tdm-title-wrap">
            <span className="tdm-name">{t.name}</span>
            <div className="tdm-badges">
              <StatusBadge status={t.status} />
              {t.quality_score && <QualityBadge score={t.quality_score} />}
            </div>
          </div>
          <button className="tdm-close" onClick={onClose} title="Fechar"><IconClose /></button>
        </div>

        {/* Meta info */}
        <div className="tdm-meta">
          <MetaItem label="Categoria"  value={CATEGORY_LABELS[t.category] || t.category || '—'} />
          <MetaItem label="Idioma"     value={t.language || '—'} />
          <MetaItem label="WABA"       value={t.waba_name || t.waba_id} mono />
          <MetaItem label="ID"         value={t.template_id} mono />
          {t.rejected_reason && (
            <MetaItem label="Motivo rejeição" value={t.rejected_reason} danger />
          )}
          <MetaItem label="Sincronizado" value={formatDatePT(t.last_sync_at)} />
        </div>

        {/* URL de prévia para templates de mídia */}
        {isMedia && (
          <div className="tdm-preview-url-section">
            <label className="tdm-preview-url-label">
              URL de prévia ({header.format === 'IMAGE' ? 'imagem' : header.format === 'VIDEO' ? 'vídeo' : 'documento'})
              <span className="tdm-preview-url-hint">Apenas para visualização no painel — não altera o template na Meta</span>
            </label>
            <div className="tdm-preview-url-row">
              <input
                className="tdm-preview-url-input"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setUrlSaved(false) }}
                placeholder={header.format === 'VIDEO' ? 'https://exemplo.com/video.mp4' : 'https://exemplo.com/imagem.jpg'}
              />
              <button
                className="tp-btn tp-btn--sync"
                onClick={handleSaveUrl}
                disabled={urlSaving || !urlInput.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                {urlSaving ? 'Salvando…' : urlSaved ? '✓ Salvo' : 'Salvar URL'}
              </button>
            </div>
            {urlError && <span className="tdm-preview-url-err">⚠ {urlError}</span>}
          </div>
        )}

        {/* Preview */}
        <div className="tdm-preview-title">Prévia da mensagem</div>
        <div className="tdm-bubble-wrap">
          <div className="tdm-bubble">
            {header && (
              <div className="tdm-bubble-header">
                {header.format === 'TEXT' && <strong>{header.text}</strong>}
                {header.format === 'IMAGE' && urlInput ? (
                  <img src={urlInput} alt="preview" className="tdm-media-img" />
                ) : header.format === 'IMAGE' ? (
                  <span className="tdm-media-badge">📷 Imagem</span>
                ) : null}
                {header.format === 'VIDEO' && urlInput ? (
                  <video src={urlInput} className="tdm-media-video" controls preload="metadata" />
                ) : header.format === 'VIDEO' ? (
                  <span className="tdm-media-badge">🎬 Vídeo</span>
                ) : null}
                {header.format === 'DOCUMENT' && (
                  <span className="tdm-media-badge">📄 Documento{urlInput ? ` — ${urlInput.split('/').pop()}` : ''}</span>
                )}
              </div>
            )}
            {body && <div className="tdm-bubble-body">{body.text}</div>}
            {footer && <div className="tdm-bubble-footer">{footer.text}</div>}
            {buttons?.buttons?.length > 0 && (
              <div className="tdm-bubble-buttons">
                {buttons.buttons.map((btn, i) => (
                  <div key={i} className="tdm-bubble-btn">
                    {btn.type === 'URL'           && `🔗 ${btn.text}`}
                    {btn.type === 'PHONE_NUMBER'  && `📞 ${btn.text}`}
                    {btn.type === 'QUICK_REPLY'   && `↩ ${btn.text}`}
                    {!['URL','PHONE_NUMBER','QUICK_REPLY'].includes(btn.type) && btn.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete error */}
        {deleteError && (
          <div className="tdm-err">⚠ {deleteError}</div>
        )}

        {/* Actions */}
        <div className="tdm-actions">
          <button className="tp-btn tp-btn--sync" onClick={onClose}>Fechar</button>
          <button
            className="tp-btn tp-btn--danger"
            onClick={() => onDelete(t)}
            disabled={deleting}
          >
            {deleting ? 'Excluindo…' : <><IconTrash /> Excluir template</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function MetaItem({ label, value, mono, danger }) {
  return (
    <div className="tdm-meta-item">
      <span className="tdm-meta-label">{label}</span>
      <span className={`tdm-meta-value${mono ? ' tdm-meta-value--mono' : ''}${danger ? ' tdm-meta-value--danger' : ''}`}>
        {value}
      </span>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 8A5.5 5.5 0 0113 4.5M13.5 8A5.5 5.5 0 013 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 2.5l2 2-2 2M5 13.5l-2-2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
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

function IconTemplate() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#22c55e" strokeWidth="1.5"/>
      <path d="M3 8h18M8 8v13" stroke="#22c55e" strokeWidth="1.3"/>
    </svg>
  )
}

function IconBeaker() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 1v6L2 13a1 1 0 00.9 1.5h10.2A1 1 0 0014 13L10 7V1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 1h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="6" cy="11" r="1" fill="currentColor"/>
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14 2L1 7l5 3 2 5 6-13z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6 10l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Test send modal ──────────────────────────────────────────────────────────

function TestModal({ template: t, wabas, onClose, onSend }) {
  const structure = Array.isArray(t.structure) ? t.structure : []
  const bodyComp  = structure.find(c => c.type === 'BODY')
  const headerComp = structure.find(c => c.type === 'HEADER')
  const hasMedia   = headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)

  // Extract variable indices from body text e.g. {{1}}, {{2}}
  const varIndices = useMemo(() => {
    if (!bodyComp?.text) return []
    const matches = [...bodyComp.text.matchAll(/\{\{(\d+)\}\}/g)]
    const unique = [...new Set(matches.map(m => Number(m[1])))]
    return unique.sort((a, b) => a - b)
  }, [bodyComp])

  const [to,           setTo]           = useState('')
  const [phoneNumId,   setPhoneNumId]   = useState('')
  const [variables,    setVariables]    = useState({})
  const [mediaUrl,     setMediaUrl]     = useState('')
  const [phones,       setPhones]       = useState([])
  const [loadingPhones, setLoadingPhones] = useState(true)
  const [sending,      setSending]      = useState(false)
  const [result,       setResult]       = useState(null)   // { ok, error }

  // Load all phone numbers from all WABAs on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingPhones(true)
      const all = []
      for (const w of wabas) {
        try {
          const { phone_numbers } = await wabaService.getPhoneNumbers(w.waba_id)
          for (const p of (phone_numbers || [])) {
            all.push({ ...p, waba_id: w.waba_id, waba_name: w.name || w.waba_id })
          }
        } catch {
          // skip failed waba
        }
      }
      if (!cancelled) {
        setPhones(all)
        if (all.length > 0) setPhoneNumId(all[0].phone_number_id)
        setLoadingPhones(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [wabas])

  function handleVar(idx, value) {
    setVariables(prev => ({ ...prev, [String(idx)]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    setResult(null)
    try {
      await onSend(t.template_id, {
        phone_number_id: phoneNumId,
        to: to.replace(/\D/g, ''),
        variables,
        media_url: mediaUrl,
      })
      setResult({ ok: true })
    } catch (err) {
      setResult({ ok: false, error: err.response?.data?.error || err.message || 'Erro desconhecido' })
    } finally {
      setSending(false)
    }
  }

  const toDigits = to.replace(/\D/g, '')
  const canSend  = toDigits.length >= 10 && toDigits.length <= 15 && phoneNumId && !sending

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="tdm-backdrop" onClick={handleBackdrop}>
      <div className="tdm-panel tm-test-panel">
        {/* Header */}
        <div className="tdm-header">
          <div className="tdm-title-wrap">
            <span className="tdm-name">Enviar teste</span>
            <span className="tm-test-tname">{t.name}</span>
          </div>
          <button className="tdm-close" onClick={onClose} title="Fechar"><IconClose /></button>
        </div>

        <form className="tm-test-form" onSubmit={handleSubmit} noValidate>

          {/* Destination */}
          <div className="tf-field" style={{ marginBottom: 14 }}>
            <label className="tf-label">Número de destino</label>
            <input
              className="tf-input"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="5571999990001"
              disabled={sending}
            />
            <span className="tf-hint-inline">Formato internacional sem + (ex: 5571999990001)</span>
          </div>

          {/* Origin phone */}
          <div className="tf-field" style={{ marginBottom: 14 }}>
            <label className="tf-label">Número de origem (remetente)</label>
            {loadingPhones ? (
              <span className="tf-hint-inline">Carregando números…</span>
            ) : phones.length === 0 ? (
              <span className="tf-err">Nenhum número disponível. Sincronize uma WABA primeiro.</span>
            ) : (
              <select
                className="tf-select"
                value={phoneNumId}
                onChange={e => setPhoneNumId(e.target.value)}
                disabled={sending}
              >
                {phones.map(p => (
                  <option key={p.phone_number_id} value={p.phone_number_id}>
                    {p.display_phone_number} — {p.verified_name || p.waba_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Variables */}
          {varIndices.length > 0 && (
            <div className="tf-var-block" style={{ marginBottom: 14 }}>
              <p className="tf-var-title">Valores das variáveis</p>
              <div className="tf-var-grid">
                {varIndices.map(idx => (
                  <div key={idx} className="tf-field">
                    <label className="tf-label">Valor para {`{{${idx}}}`}</label>
                    <input
                      className="tf-input"
                      value={variables[String(idx)] || ''}
                      onChange={e => handleVar(idx, e.target.value)}
                      placeholder={`valor de {{${idx}}}`}
                      disabled={sending}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Media URL */}
          {hasMedia && (
            <div className="tf-field" style={{ marginBottom: 14 }}>
              <label className="tf-label">
                URL da mídia
                <span className="tf-hint">
                  {headerComp.format === 'IMAGE'    && 'Imagem (JPG/PNG)'}
                  {headerComp.format === 'VIDEO'    && 'Vídeo (MP4)'}
                  {headerComp.format === 'DOCUMENT' && 'Documento (PDF)'}
                </span>
              </label>
              <input
                className="tf-input"
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                placeholder={
                  headerComp.format === 'IMAGE'    ? 'https://exemplo.com/imagem.jpg' :
                  headerComp.format === 'VIDEO'    ? 'https://exemplo.com/video.mp4' :
                                                     'https://exemplo.com/documento.pdf'
                }
                disabled={sending}
              />
            </div>
          )}

          {/* Result feedback */}
          {result && (
            <div className={`tm-test-result${result.ok ? ' tm-test-result--ok' : ' tm-test-result--err'}`}>
              {result.ok
                ? '✓ Mensagem enviada com sucesso! Verifique o WhatsApp do número de destino.'
                : `✕ Erro: ${result.error}`
              }
            </div>
          )}

          {/* Actions */}
          <div className="tdm-actions" style={{ paddingTop: 16 }}>
            <button type="button" className="tp-btn tp-btn--sync" onClick={onClose} disabled={sending}>
              Cancelar
            </button>
            <button
              type="submit"
              className="tp-btn tp-btn--primary"
              disabled={!canSend}
            >
              {sending ? <><span className="tp-spinner" /> Enviando…</> : <><IconSend /> Enviar teste</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, onChange }) {
  // Show at most 7 page numbers with ellipsis
  function pages() {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (page <= 4)  return [1, 2, 3, 4, 5, '…', total]
    if (page >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
    return [1, '…', page - 1, page, page + 1, '…', total]
  }

  return (
    <div className="tp-pagination">
      <button
        className="tp-page-btn tp-page-btn--nav"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Página anterior"
      >
        <IconChevronLeft />
      </button>

      {pages().map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="tp-page-ellipsis">…</span>
        ) : (
          <button
            key={p}
            className={`tp-page-btn${p === page ? ' tp-page-btn--active' : ''}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button
        className="tp-page-btn tp-page-btn--nav"
        onClick={() => onChange(page + 1)}
        disabled={page === total}
        aria-label="Próxima página"
      >
        <IconChevronRight />
      </button>
    </div>
  )
}

function IconChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Header ── */
  .tp-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .tp-title-wrap { display: flex; flex-direction: column; gap: 4px; }
  .tp-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 22px;
    font-weight: 600;
    color: #e8edf5;
    letter-spacing: -0.3px;
  }
  .tp-sub {
    font-size: 13px;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
  }
  .tp-sync-info { color: #374151; }
  .tp-header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-shrink: 0;
  }

  /* ── Buttons ── */
  .tp-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .tp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .tp-btn--primary { background: #22c55e; color: #0a0c0f; }
  .tp-btn--primary:hover:not(:disabled) { background: #16a34a; }
  .tp-btn--sync { background: #1a1f28; border-color: #252c38; color: #8a94a6; }
  .tp-btn--sync:hover:not(:disabled) { background: #252c38; color: #e8edf5; }
  .tp-spin { display: flex; animation: tp-rotate 0.8s linear infinite; }
  @keyframes tp-rotate { to { transform: rotate(360deg); } }

  /* ── Banners ── */
  .tp-banner {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tp-banner--ok  { background: #22c55e12; border: 1px solid #22c55e30; color: #86efac; }
  .tp-banner--err { background: #ef444412; border: 1px solid #ef444430; color: #fca5a5; }
  .tp-sync-waba { font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 11px; }

  /* ── Form panel ── */
  .tp-form-panel {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 12px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .tp-form-header { display: flex; align-items: center; justify-content: space-between; }
  .tp-form-title { font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 600; color: #e8edf5; }
  .tp-close-btn {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 6px;
    color: #4a5568;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }
  .tp-close-btn:hover:not(:disabled) { color: #e8edf5; background: #252c38; }

  /* ── Filters ── */
  .tp-filters { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .tp-select {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #8a94a6;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    padding: 7px 32px 7px 12px;
    cursor: pointer;
    outline: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%234a5568' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    transition: border-color 0.15s;
  }
  .tp-select:focus { border-color: #374151; }
  .tp-select option { background: #1a1f28; }
  .tp-status-tabs {
    display: flex;
    gap: 4px;
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 9px;
    padding: 3px;
  }
  .tp-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .tp-tab:hover:not(.tp-tab--active) { color: #8a94a6; }
  .tp-tab--active { background: #252c38; color: #e8edf5; }
  .tp-tab-count {
    background: #1a1f28;
    color: #4a5568;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 100px;
    font-family: 'JetBrains Mono', monospace;
  }
  .tp-tab--active .tp-tab-count { background: #374151; color: #8a94a6; }

  /* ── Loading / empty ── */
  .tp-loading {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 40px 0;
    color: #4a5568;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
  }
  .tp-spinner {
    width: 18px; height: 18px;
    border: 2px solid #252c38;
    border-top-color: #22c55e;
    border-radius: 50%;
    animation: tp-rotate 0.8s linear infinite;
  }
  .tp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 64px 24px;
    text-align: center;
  }
  .tp-empty-icon {
    width: 72px; height: 72px;
    display: flex; align-items: center; justify-content: center;
    background: #22c55e0a;
    border: 1px solid #22c55e20;
    border-radius: 50%;
  }
  .tp-empty-title { font-family: 'DM Sans', sans-serif; font-size: 17px; font-weight: 600; color: #8a94a6; }
  .tp-empty-sub { font-size: 13px; color: #4a5568; font-family: 'DM Sans', sans-serif; max-width: 380px; line-height: 1.6; }

  /* ── Table ── */
  .tbl-wrap {
    width: 100%;
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid #1a1f28;
  }
  .tbl-wrap::-webkit-scrollbar { height: 4px; }
  .tbl-wrap::-webkit-scrollbar-track { background: transparent; }
  .tbl-wrap::-webkit-scrollbar-thumb { background: #252c38; border-radius: 2px; }

  .tbl {
    width: 100%;
    border-collapse: collapse;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    min-width: 760px;
  }

  .tbl-th {
    padding: 10px 14px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #4a5568;
    background: #0f1215;
    border-bottom: 1px solid #1a1f28;
    white-space: nowrap;
    user-select: none;
  }
  .tbl-th--check { width: 40px; padding: 10px 12px; }
  .tbl-th--sortable { cursor: pointer; }
  .tbl-th--sortable:hover { color: #8a94a6; }

  .tbl-sort-icon {
    margin-left: 5px;
    font-size: 10px;
    color: #2d3748;
    font-style: normal;
  }
  .tbl-sort-icon--active { color: #22c55e; }

  .tbl-row {
    border-bottom: 1px solid #111519;
    transition: background 0.1s;
  }
  .tbl-row:last-child { border-bottom: none; }
  .tbl-row:hover { background: #131720; }
  .tbl-row--selected { background: #22c55e08; }
  .tbl-row--selected:hover { background: #22c55e10; }

  .tbl-td {
    padding: 12px 14px;
    color: #8a94a6;
    vertical-align: middle;
    background: #0c0f13;
  }
  .tbl-td--check { width: 40px; padding: 12px 12px; background: #0c0f13; }
  .tbl-td--date { white-space: nowrap; font-size: 12px; color: #4a5568; }
  .tbl-td--sent { white-space: nowrap; }
  .tbl-sent-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #e8edf5;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 5px;
    padding: 2px 8px;
  }
  .tbl-dash { color: #2d3748; }

  .tbl-name {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #e8edf5;
    font-weight: 500;
  }
  .tbl-preview {
    display: block;
    font-size: 11px;
    color: #374151;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 240px;
  }

  .tbl-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 100px;
    border: 1px solid;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }
  .tbl-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tbl-checkbox {
    width: 14px;
    height: 14px;
    accent-color: #22c55e;
    cursor: pointer;
  }

  /* ── Selection bar ── */
  .tp-sel-bar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
    background: #1a1f28;
    border: 1px solid #374151;
    border-radius: 10px;
    padding: 10px 16px;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    color: #e8edf5;
    box-shadow: 0 8px 24px #00000060;
    z-index: 100;
    white-space: nowrap;
  }
  .tp-sel-count { color: #8a94a6; font-size: 13px; }
  .tp-sel-actions { display: flex; align-items: center; gap: 8px; }
  .tp-sel-delete {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #ef444415;
    border: 1px solid #ef444440;
    border-radius: 7px;
    color: #ef4444;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    min-height: 32px;
  }
  .tp-sel-delete:hover:not(:disabled) { background: #ef444425; }
  .tp-sel-delete:disabled { opacity: 0.5; cursor: not-allowed; }
  .tp-sel-clear {
    background: none;
    border: none;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    cursor: pointer;
    padding: 4px;
    transition: color 0.15s;
  }
  .tp-sel-clear:hover:not(:disabled) { color: #8a94a6; }
  .tp-sel-clear:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Pagination ── */
  .tp-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 0 4px;
  }
  .tp-page-btn {
    min-width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 7px;
    color: #4a5568;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .tp-page-btn:hover:not(:disabled):not(.tp-page-btn--active) {
    color: #8a94a6;
    border-color: #374151;
    background: #252c38;
  }
  .tp-page-btn--active {
    background: #22c55e18;
    border-color: #22c55e40;
    color: #22c55e;
    font-weight: 600;
  }
  .tp-page-btn--nav { color: #4a5568; }
  .tp-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .tp-page-ellipsis {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #2d3748;
    padding: 0 4px;
  }

  /* ── Danger button ── */
  .tp-btn--danger {
    background: #ef444415;
    border: 1px solid #ef444440;
    color: #ef4444;
  }
  .tp-btn--danger:hover:not(:disabled) { background: #ef444425; }
  .tp-btn--danger:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Template detail modal ── */
  .tdm-backdrop {
    position: fixed;
    inset: 0;
    background: #00000080;
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 24px;
  }

  .tdm-panel {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 14px;
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 24px;
  }
  .tdm-panel::-webkit-scrollbar { width: 4px; }
  .tdm-panel::-webkit-scrollbar-thumb { background: #252c38; border-radius: 2px; }

  .tdm-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .tdm-title-wrap { display: flex; flex-direction: column; gap: 8px; }
  .tdm-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
    font-weight: 600;
    color: #e8edf5;
    word-break: break-all;
  }
  .tdm-badges { display: flex; gap: 6px; flex-wrap: wrap; }
  .tdm-close {
    width: 28px; height: 28px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: #1a1f28; border: 1px solid #252c38; border-radius: 6px;
    color: #4a5568; cursor: pointer; transition: color 0.15s, background 0.15s;
  }
  .tdm-close:hover { color: #e8edf5; background: #252c38; }

  .tdm-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    padding: 14px 16px;
    background: #0f1215;
    border: 1px solid #1a1f28;
    border-radius: 8px;
  }
  .tdm-meta-item { display: flex; flex-direction: column; gap: 2px; }
  .tdm-meta-label { font-size: 10px; color: #4a5568; font-family: 'DM Sans', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; }
  .tdm-meta-value { font-size: 13px; color: #8a94a6; font-family: 'DM Sans', sans-serif; }
  .tdm-meta-value--mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #4a5568; }
  .tdm-meta-value--danger { color: #ef4444; font-size: 11px; }

  .tdm-preview-title {
    font-size: 11px;
    font-family: 'DM Sans', sans-serif;
    color: #4a5568;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tdm-bubble-wrap {
    display: flex;
    justify-content: flex-end;
    padding: 12px;
    background: #1a4731;
    border-radius: 10px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' opacity='0.06'%3E%3Ccircle cx='20' cy='20' r='10' fill='%2322c55e'/%3E%3C/svg%3E");
  }

  .tdm-bubble {
    background: #dcf8c6;
    border-radius: 10px 2px 10px 10px;
    padding: 10px 14px;
    max-width: 90%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: 0 1px 3px #00000030;
  }

  .tdm-bubble-header {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    font-family: 'DM Sans', sans-serif;
  }
  .tdm-media-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: #b7e0a0;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #166534;
  }
  .tdm-media-img {
    width: 100%;
    max-height: 200px;
    object-fit: cover;
    border-radius: 6px;
    display: block;
  }
  .tdm-media-video {
    width: 100%;
    max-height: 200px;
    border-radius: 6px;
    display: block;
    background: #000;
  }

  .tdm-preview-url-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tdm-preview-url-label {
    font-size: 11px;
    font-family: 'DM Sans', sans-serif;
    color: #8a94a6;
    font-weight: 600;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tdm-preview-url-hint {
    font-weight: 400;
    color: #4a5568;
    font-size: 10px;
  }
  .tdm-preview-url-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .tdm-preview-url-input {
    flex: 1;
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 7px;
    padding: 7px 10px;
    font-size: 12px;
    font-family: 'DM Sans', sans-serif;
    color: #e8edf5;
    outline: none;
  }
  .tdm-preview-url-input:focus { border-color: #3b82f6; }
  .tdm-preview-url-err {
    font-size: 11px;
    color: #f87171;
    font-family: 'DM Sans', sans-serif;
  }
  .tdm-bubble-body {
    font-size: 13px;
    color: #1f2937;
    font-family: 'DM Sans', sans-serif;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .tdm-bubble-footer {
    font-size: 11px;
    color: #6b7280;
    font-family: 'DM Sans', sans-serif;
  }
  .tdm-bubble-buttons {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid #a7d99030;
  }
  .tdm-bubble-btn {
    font-size: 12px;
    color: #0ea5e9;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    text-align: center;
    padding: 4px 0;
  }

  .tdm-err {
    padding: 8px 12px;
    background: #ef444415;
    border: 1px solid #ef444430;
    border-radius: 7px;
    font-size: 12px;
    color: #fca5a5;
    font-family: 'DM Sans', sans-serif;
  }

  .tdm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  /* ── Table action button (test) ── */
  .tbl-th--actions { width: 44px; padding: 0; }
  .tbl-td--actions { width: 44px; padding: 4px 8px; text-align: center; }
  .tbl-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: none;
    border: 1px solid #252c38;
    border-radius: 6px;
    color: #4a5568;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .tbl-action-btn:hover { color: #22c55e; border-color: #22c55e40; background: #22c55e10; }

  /* ── Shared form primitives (used by TestModal) ── */
  .tf-field { display: flex; flex-direction: column; gap: 5px; }
  .tf-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #8a94a6;
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }
  .tf-hint { font-weight: 400; color: #374151; font-size: 11px; }
  .tf-hint-inline { font-size: 11px; color: #374151; font-family: 'DM Sans', sans-serif; }
  .tf-err { font-size: 11px; color: #fca5a5; font-family: 'DM Sans', sans-serif; }
  .tf-input,
  .tf-select {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #e8edf5;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    padding: 9px 12px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }
  .tf-input:focus, .tf-select:focus { border-color: #22c55e60; }
  .tf-input:disabled, .tf-select:disabled { opacity: 0.5; cursor: not-allowed; }
  .tf-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%234a5568' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }
  .tf-select option { background: #1a1f28; }
  .tf-var-block {
    background: #22c55e08;
    border: 1px solid #22c55e20;
    border-radius: 9px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tf-var-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #86efac;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
  }
  .tf-var-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 10px;
  }

  /* ── Test modal specifics ── */
  .tm-test-panel { max-width: 540px; }
  .tm-test-tname {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #4a5568;
    margin-left: 8px;
  }
  .tm-test-form { padding: 20px 24px 8px; }
  .tm-test-result {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    margin-bottom: 4px;
    line-height: 1.5;
  }
  .tm-test-result--ok  { background: #22c55e12; border: 1px solid #22c55e30; color: #86efac; }
  .tm-test-result--err { background: #ef444412; border: 1px solid #ef444430; color: #fca5a5; }

  /* ── Mobile responsiveness ── */
  @media (max-width: 640px) {
    /* Header stacks */
    .tp-header {
      flex-direction: column;
      gap: 12px;
    }
    .tp-header-actions {
      width: 100%;
      justify-content: stretch;
    }
    .tp-header-actions .tp-btn {
      flex: 1;
      justify-content: center;
      min-height: 42px;
    }

    /* Filters stack */
    .tp-filters {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    .tp-select { width: 100%; }
    .tp-status-tabs {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }
    .tp-status-tabs::-webkit-scrollbar { display: none; }

    /* Form panel full-width */
    .tp-form-panel {
      padding: 16px;
      border-radius: 10px;
    }

    /* Modal full-screen on mobile */
    .tdm-backdrop {
      padding: 0;
      align-items: flex-end;
    }
    .tdm-panel {
      max-width: 100%;
      border-radius: 16px 16px 0 0;
      max-height: 92vh;
      padding: 20px 16px;
      gap: 16px;
    }
    .tm-test-panel {
      max-width: 100%;
    }
    .tm-test-form { padding: 12px 0 4px; }

    /* Meta grid single column */
    .tdm-meta {
      grid-template-columns: 1fr;
    }

    /* Actions stack */
    .tdm-actions {
      flex-wrap: wrap;
    }
    .tdm-actions .tp-btn {
      flex: 1;
      justify-content: center;
      min-height: 42px;
    }

    /* Action button in table larger touch target */
    .tbl-action-btn {
      width: 36px;
      height: 36px;
    }
    .tbl-td--actions { padding: 4px 6px; }

    /* Selection bar full-width */
    .tp-sel-bar {
      bottom: 12px;
      left: 12px;
      right: 12px;
      transform: none;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }

    /* Tab count hidden on very small */
    .tp-tab-count { display: none; }
  }

  @media (max-width: 480px) {
    .tp-title { font-size: 19px; }
    .tdm-name { font-size: 13px; }
    .tf-var-grid { grid-template-columns: 1fr; }
  }
`
