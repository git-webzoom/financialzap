import { useEffect, useState, useMemo } from 'react'
import { useTemplates } from '../../hooks/useTemplates'
import { useWabas } from '../../hooks/useWabas'
import TemplateForm from '../../components/Templates/TemplateForm'

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

function SortIcon({ active, dir }) {
  return (
    <span className={`tbl-sort-icon${active ? ' tbl-sort-icon--active' : ''}`}>
      {active && dir === 'asc' ? '↑' : active && dir === 'desc' ? '↓' : '↑↓'}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const COLS = [
  { key: 'name',             label: 'Nome do modelo' },
  { key: 'category',         label: 'Categoria' },
  { key: 'language',         label: 'Idioma' },
  { key: 'status',           label: 'Status' },
  { key: 'delivered_count',  label: 'Mensagens entregues' },
  { key: 'read_rate',        label: 'Taxa de leitura' },
  { key: 'last_edited_time', label: 'Última edição' },
]

export default function Templates() {
  const { templates, loading, syncing, error, load, create, sync } = useTemplates()
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
  const [sortKey,       setSortKey]       = useState('last_edited_time')
  const [sortDir,       setSortDir]       = useState('desc')

  useEffect(() => { loadWabas() }, [loadWabas])
  useEffect(() => { load(filterWabaId || null) }, [load, filterWabaId])
  // Reset selection when data changes
  useEffect(() => { setSelected(new Set()) }, [templates])

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

  const visible = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortKey] ?? ''
      let vb = b[sortKey] ?? ''
      // numeric sort for counts
      if (sortKey === 'delivered_count' || sortKey === 'read_rate') {
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
    if (selected.size === visible.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visible.map(t => `${t.waba_id}:${t.template_id}`)))
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

  const allChecked = visible.length > 0 && selected.size === visible.length
  const someChecked = selected.size > 0 && selected.size < visible.length

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
        {error && <div className="tp-banner tp-banner--err">⚠ {error}</div>}
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
              <button className="tp-close-btn" onClick={() => setShowForm(false)} disabled={submitting}>
                <IconClose />
              </button>
            </div>
            <TemplateForm
              wabas={wabas}
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              submitting={submitting}
              error={formError}
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
                </tr>
              </thead>
              <tbody>
                {visible.map(t => {
                  const rowId = `${t.waba_id}:${t.template_id}`
                  const isChecked = selected.has(rowId)
                  const readRate = (t.delivered_count && t.read_count)
                    ? `${Math.round((t.read_count / t.delivered_count) * 100)}% (${t.read_count})`
                    : t.read_count
                      ? `— (${t.read_count})`
                      : '—'

                  return (
                    <tr key={rowId} className={`tbl-row${isChecked ? ' tbl-row--selected' : ''}`}>
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
                      <td className="tbl-td tbl-td--num">{t.delivered_count ?? '—'}</td>
                      <td className="tbl-td tbl-td--num">{readRate}</td>
                      <td className="tbl-td tbl-td--date">{formatDatePT(t.last_edited_time)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Selection bar ── */}
        {selected.size > 0 && (
          <div className="tp-sel-bar">
            <span>{selected.size} selecionado{selected.size !== 1 ? 's' : ''}</span>
            <button className="tp-sel-clear" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </button>
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

function IconTemplate() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#22c55e" strokeWidth="1.5"/>
      <path d="M3 8h18M8 8v13" stroke="#22c55e" strokeWidth="1.3"/>
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
  .tbl-td--num { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .tbl-td--date { white-space: nowrap; font-size: 12px; color: #4a5568; }

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
    padding: 10px 20px;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    color: #e8edf5;
    box-shadow: 0 8px 24px #00000060;
    z-index: 100;
  }
  .tp-sel-clear {
    background: none;
    border: none;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }
  .tp-sel-clear:hover { color: #8a94a6; }
`
