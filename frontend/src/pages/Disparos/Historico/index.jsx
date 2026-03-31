/**
 * pages/Disparos/Historico/index.jsx
 * Lists all campaigns for the user. Clicking a row opens a detail panel
 * with individual contact statuses and a CSV export button.
 * Active campaigns update via ProgressoDisparo (real-time polling).
 */
import { useCallback, useEffect, useState } from 'react'
import { listCampanhas, getCampanhaContacts, cancelCampanha, deleteCampanha } from '../../../services/campanhaService'
import ProgressoDisparo from '../../../components/Disparos/ProgressoDisparo'

// ─── helpers ──────────────────────────────────────────────────────────────────

const ACTIVE = new Set(['running', 'scheduled', 'pending'])

const STATUS_LABEL = {
  pending:          'Pendente',
  running:          'Em andamento',
  scheduled:        'Agendado',
  done:             'Concluído',
  done_with_errors: 'Com erros',
  failed:           'Falhou',
  cancelled:        'Cancelado',
}

const STATUS_COLOR = {
  pending:          '#4a5568',
  running:          '#3b82f6',
  scheduled:        '#f59e0b',
  done:             '#22c55e',
  done_with_errors: '#f97316',
  failed:           '#ef4444',
  cancelled:        '#6b7280',
}

