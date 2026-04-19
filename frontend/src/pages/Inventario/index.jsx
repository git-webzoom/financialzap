import { useEffect, useState, useMemo } from 'react'
import { useInventory } from '../../hooks/useInventory'

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

// ─── Badges ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  free:     { label: 'Livre',     color: '#22c55e', bg: '#22c55e18', border: '#22c55e35' },
  in_use:   { label: 'Em uso',    color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' },
  reserved: { label: 'Reservado', color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b35' },
}

const ORIGIN_CFG = {
  own:    { label: 'Próprio',  color: '#3b82f6', bg: '#3b82f618', border: '#3b82f635' },
  rented: { label: 'Alugado', color: '#a855f7', bg: '#a855f718', border: '#a855f735' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' }
  return (
    <span className="inv-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      <span className="inv-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function OriginBadge({ origin }) {
  const cfg = ORIGIN_CFG[origin] ?? { label: origin, color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' }
  return (
    <span className="inv-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  phone_number: '', origin: 'own', supplier: '', bm_name: '',
  waba_name: '', automation_name: '', status: 'free', notes: '',
}

function NumberModal({ initial, onSave, onClose }) {
  const [form, setForm]     = useState(initial ? { ...initial } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  function field(key) {
    return (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="inv-modal-backdrop" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <span>{initial ? 'Editar número' : 'Registrar número'}</span>
          <button className="inv-icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <form className="inv-modal-form" onSubmit={handleSubmit}>
          <div className="inv-form-row">
            <label>Número de Telefone *</label>
            <input value={form.phone_number} onChange={field('phone_number')} placeholder="+55 11 99999-9999" className="inv-mono" required />
          </div>
          <div className="inv-form-2col">
            <div className="inv-form-row">
              <label>Origem *</label>
              <select value={form.origin} onChange={field('origin')} required>
                <option value="own">Próprio</option>
                <option value="rented">Alugado</option>
              </select>
            </div>
            <div className="inv-form-row">
              <label>Status</label>
              <select value={form.status} onChange={field('status')}>
                <option value="free">Livre</option>
                <option value="in_use">Em uso</option>
                <option value="reserved">Reservado</option>
              </select>
            </div>
          </div>
          <div className="inv-form-row">
            <label>Fornecedor</label>
            <input value={form.supplier || ''} onChange={field('supplier')} placeholder="Nome do fornecedor" />
          </div>
          <div className="inv-form-2col">
            <div className="inv-form-row">
              <label>BM</label>
              <input value={form.bm_name || ''} onChange={field('bm_name')} placeholder="Nome da BM" />
            </div>
            <div className="inv-form-row">
              <label>WABA</label>
              <input value={form.waba_name || ''} onChange={field('waba_name')} placeholder="Nome da WABA" />
            </div>
          </div>
          <div className="inv-form-row">
            <label>Automação</label>
            <input value={form.automation_name || ''} onChange={field('automation_name')} placeholder="Nome da automação" />
          </div>
          <div className="inv-form-row">
            <label>Observações</label>
            <textarea value={form.notes || ''} onChange={field('notes')} rows={3} placeholder="Notas livres..." />
          </div>
          <div className="inv-modal-footer">
            <button type="button" className="inv-btn inv-btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="inv-btn inv-btn--primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Inventario() {
  const { numbers, loading, error, load, create, update, remove } = useInventory()
  const [modal, setModal]         = useState(null) // null | { mode: 'create'|'edit', item? }
  const [search, setSearch]       = useState('')
  const [filterStatus, setStatus] = useState('')
  const [filterOrigin, setOrigin] = useState('')

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = numbers
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        (n.phone_number || '').toLowerCase().includes(q) ||
        (n.automation_name || '').toLowerCase().includes(q) ||
        (n.bm_name || '').toLowerCase().includes(q) ||
        (n.waba_name || '').toLowerCase().includes(q) ||
        (n.supplier || '').toLowerCase().includes(q)
      )
    }
    if (filterStatus) list = list.filter(n => n.status === filterStatus)
    if (filterOrigin) list = list.filter(n => n.origin === filterOrigin)
    return list
  }, [numbers, search, filterStatus, filterOrigin])

  async function handleSave(form) {
    if (modal.mode === 'create') {
      await create(form)
    } else {
      await update(modal.item.id, form)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover este número do inventário?')) return
    try { await remove(id) } catch (err) { alert(err.response?.data?.error || err.message) }
  }

  return (
    <>
      <style>{CSS_STR}</style>
      <div className="page-root">
        <div className="inv-topbar">
          <div>
            <h1 className="inv-page-title">Inventário de Números</h1>
            <p className="inv-page-sub">{numbers.length} número{numbers.length !== 1 ? 's' : ''} registrado{numbers.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="inv-btn inv-btn--primary" onClick={() => setModal({ mode: 'create' })}>
            <IconPlus /> Registrar número
          </button>
        </div>

        {error && <div className="inv-error">⚠ {error}</div>}

        {/* Filters */}
        <div className="inv-filters">
          <input
            className="inv-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, automação, BM, WABA…"
          />
          <select className="inv-select" value={filterStatus} onChange={e => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="free">Livre</option>
            <option value="in_use">Em uso</option>
            <option value="reserved">Reservado</option>
          </select>
          <select className="inv-select" value={filterOrigin} onChange={e => setOrigin(e.target.value)}>
            <option value="">Todas as origens</option>
            <option value="own">Próprio</option>
            <option value="rented">Alugado</option>
          </select>
        </div>

        {/* Table */}
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Origem</th>
                <th>Fornecedor</th>
                <th>BM</th>
                <th>WABA</th>
                <th>Automação</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="inv-td-center">Carregando…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="inv-td-center">Nenhum número encontrado.</td></tr>
              )}
              {filtered.map(n => (
                <tr key={n.id} className="inv-row">
                  <td className="inv-td inv-mono">{n.phone_number}</td>
                  <td className="inv-td"><OriginBadge origin={n.origin} /></td>
                  <td className="inv-td">{n.supplier || <span className="inv-dash">—</span>}</td>
                  <td className="inv-td">{n.bm_name   || <span className="inv-dash">—</span>}</td>
                  <td className="inv-td">{n.waba_name || <span className="inv-dash">—</span>}</td>
                  <td className="inv-td">{n.automation_name || <span className="inv-dash">—</span>}</td>
                  <td className="inv-td"><StatusBadge status={n.status} /></td>
                  <td className="inv-td">
                    <div className="inv-actions">
                      <button className="inv-icon-btn" onClick={() => setModal({ mode: 'edit', item: n })} title="Editar"><IconEdit /></button>
                      <button className="inv-icon-btn inv-icon-btn--danger" onClick={() => handleDelete(n.id)} title="Remover"><IconTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <NumberModal
          initial={modal.mode === 'edit' ? modal.item : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS_STR = `
  .inv-topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .inv-page-title { font-size: 20px; font-weight: 600; color: #e8edf5; }
  .inv-page-sub   { font-size: 13px; color: #8a94a6; margin-top: 2px; }

  .inv-filters {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .inv-search {
    flex: 1;
    min-width: 220px;
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #e8edf5;
    font-size: 13px;
    font-family: inherit;
    padding: 8px 12px;
    outline: none;
    transition: border-color 0.15s;
  }
  .inv-search:focus { border-color: #22c55e; }
  .inv-select {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #e8edf5;
    font-size: 13px;
    font-family: inherit;
    padding: 8px 12px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .inv-select:focus { border-color: #22c55e; }

  .inv-table-wrap {
    overflow-x: auto;
    border-radius: 12px;
    border: 1px solid #252c38;
  }
  .inv-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .inv-table th {
    background: #0f1215;
    color: #4a5568;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 10px 14px;
    text-align: left;
    border-bottom: 1px solid #1a2030;
    white-space: nowrap;
  }
  .inv-row:hover td { background: #141820; }
  .inv-td {
    padding: 11px 14px;
    color: #c4cdd8;
    border-bottom: 1px solid #12161c;
    vertical-align: middle;
    white-space: nowrap;
  }
  .inv-td-center { padding: 32px; text-align: center; color: #4a5568; }
  .inv-dash { color: #4a5568; }
  .inv-mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }

  .inv-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid;
    white-space: nowrap;
  }
  .inv-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .inv-actions { display: flex; gap: 4px; }
  .inv-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: none;
    color: #4a5568;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    padding: 0;
  }
  .inv-icon-btn:hover { color: #8a94a6; background: #1a1f28; }
  .inv-icon-btn--danger:hover { color: #ef4444; background: #ef444415; }

  .inv-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .inv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .inv-btn--primary { background: #22c55e; color: #0a0c0f; }
  .inv-btn--primary:hover:not(:disabled) { background: #16a34a; }
  .inv-btn--ghost { background: #1a1f28; color: #8a94a6; border: 1px solid #252c38; }
  .inv-btn--ghost:hover:not(:disabled) { color: #e8edf5; border-color: #374151; }

  .inv-error { background: #ef444415; border: 1px solid #ef444435; color: #ef4444; border-radius: 8px; padding: 10px 14px; font-size: 13px; }

  /* Modal */
  .inv-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .inv-modal {
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 14px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  }
  .inv-modal::-webkit-scrollbar { width: 4px; }
  .inv-modal::-webkit-scrollbar-thumb { background: #252c38; }
  .inv-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 14px;
    border-bottom: 1px solid #1a2030;
    font-size: 15px;
    font-weight: 600;
    color: #e8edf5;
  }
  .inv-modal-form { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
  .inv-form-row { display: flex; flex-direction: column; gap: 5px; }
  .inv-form-row label { font-size: 11px; color: #8a94a6; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
  .inv-form-row input,
  .inv-form-row select,
  .inv-form-row textarea {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 7px;
    color: #e8edf5;
    font-size: 13px;
    font-family: inherit;
    padding: 8px 11px;
    outline: none;
    resize: vertical;
    transition: border-color 0.15s;
  }
  .inv-form-row input:focus,
  .inv-form-row select:focus,
  .inv-form-row textarea:focus { border-color: #22c55e; }
  .inv-form-row input.inv-mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .inv-form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .inv-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid #1a2030;
    margin-top: 4px;
    padding-bottom: 2px;
  }
`
