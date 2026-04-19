import { useEffect, useState, useMemo } from 'react'
import { useSuppliers } from '../../hooks/useSuppliers'
import * as supplierService from '../../services/supplierService'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconEdit() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M9.5 1.5l2 2-8 8H1.5v-2l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5h9M5 3.5V2h3v1.5M4 3.5l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CFG = {
  bm:      { label: 'BM',           color: '#3b82f6', bg: '#3b82f618', border: '#3b82f635' },
  disparo: { label: 'Disparo',      color: '#a855f7', bg: '#a855f718', border: '#a855f735' },
  both:    { label: 'BM + Disparo', color: '#22c55e', bg: '#22c55e18', border: '#22c55e35' },
}

const STATUS_CFG = {
  active:     { label: 'Ativo',         color: '#22c55e', bg: '#22c55e18', border: '#22c55e35' },
  inactive:   { label: 'Inativo',       color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' },
  evaluating: { label: 'Em avaliação',  color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b35' },
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const cfg = TYPE_CFG[type] ?? { label: type, color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' }
  return (
    <span className="sp-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' }
  return (
    <span className="sp-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      <span className="sp-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function Stars({ score }) {
  if (!score) return <span className="sp-dash">—</span>
  return (
    <span className="sp-stars">
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= score ? '#f59e0b' : '#252c38', fontSize: 15 }}>★</span>
      ))}
    </span>
  )
}

function LogCount({ count }) {
  const n = Number(count) || 0
  if (!n) return <span className="sp-dash">—</span>
  return (
    <span className="sp-badge" style={{ color: '#8a94a6', background: '#8a94a615', borderColor: '#8a94a630' }}>
      {n} interaç{n === 1 ? 'ão' : 'ões'}
    </span>
  )
}

// ─── Star picker ──────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="sp-star-picker">
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          type="button"
          className="sp-star-btn"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === i ? null : i)}
          title={`${i} estrela${i !== 1 ? 's' : ''}`}
        >
          <span style={{ color: i <= (hover || value || 0) ? '#f59e0b' : '#252c38', fontSize: 22 }}>★</span>
        </button>
      ))}
      {value && (
        <button type="button" className="sp-star-clear" onClick={() => onChange(null)} title="Limpar">✕</button>
      )}
    </div>
  )
}

// ─── Format date ──────────────────────────────────────────────────────────────

function fmtDate(str) {
  if (!str) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(str))
  } catch { return str }
}

// ─── Modal (create / edit) ────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', type: 'bm', status: 'active', trust_score: null, contacts: '', notes: '' }

function SupplierModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { name: initial.name, type: initial.type, status: initial.status,
        trust_score: initial.trust_score ?? null,
        contacts: initial.contacts || '', notes: initial.notes || '' }
    : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)

  function field(key) {
    return (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Nome é obrigatório'); return }
    if (!form.type)        { alert('Tipo é obrigatório'); return }
    setSaving(true)
    try {
      await onSave({ ...form, trust_score: form.trust_score ? Number(form.trust_score) : null })
      onClose()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sp-modal-backdrop" onClick={onClose}>
      <div className="sp-modal" onClick={e => e.stopPropagation()}>
        <div className="sp-modal-header">
          <span>{initial ? 'Editar fornecedor' : 'Novo fornecedor'}</span>
          <button className="sp-icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="sp-modal-body">
          <div className="sp-form-row">
            <label>Nome *</label>
            <input value={form.name} onChange={field('name')} placeholder="Nome do fornecedor" />
          </div>
          <div className="sp-form-2col">
            <div className="sp-form-row">
              <label>Tipo *</label>
              <select value={form.type} onChange={field('type')}>
                <option value="bm">BM</option>
                <option value="disparo">Disparo</option>
                <option value="both">BM + Disparo</option>
              </select>
            </div>
            <div className="sp-form-row">
              <label>Status</label>
              <select value={form.status} onChange={field('status')}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="evaluating">Em avaliação</option>
              </select>
            </div>
          </div>
          <div className="sp-form-row">
            <label>Confiança</label>
            <StarPicker value={form.trust_score} onChange={v => setForm(f => ({ ...f, trust_score: v }))} />
          </div>
          <div className="sp-form-row">
            <label>Contatos</label>
            <textarea
              value={form.contacts}
              onChange={field('contacts')}
              rows={3}
              placeholder="Ex: WhatsApp: 11999999999 / Telegram: @fulano / Email: contato@email.com"
            />
          </div>
          <div className="sp-form-row">
            <label>Observações</label>
            <textarea value={form.notes} onChange={field('notes')} rows={3} placeholder="Notas livres..." />
          </div>
          <div className="sp-modal-footer">
            <button type="button" className="sp-btn sp-btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="sp-btn sp-btn--primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ supplierId, onEdit, onClose, onLogCountChange }) {
  const [supplier, setSupplier] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [addingLog, setAddingLog] = useState(false)
  const [logForm, setLogForm]   = useState({ description: '', occurred_at: '' })
  const [savingLog, setSavingLog] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supplierService.getSupplier(supplierId).then(s => {
      if (!cancelled) { setSupplier(s); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supplierId])

  async function handleCreateLog() {
    if (!logForm.description.trim()) { alert('Descrição é obrigatória'); return }
    setSavingLog(true)
    try {
      const log = await supplierService.createLog(supplierId, {
        description: logForm.description,
        occurred_at: logForm.occurred_at || undefined,
      })
      setSupplier(s => ({ ...s, logs: [log, ...(s.logs ?? [])] }))
      onLogCountChange?.(supplierId, 1)
      setLogForm({ description: '', occurred_at: '' })
      setAddingLog(false)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSavingLog(false)
    }
  }

  async function handleDeleteLog(logId) {
    if (!window.confirm('Remover esta interação?')) return
    try {
      await supplierService.deleteLog(supplierId, logId)
      setSupplier(s => ({ ...s, logs: s.logs.filter(l => l.id !== logId) }))
      onLogCountChange?.(supplierId, -1)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  return (
    <div className="sp-drawer-backdrop" onClick={onClose}>
      <div className="sp-drawer" onClick={e => e.stopPropagation()}>
        <div className="sp-drawer-header">
          <button className="sp-icon-btn" onClick={onClose} style={{ marginRight: 'auto' }}><IconX /></button>
        </div>

        {loading ? (
          <div className="sp-drawer-loading">Carregando…</div>
        ) : !supplier ? (
          <div className="sp-drawer-loading">Erro ao carregar.</div>
        ) : (
          <>
            {/* ── Dados do fornecedor ── */}
            <div className="sp-drawer-top">
              <div className="sp-drawer-name">{supplier.name}</div>
              <div className="sp-drawer-badges">
                <TypeBadge type={supplier.type} />
                <StatusBadge status={supplier.status} />
                <Stars score={supplier.trust_score} />
              </div>
              {supplier.contacts && (
                <div className="sp-drawer-field">
                  <span className="sp-drawer-label">Contatos</span>
                  <span className="sp-drawer-val sp-pre">{supplier.contacts}</span>
                </div>
              )}
              {supplier.notes && (
                <div className="sp-drawer-field">
                  <span className="sp-drawer-label">Observações</span>
                  <span className="sp-drawer-val sp-pre">{supplier.notes}</span>
                </div>
              )}
              <button
                type="button"
                className="sp-btn sp-btn--ghost sp-btn--sm"
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
                onClick={() => onEdit(supplier)}
              >
                <IconEdit /> Editar
              </button>
            </div>

            {/* ── Histórico de interações ── */}
            <div className="sp-drawer-logs">
              <div className="sp-drawer-logs-header">
                <span>Histórico de interações ({(supplier.logs ?? []).length})</span>
                {!addingLog && (
                  <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => setAddingLog(true)}>
                    <IconPlus /> Registrar interação
                  </button>
                )}
              </div>

              {addingLog && (
                <div className="sp-log-form">
                  <div className="sp-form-row">
                    <label>Descrição *</label>
                    <textarea
                      value={logForm.description}
                      onChange={e => setLogForm(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      placeholder="Descreva a interação..."
                      autoFocus
                    />
                  </div>
                  <div className="sp-form-row">
                    <label>Data da interação</label>
                    <input
                      type="datetime-local"
                      value={logForm.occurred_at}
                      onChange={e => setLogForm(f => ({ ...f, occurred_at: e.target.value }))}
                    />
                  </div>
                  <div className="sp-log-form-btns">
                    <button type="button" className="sp-btn sp-btn--primary sp-btn--sm" disabled={savingLog || !logForm.description.trim()} onClick={handleCreateLog}>
                      {savingLog ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => { setAddingLog(false); setLogForm({ description: '', occurred_at: '' }) }}>Cancelar</button>
                  </div>
                </div>
              )}

              {(supplier.logs ?? []).length === 0 && !addingLog && (
                <div className="sp-logs-empty">Nenhuma interação registrada.</div>
              )}

              <div className="sp-logs-list">
                {(supplier.logs ?? []).map(log => (
                  <div key={log.id} className="sp-log-item">
                    <div className="sp-log-date">{fmtDate(log.occurred_at)}</div>
                    <div className="sp-log-desc">{log.description}</div>
                    <button
                      type="button"
                      className="sp-icon-btn sp-icon-btn--danger sp-log-del"
                      onClick={() => handleDeleteLog(log.id)}
                      title="Remover"
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Fornecedores() {
  const { suppliers, loading, error, load, create, update, remove, createLog, deleteLog } = useSuppliers()

  const [search,       setSearch]       = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal,        setModal]        = useState(null)  // null | { mode: 'create' | 'edit', supplier? }
  const [drawer,       setDrawer]       = useState(null)  // supplierId | null

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterType   && s.type   !== filterType)   return false
      if (filterStatus && s.status !== filterStatus) return false
      return true
    })
  }, [suppliers, search, filterType, filterStatus])

  async function handleSave(form) {
    if (modal.mode === 'create') {
      await create(form)
    } else {
      await update(modal.supplier.id, form)
    }
  }

  async function handleDelete(supplier) {
    if (!window.confirm(`Remover "${supplier.name}"? Todos os logs serão apagados.`)) return
    try { await remove(supplier.id) } catch (err) { alert(err.response?.data?.error || err.message) }
  }

  function handleLogCountChange(supplierId, delta) {
    // The useSuppliers hook updates log_count internally via createLog/deleteLog —
    // but for logs added/removed from the drawer (directly via supplierService), update manually.
    // We call a no-op to signal; since drawer uses supplierService directly, we reload the list.
    load()
  }

  function truncate(str, max = 40) {
    if (!str) return <span className="sp-dash">—</span>
    return str.length > max ? str.slice(0, max) + '…' : str
  }

  return (
    <>
      <style>{CSS_STR}</style>
      <div className="page-root">
        {/* ── Header ── */}
        <div className="sp-topbar">
          <div>
            <h1 className="sp-page-title">Fornecedores</h1>
            <p className="sp-page-sub">Gerencie seus fornecedores de BM e disparos</p>
          </div>
          <button className="sp-btn sp-btn--primary" onClick={() => setModal({ mode: 'create' })}>
            <IconPlus /> Novo fornecedor
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="sp-filters">
          <input
            className="sp-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
          />
          <select className="sp-filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="bm">BM</option>
            <option value="disparo">Disparo</option>
            <option value="both">BM + Disparo</option>
          </select>
          <select className="sp-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="evaluating">Em avaliação</option>
          </select>
        </div>

        {error && <div className="sp-error">⚠ {error}</div>}

        {/* ── Table ── */}
        <div className="sp-table-wrap">
          {loading ? (
            <div className="sp-loading">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="sp-empty">
              {suppliers.length === 0
                ? 'Nenhum fornecedor cadastrado. Clique em "Novo fornecedor" para começar.'
                : 'Nenhum fornecedor corresponde aos filtros.'}
            </div>
          ) : (
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Confiança</th>
                  <th>Contatos</th>
                  <th>Interações</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr
                    key={s.id}
                    className="sp-tr"
                    onClick={() => setDrawer(s.id)}
                    title="Clique para ver detalhes"
                  >
                    <td className="sp-td sp-td-name">
                      <span className="sp-name">{s.name}</span>
                      <IconChevronRight />
                    </td>
                    <td className="sp-td"><TypeBadge type={s.type} /></td>
                    <td className="sp-td"><StatusBadge status={s.status} /></td>
                    <td className="sp-td"><Stars score={s.trust_score} /></td>
                    <td className="sp-td sp-td-contacts" title={s.contacts || ''}>
                      {s.contacts
                        ? <span className="sp-contacts-text">{truncate(s.contacts)}</span>
                        : <span className="sp-dash">—</span>
                      }
                    </td>
                    <td className="sp-td"><LogCount count={s.log_count} /></td>
                    <td className="sp-td" onClick={e => e.stopPropagation()}>
                      <div className="sp-actions">
                        <button
                          className="sp-icon-btn"
                          onClick={() => setModal({ mode: 'edit', supplier: s })}
                          title="Editar"
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="sp-icon-btn sp-icon-btn--danger"
                          onClick={() => handleDelete(s)}
                          title="Remover"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <SupplierModal
          initial={modal.supplier ?? null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Drawer ── */}
      {drawer && (
        <DetailDrawer
          supplierId={drawer}
          onEdit={(s) => { setModal({ mode: 'edit', supplier: s }); setDrawer(null) }}
          onClose={() => setDrawer(null)}
          onLogCountChange={handleLogCountChange}
        />
      )}
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS_STR = `
  .sp-topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .sp-page-title { font-size: 20px; font-weight: 600; color: #e8edf5; }
  .sp-page-sub   { font-size: 13px; color: #8a94a6; margin-top: 2px; }

  /* ── Filters ── */
  .sp-filters {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
  .sp-search {
    flex: 1;
    min-width: 180px;
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #e8edf5;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 12px;
    outline: none;
  }
  .sp-search:focus { border-color: #22c55e; }
  .sp-filter-select {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #8a94a6;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 12px;
    outline: none;
    cursor: pointer;
  }
  .sp-filter-select:focus { border-color: #22c55e; }

  /* ── Table ── */
  .sp-table-wrap {
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 12px;
    overflow: hidden;
  }
  .sp-loading, .sp-empty {
    padding: 40px;
    text-align: center;
    color: #4a5568;
    font-size: 13px;
  }
  .sp-error {
    background: #ef444415;
    border: 1px solid #ef444435;
    border-radius: 8px;
    padding: 10px 14px;
    color: #ef4444;
    font-size: 13px;
  }
  .sp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .sp-table thead tr {
    border-bottom: 1px solid #252c38;
  }
  .sp-table th {
    padding: 10px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: #4a5568;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  .sp-tr {
    border-bottom: 1px solid #1a1f28;
    cursor: pointer;
    transition: background 0.12s;
  }
  .sp-tr:hover { background: #141820; }
  .sp-tr:last-child { border-bottom: none; }
  .sp-td { padding: 11px 14px; color: #e8edf5; vertical-align: middle; }
  .sp-td-name {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sp-td-name svg { color: #252c38; flex-shrink: 0; }
  .sp-tr:hover .sp-td-name svg { color: #4a5568; }
  .sp-name { font-weight: 500; }
  .sp-td-contacts { max-width: 200px; }
  .sp-contacts-text {
    color: #8a94a6;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  /* ── Badges ── */
  .sp-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 5px;
    border: 1px solid transparent;
    font-size: 11.5px;
    font-weight: 500;
    white-space: nowrap;
  }
  .sp-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .sp-dash { color: #4a5568; font-size: 13px; }
  .sp-stars { display: flex; gap: 1px; line-height: 1; }

  /* ── Actions ── */
  .sp-actions { display: flex; gap: 4px; }
  .sp-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid #252c38;
    border-radius: 6px;
    background: transparent;
    color: #8a94a6;
    cursor: pointer;
    transition: color 0.12s, background 0.12s, border-color 0.12s;
  }
  .sp-icon-btn:hover { color: #e8edf5; background: #1a1f28; border-color: #374151; }
  .sp-icon-btn--danger:hover { color: #ef4444; border-color: #ef444435; background: #ef444410; }

  /* ── Buttons ── */
  .sp-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .sp-btn--primary {
    background: #22c55e;
    color: #0a0c0f;
    border-color: #22c55e;
  }
  .sp-btn--primary:hover:not(:disabled) { background: #16a34a; border-color: #16a34a; }
  .sp-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .sp-btn--ghost {
    background: transparent;
    color: #8a94a6;
    border-color: #252c38;
  }
  .sp-btn--ghost:hover:not(:disabled) { color: #e8edf5; border-color: #374151; background: #1a1f28; }
  .sp-btn--sm { padding: 5px 10px; font-size: 12px; }

  /* ── Modal ── */
  .sp-modal-backdrop {
    position: fixed;
    inset: 0;
    background: #00000070;
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
  }
  .sp-modal {
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 14px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 60px #00000080;
  }
  .sp-modal::-webkit-scrollbar { width: 4px; }
  .sp-modal::-webkit-scrollbar-track { background: transparent; }
  .sp-modal::-webkit-scrollbar-thumb { background: #252c38; border-radius: 2px; }
  .sp-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px solid #252c38;
    font-size: 14px;
    font-weight: 600;
    color: #e8edf5;
  }
  .sp-modal-body {
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .sp-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 4px;
  }

  /* ── Form ── */
  .sp-form-row { display: flex; flex-direction: column; gap: 5px; }
  .sp-form-row label { font-size: 12px; color: #8a94a6; font-weight: 500; }
  .sp-form-row input,
  .sp-form-row select,
  .sp-form-row textarea {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #e8edf5;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 11px;
    outline: none;
    resize: vertical;
    transition: border-color 0.12s;
  }
  .sp-form-row input:focus,
  .sp-form-row select:focus,
  .sp-form-row textarea:focus { border-color: #22c55e; }
  .sp-form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  /* ── Star picker ── */
  .sp-star-picker { display: flex; align-items: center; gap: 2px; }
  .sp-star-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    line-height: 1;
    transition: transform 0.1s;
  }
  .sp-star-btn:hover { transform: scale(1.15); }
  .sp-star-clear {
    background: none;
    border: none;
    cursor: pointer;
    color: #4a5568;
    font-size: 11px;
    padding: 2px 6px;
    margin-left: 4px;
  }
  .sp-star-clear:hover { color: #8a94a6; }

  /* ── Drawer ── */
  .sp-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: #00000050;
    backdrop-filter: blur(2px);
    z-index: 100;
    display: flex;
    justify-content: flex-end;
  }
  .sp-drawer {
    background: #0f1215;
    border-left: 1px solid #252c38;
    width: 480px;
    max-width: 100vw;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    box-shadow: -8px 0 32px #00000060;
  }
  .sp-drawer::-webkit-scrollbar { width: 4px; }
  .sp-drawer::-webkit-scrollbar-track { background: transparent; }
  .sp-drawer::-webkit-scrollbar-thumb { background: #252c38; border-radius: 2px; }
  .sp-drawer-header {
    display: flex;
    align-items: center;
    padding: 16px 20px 12px;
    border-bottom: 1px solid #252c38;
  }
  .sp-drawer-loading {
    padding: 40px;
    text-align: center;
    color: #4a5568;
    font-size: 13px;
  }

  /* ── Drawer top ── */
  .sp-drawer-top {
    padding: 20px;
    border-bottom: 1px solid #252c38;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sp-drawer-name {
    font-size: 18px;
    font-weight: 600;
    color: #e8edf5;
  }
  .sp-drawer-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .sp-drawer-field { display: flex; flex-direction: column; gap: 4px; }
  .sp-drawer-label { font-size: 11px; font-weight: 600; color: #4a5568; text-transform: uppercase; letter-spacing: 0.06em; }
  .sp-drawer-val { font-size: 13px; color: #8a94a6; }
  .sp-pre { white-space: pre-wrap; word-break: break-word; }

  /* ── Drawer logs ── */
  .sp-drawer-logs {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
  }
  .sp-drawer-logs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    color: #e8edf5;
  }
  .sp-logs-empty {
    font-size: 13px;
    color: #4a5568;
    padding: 12px 0;
  }
  .sp-logs-list { display: flex; flex-direction: column; gap: 10px; }
  .sp-log-item {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
  }
  .sp-log-date { font-size: 11px; color: #4a5568; }
  .sp-log-desc { font-size: 13px; color: #e8edf5; white-space: pre-wrap; word-break: break-word; padding-right: 28px; }
  .sp-log-del {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
  }

  /* ── Log form ── */
  .sp-log-form {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sp-log-form-btns { display: flex; gap: 8px; }
`