const CONTACT_STATUS_COLOR = {
  pending:   '#4a5568',
  sent:      '#3b82f6',
  delivered: '#22c55e',
  failed:    '#ef4444',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function pct(part, total) {
  if (!total) return 0
  return Math.round((Number(part) / Number(total)) * 100)
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportContactsCSV(contacts, campaignName) {
  const headers = ['ID', 'Telefone', 'Template', 'Status', 'Enviado em', 'Erro']
  const rows = contacts.map(c => [
    c.id,
    c.phone,
    c.template_id,
    c.status,
    c.sent_at ? new Date(c.sent_at).toLocaleString('pt-BR') : '',
    c.error_message || '',
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `campanha_${campaignName.replace(/\s+/g, '_')}_contatos.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DisparosHistorico() {
  const [campaigns, setCampaigns] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  // Detail panel state
  const [selected,  setSelected]  = useState(null)  // campaign object
  const [contacts,  setContacts]  = useState([])
  const [contactsMeta, setContactsMeta] = useState({ total: 0, page: 1, pages: 1 })
  const [ctxFilter, setCtxFilter] = useState('')     // status filter for contacts
  const [ctxPage,   setCtxPage]   = useState(1)
  const [ctxLoading, setCtxLoading] = useState(false)

  // Export / cancel / delete state
  const [exporting,  setExporting]  = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [actionError, setActionError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listCampanhas()
      setCampaigns(data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const loadContacts = useCallback(async (campaign, page = 1, status = '') => {
    setCtxLoading(true)
    try {
      const res = await getCampanhaContacts(campaign.id, { page, limit: 50, ...(status ? { status } : {}) })
      setContacts(res.contacts)
      setContactsMeta({ total: res.total, page: res.page, pages: res.pages })
    } catch {
      setContacts([])
    } finally {
      setCtxLoading(false)
    }
  }, [])

  function openDetail(c) {
    setSelected(c)
    setCtxFilter('')
    setCtxPage(1)
    loadContacts(c, 1, '')
  }

  function closeDetail() {
    setSelected(null)
    setContacts([])
  }

  // Reload contacts when filter/page changes (after panel is open)
  useEffect(() => {
    if (selected) loadContacts(selected, ctxPage, ctxFilter)
  }, [ctxFilter, ctxPage]) // eslint-disable-line

  async function handleCancel() {
    if (!selected) return
    if (!window.confirm(`Cancelar a campanha "${selected.name}"? Os disparos pendentes serão removidos.`)) return
    setCancelling(true)
    setActionError(null)
    try {
      await cancelCampanha(selected.id)
      await load()
      closeDetail()
    } catch (err) {
      setActionError(err.response?.data?.error || err.message)
    } finally {
      setCancelling(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    if (!window.confirm(`Apagar permanentemente a campanha "${selected.name}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    setActionError(null)
    try {
      await deleteCampanha(selected.id)
      await load()
      closeDetail()
    } catch (err) {
      setActionError(err.response?.data?.error || err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleExport() {
    if (!selected) return
    setExporting(true)
    try {
      // Fetch all contacts for export (up to 5000)
      const res = await getCampanhaContacts(selected.id, { page: 1, limit: 5000 })
      exportContactsCSV(res.contacts, selected.name)
    } catch {
      /* silently ignore */
    } finally {
      setExporting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="page-root">

        {/* Header */}
        <div className="ht-header">
          <div>
            <h1 className="ht-title">Histórico de disparos</h1>
            <p className="ht-sub">Acompanhe o progresso e resultados das suas campanhas</p>
          </div>
          <button className="ht-btn ht-btn--secondary" onClick={load} disabled={loading}>
            {loading ? <Spinner /> : '↺'} Atualizar
          </button>
        </div>

        {/* Error */}
        {error && <div className="ht-banner ht-banner--err">⚠ {error}</div>}

        {/* Campaign list */}
        {loading && !campaigns.length ? (
          <div className="ht-empty"><Spinner /> Carregando campanhas…</div>
        ) : campaigns.length === 0 ? (
          <div className="ht-empty">
            <p className="ht-empty-title">Nenhuma campanha encontrada</p>
            <p className="ht-empty-sub">Crie sua primeira campanha em <a href="/disparos/novo" className="ht-link">Novo disparo</a>.</p>
          </div>
        ) : (
          <div className="ht-list">
            {campaigns.map(c => (
              <CampaignRow key={c.id} campaign={c} onOpen={() => openDetail(c)} />
            ))}
          </div>
        )}

        {/* Detail panel — slide in from right */}
        {selected && (
          <div className="ht-overlay" onClick={closeDetail}>
            <div className="ht-panel" onClick={e => e.stopPropagation()}>
              <DetailPanel
                campaign={selected}
                contacts={contacts}
                meta={contactsMeta}
                loading={ctxLoading}
                filter={ctxFilter}
                onFilter={s => { setCtxFilter(s); setCtxPage(1) }}
                page={ctxPage}
                onPage={setCtxPage}
                onExport={handleExport}
                exporting={exporting}
                onCancel={handleCancel}
                cancelling={cancelling}
                onDelete={handleDelete}
                deleting={deleting}
                actionError={actionError}
                onClose={closeDetail}
              />
            </div>
          </div>
        )}

      </div>
    </>
  )
}

// ─── CampaignRow ──────────────────────────────────────────────────────────────

function CampaignRow({ campaign: c, onOpen }) {
  const color = STATUS_COLOR[c.status] || '#4a5568'
  const total = Number(c.total_contacts) || 0
  const sent  = Number(c.sent) || 0
  const fail  = Number(c.failed) || 0

  return (
    <div className="ht-row" onClick={onOpen}>
      <div className="ht-row-left">
        <div className="ht-row-name">{c.name}</div>
        <div className="ht-row-meta">
          <span>{fmtDate(c.created_at)}</span>
          {c.scheduled_at && <span>· Agendado: {fmtDate(c.scheduled_at)}</span>}
          <span>· {c.speed_per_second} msg/s</span>
        </div>
        {/* Progress bar for active campaigns */}
        {ACTIVE.has(c.status) ? (
          <div style={{ marginTop: 8 }}>
            <ProgressoDisparo campaignId={c.id} compact />
          </div>
        ) : (
          <MiniBar sent={sent} failed={fail} total={total} />
        )}
      </div>

      <div className="ht-row-right">
        <span className="ht-badge" style={{ background: color + '20', color }}>
          {STATUS_LABEL[c.status] || c.status}
        </span>
        <div className="ht-counters">
          <Counter label="Total"    value={total} />
          <Counter label="Enviados" value={sent}  color="#22c55e" />
          <Counter label="Falhas"   value={fail}  color="#ef4444" />
        </div>
        <span className="ht-chevron">›</span>
      </div>
    </div>
  )
}

function MiniBar({ sent, failed, total }) {
  if (!total) return null
  const sentPct = pct(sent, total)
  const failPct = pct(failed, total)
  return (
    <div className="ht-minibar-track" style={{ marginTop: 8 }}>
      <div className="ht-minibar-fill" style={{ width: `${sentPct}%`, background: '#22c55e' }} />
      <div className="ht-minibar-fill" style={{ width: `${failPct}%`, background: '#ef4444' }} />
    </div>
  )
}

function Counter({ label, value, color }) {
  return (
    <div className="ht-counter">
      <span className="ht-counter-val" style={color ? { color } : {}}>{value}</span>
      <span className="ht-counter-lbl">{label}</span>
    </div>
  )
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────

function DetailPanel({ campaign, contacts, meta, loading, filter, onFilter, page, onPage, onExport, exporting, onCancel, cancelling, onDelete, deleting, actionError, onClose }) {
  const color = STATUS_COLOR[campaign.status] || '#4a5568'
  const canCancel = ['pending', 'scheduled', 'running'].includes(campaign.status)
  const canDelete = campaign.status !== 'running'

  const FILTERS = [
    { value: '',          label: 'Todos' },
    { value: 'pending',   label: 'Pendentes' },
    { value: 'sent',      label: 'Enviados' },
    { value: 'delivered', label: 'Entregues' },
    { value: 'failed',    label: 'Falhas' },
  ]

  return (
    <div className="dp-root">
      {/* Header */}
      <div className="dp-header">
        <div>
          <p className="dp-name">{campaign.name}</p>
          <span className="dp-badge" style={{ background: color + '20', color }}>
            {STATUS_LABEL[campaign.status] || campaign.status}
          </span>
        </div>
        <div className="dp-header-actions">
          <button className="ht-btn ht-btn--secondary" onClick={onExport} disabled={exporting}>
            {exporting ? <Spinner /> : '↓'} Exportar CSV
          </button>
          <button className="dp-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="dp-actions">
        {canCancel && (
          <button className="ht-btn ht-btn--warn" onClick={onCancel} disabled={cancelling || deleting}>
            {cancelling ? <Spinner /> : '⏹'} Cancelar disparo
          </button>
        )}
        {canDelete && (
          <button className="ht-btn ht-btn--danger" onClick={onDelete} disabled={deleting || cancelling}>
            {deleting ? <Spinner /> : '🗑'} Apagar campanha
          </button>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="ht-banner ht-banner--err">⚠ {actionError}</div>
      )}

      {/* Progress (live for active campaigns) */}
      {ACTIVE.has(campaign.status) && (
        <div style={{ padding: '0 0 4px' }}>
          <ProgressoDisparo campaignId={campaign.id} />
        </div>
      )}

      {/* Static stats for finished/cancelled campaigns */}
      {!ACTIVE.has(campaign.status) && (
        <div className="dp-stats">
          <StatBox label="Total"     value={campaign.total_contacts} />
          <StatBox label="Enviados"  value={campaign.sent}           color="#22c55e" />
          <StatBox label="Entregues" value={campaign.delivered}      color="#3b82f6" />
          <StatBox label="Falhas"    value={campaign.failed}         color="#ef4444" />
        </div>
      )}

      {/* Contacts filter */}
      <div className="dp-filters">
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`dp-filter-btn${filter === f.value ? ' dp-filter-btn--active' : ''}`}
            onClick={() => onFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        <span className="dp-total-lbl">{meta.total} contatos</span>
      </div>

      {/* Contacts table */}
      <div className="dp-table-wrap">
        {loading ? (
          <div className="dp-loading"><Spinner /> Carregando…</div>
        ) : contacts.length === 0 ? (
          <div className="dp-loading" style={{ color: '#4a5568' }}>Nenhum contato encontrado.</div>
        ) : (
          <table className="dp-table">
            <thead>
              <tr>
                <th>Telefone</th>
                <th>Template</th>
                <th>Status</th>
                <th>Enviado em</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id}>
                  <td className="dp-phone">{c.phone}</td>
                  <td className="dp-tpl">{c.template_id}</td>
                  <td>
                    <span
                      className="dp-status"
                      style={{
                        background: (CONTACT_STATUS_COLOR[c.status] || '#4a5568') + '20',
                        color:       CONTACT_STATUS_COLOR[c.status] || '#4a5568',
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="dp-date">{c.sent_at ? fmtDate(c.sent_at) : '—'}</td>
                  <td className="dp-err" title={c.error_message || ''}>
                    {c.error_message ? c.error_message.slice(0, 60) + (c.error_message.length > 60 ? '…' : '') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="dp-pagination">
          <button className="dp-pg-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
          <span className="dp-pg-info">{page} / {meta.pages}</span>
          <button className="dp-pg-btn" disabled={page >= meta.pages} onClick={() => onPage(page + 1)}>›</button>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div className="dp-stat">
      <span className="dp-stat-val" style={color ? { color } : {}}>{Number(value) || 0}</span>
      <span className="dp-stat-lbl">{label}</span>
    </div>
  )
}

function Spinner() {
  return <span className="ht-spinner" />
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Page header ── */
  .ht-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 16px; flex-wrap: wrap;
  }
  .ht-title {
    font-family: 'DM Sans', sans-serif; font-size: 22px;
    font-weight: 600; color: #e8edf5; letter-spacing: -0.3px; margin: 0;
  }
  .ht-sub { font-size: 13px; color: #4a5568; font-family: 'DM Sans', sans-serif; margin: 4px 0 0; }

  /* ── Buttons ── */
  .ht-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px; border: 1px solid transparent;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: opacity 0.15s, background 0.15s; white-space: nowrap;
  }
  .ht-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ht-btn--secondary { background: #1a1f28; border-color: #252c38; color: #8a94a6; }
  .ht-btn--secondary:hover:not(:disabled) { background: #252c38; color: #e8edf5; }
  .ht-btn--warn   { background: #f59e0b18; border-color: #f59e0b40; color: #f59e0b; }
  .ht-btn--warn:hover:not(:disabled)   { background: #f59e0b25; }
  .ht-btn--danger { background: #ef444418; border-color: #ef444440; color: #f87171; }
  .ht-btn--danger:hover:not(:disabled) { background: #ef444428; }

  /* ── Spinner ── */
  .ht-spinner {
    display: inline-block; width: 12px; height: 12px;
    border: 2px solid #4a556840; border-top-color: #4a5568;
    border-radius: 50%; animation: ht-spin 0.7s linear infinite;
  }
  @keyframes ht-spin { to { transform: rotate(360deg); } }

  /* ── Banner ── */
  .ht-banner { padding: 10px 14px; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; }
  .ht-banner--err { background: #ef444412; border: 1px solid #ef444430; color: #fca5a5; }

  /* ── Empty state ── */
  .ht-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; padding: 48px 24px; text-align: center;
    color: #4a5568; font-family: 'DM Sans', sans-serif;
  }
  .ht-empty-title { font-size: 15px; font-weight: 600; color: #8a94a6; margin: 0; }
  .ht-empty-sub   { font-size: 13px; color: #4a5568; margin: 0; }
  .ht-link { color: #22c55e; text-decoration: none; }
  .ht-link:hover { text-decoration: underline; }

  /* ── Campaign list ── */
  .ht-list { display: flex; flex-direction: column; gap: 8px; }

  .ht-row {
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    background: #0f1215; border: 1px solid #1a1f28; border-radius: 12px;
    padding: 16px 18px; cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .ht-row:hover { border-color: #252c38; background: #11151a; }

  .ht-row-left  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .ht-row-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

  .ht-row-name {
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    font-weight: 600; color: #e8edf5; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
  .ht-row-meta {
    font-family: 'DM Sans', sans-serif; font-size: 12px; color: #4a5568;
    display: flex; gap: 6px; flex-wrap: wrap;
  }

  .ht-badge {
    padding: 3px 10px; border-radius: 999px;
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600;
    white-space: nowrap;
  }
  .ht-counters { display: flex; gap: 10px; }
  .ht-counter { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
  .ht-counter-val {
    font-family: 'JetBrains Mono', monospace; font-size: 14px;
    font-weight: 600; color: #e8edf5;
  }
  .ht-counter-lbl {
    font-family: 'DM Sans', sans-serif; font-size: 10px; color: #4a5568;
  }
  .ht-chevron { font-size: 18px; color: #252c38; }

  /* ── Mini progress bar ── */
  .ht-minibar-track {
    width: 100%; height: 4px; background: #1a1f28;
    border-radius: 999px; overflow: hidden; display: flex;
  }
  .ht-minibar-fill { height: 100%; transition: width 0.3s; }

  /* ── Overlay + panel ── */
  .ht-overlay {
    position: fixed; inset: 0; background: #00000088;
    z-index: 50; display: flex; justify-content: flex-end;
    animation: ht-fade 0.15s ease;
  }
  @keyframes ht-fade { from { opacity: 0; } to { opacity: 1; } }

  .ht-panel {
    width: min(640px, 100vw); height: 100%;
    background: #0a0c0f; border-left: 1px solid #1a1f28;
    overflow-y: auto; animation: ht-slide 0.2s ease;
  }
  @keyframes ht-slide { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }

  /* ── Detail panel ── */
  .dp-root { display: flex; flex-direction: column; gap: 16px; padding: 20px; }

  .dp-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  }
  .dp-name {
    font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 600;
    color: #e8edf5; margin: 0 0 6px;
  }
  .dp-badge {
    padding: 3px 10px; border-radius: 999px;
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600;
  }
  .dp-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .dp-close {
    width: 28px; height: 28px; border-radius: 6px;
    background: #1a1f28; border: none; color: #8a94a6;
    font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .dp-close:hover { background: #252c38; color: #e8edf5; }

  .dp-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  .dp-stats {
    display: flex; gap: 12px; flex-wrap: wrap;
    background: #0f1215; border: 1px solid #1a1f28;
    border-radius: 10px; padding: 12px 16px;
  }
  .dp-stat { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 60px; }
  .dp-stat-val {
    font-family: 'JetBrains Mono', monospace; font-size: 18px;
    font-weight: 700; color: #e8edf5;
  }
  .dp-stat-lbl {
    font-family: 'DM Sans', sans-serif; font-size: 11px; color: #4a5568;
  }

  /* ── Contact filters ── */
  .dp-filters {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  }
  .dp-filter-btn {
    padding: 5px 12px; border-radius: 6px; border: 1px solid #252c38;
    background: transparent; color: #4a5568;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    cursor: pointer; transition: background 0.12s, color 0.12s;
  }
  .dp-filter-btn:hover         { background: #1a1f28; color: #e8edf5; }
  .dp-filter-btn--active        { background: #22c55e20; border-color: #22c55e40; color: #22c55e; }
  .dp-total-lbl {
    margin-left: auto; font-family: 'DM Sans', sans-serif; font-size: 12px; color: #4a5568;
  }

  /* ── Contact table ── */
  .dp-table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #1a1f28; }
  .dp-loading {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 24px; color: #22c55e; font-family: 'DM Sans', sans-serif; font-size: 13px;
  }
  .dp-table { width: 100%; border-collapse: collapse; font-family: 'DM Sans', sans-serif; font-size: 12px; }
  .dp-table th {
    text-align: left; padding: 9px 12px;
    background: #0f1215; color: #4a5568; font-weight: 600;
    border-bottom: 1px solid #1a1f28; white-space: nowrap;
  }
  .dp-table td {
    padding: 8px 12px; border-bottom: 1px solid #0f1215;
    color: #8a94a6; vertical-align: middle;
  }
  .dp-table tr:last-child td { border-bottom: none; }
  .dp-table tr:hover td { background: #0f121580; }

  .dp-phone { font-family: 'JetBrains Mono', monospace; color: #e8edf5 !important; }
  .dp-tpl   { color: #4a5568 !important; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dp-date  { white-space: nowrap; }
  .dp-err   { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ef444480 !important; }

  .dp-status {
    padding: 2px 8px; border-radius: 999px;
    font-size: 11px; font-weight: 600; white-space: nowrap;
  }

  /* ── Pagination ── */
  .dp-pagination {
    display: flex; align-items: center; justify-content: center; gap: 12px;
  }
  .dp-pg-btn {
    width: 28px; height: 28px; border-radius: 6px;
    background: #1a1f28; border: 1px solid #252c38;
    color: #8a94a6; font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .dp-pg-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .dp-pg-btn:hover:not(:disabled) { background: #252c38; color: #e8edf5; }
  .dp-pg-info { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #4a5568; }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .ht-row-right { flex-wrap: wrap; }
    .ht-counters  { gap: 8px; }
    .dp-stats     { gap: 8px; }
    .dp-stat-val  { font-size: 15px; }
  }
`
