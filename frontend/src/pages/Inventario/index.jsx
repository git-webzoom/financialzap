import { useEffect, useState, useMemo, useRef } from 'react'
import { useInventory } from '../../hooks/useInventory'
import * as inventoryService from '../../services/inventoryService'

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

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
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

const QUALITY_CFG = {
  GREEN:  { label: 'Verde',    color: '#22c55e', bg: '#22c55e18', border: '#22c55e35' },
  YELLOW: { label: 'Amarelo',  color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b35' },
  RED:    { label: 'Vermelho', color: '#ef4444', bg: '#ef444418', border: '#ef444435' },
}

const TIER_LABELS = {
  TIER_1: 'Tier 1 (1k/dia)',
  TIER_2: 'Tier 2 (10k/dia)',
  TIER_3: 'Tier 3 (100k/dia)',
  TIER_4: 'Tier 4 (ilimitado)',
}

const HEALTH_EVENT_CFG = {
  banned:      { label: 'Banido',        color: '#ef4444', icon: '🚫' },
  flagged:     { label: 'Flagado',       color: '#f59e0b', icon: '⚠' },
  tier_up:     { label: 'Tier Up',       color: '#22c55e', icon: '⬆' },
  tier_down:   { label: 'Tier Down',     color: '#f59e0b', icon: '⬇' },
  recovered:   { label: 'Recuperado',    color: '#22c55e', icon: '✓' },
  deactivated: { label: 'Desativado',    color: '#8a94a6', icon: '✕' },
  other:       { label: 'Outro',         color: '#8a94a6', icon: '•' },
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

function QualityBadge({ quality }) {
  if (!quality) return null
  const cfg = QUALITY_CFG[quality] ?? { label: quality, color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' }
  return (
    <span className="inv-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  )
}

function VolumeBadge({ total, limit }) {
  if (total === 0) return null
  const over = limit !== null && total > limit
  const color = over ? '#ef4444' : '#8a94a6'
  const bg    = over ? '#ef444418' : '#8a94a615'
  const border = over ? '#ef444435' : '#8a94a630'
  return (
    <span className="inv-badge" style={{ color, background: bg, borderColor: border }}>
      {over ? '⚠ ' : ''}{total.toLocaleString()}/dia
    </span>
  )
}

function AutoCount({ count }) {
  if (!count) return <span className="inv-dash">Nenhuma</span>
  return (
    <span className="inv-badge" style={{ color: '#8a94a6', background: '#8a94a615', borderColor: '#8a94a630' }}>
      {count} automação{count !== 1 ? 'ões' : ''}
    </span>
  )
}

// ─── Number form modal (create / edit) ───────────────────────────────────────

const EMPTY_FORM = {
  phone_number: '', origin: 'own', supplier: '', bm_name: '',
  waba_name: '', status: 'free', notes: '',
  quality_rating: '', messaging_limit_tier: '',
}

function NumberModal({ initial, onSave, onClose, onNumberUpdated }) {
  const [form, setForm]         = useState(initial ? { ...EMPTY_FORM, ...initial } : { ...EMPTY_FORM })
  const [saving, setSaving]     = useState(false)
  // createdNumber: after creation we stay open showing only the automations section
  const [createdNumber, setCreatedNumber] = useState(null)
  const [automations, setAutos] = useState(initial?.automations ?? [])
  const [showAddAuto, setShowAdd] = useState(false)
  const [editingAuto, setEditingAuto] = useState(null)
  const autoSectionRef = useRef(null)

  // The "effective" number for automation calls (either the passed `initial` or the just-created one)
  const effectiveNumber = createdNumber ?? initial
  const isEdit = !!effectiveNumber

  function field(key) {
    return (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = await onSave(form)
      if (!initial && saved) {
        // Creation — stay open, show automations section
        setCreatedNumber(saved)
        setAutos(saved.automations ?? [])
        // Scroll to automations section after render
        setTimeout(() => autoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      } else {
        onClose()
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateAuto(autoForm) {
    const auto = await inventoryService.createAutomation(effectiveNumber.id, autoForm)
    const updated = [...automations, auto]
    setAutos(updated)
    onNumberUpdated?.({ ...effectiveNumber, automations: updated })
    setShowAdd(false)
  }

  async function handleUpdateAuto(autoId, autoForm) {
    const auto = await inventoryService.updateAutomation(effectiveNumber.id, autoId, autoForm)
    const updated = automations.map(a => a.id === autoId ? auto : a)
    setAutos(updated)
    onNumberUpdated?.({ ...effectiveNumber, automations: updated })
    setEditingAuto(null)
  }

  async function handleDeleteAuto(autoId) {
    if (!window.confirm('Remover esta automação?')) return
    await inventoryService.deleteAutomation(effectiveNumber.id, autoId)
    const updated = automations.filter(a => a.id !== autoId)
    setAutos(updated)
    onNumberUpdated?.({ ...effectiveNumber, automations: updated })
  }

  return (
    <div className="inv-modal-backdrop" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <span>
            {createdNumber ? `Número registrado — ${createdNumber.phone_number}` : initial ? 'Editar número' : 'Registrar número'}
          </span>
          <button className="inv-icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <form className="inv-modal-form" onSubmit={handleSubmit}>
          {/* Banner de sucesso após criar — substitui os campos */}
          {createdNumber ? (
            <div className="inv-created-banner">
              ✓ Número <strong className="inv-mono">{createdNumber.phone_number}</strong> registrado com sucesso.
              Adicione as automações abaixo.
            </div>
          ) : (
            <>
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
              <div className="inv-form-2col">
                <div className="inv-form-row">
                  <label>Qualidade</label>
                  <select value={form.quality_rating || ''} onChange={field('quality_rating')}>
                    <option value="">— Não definido —</option>
                    <option value="GREEN">Verde</option>
                    <option value="YELLOW">Amarelo</option>
                    <option value="RED">Vermelho</option>
                  </select>
                </div>
                <div className="inv-form-row">
                  <label>Tier de limite</label>
                  <select value={form.messaging_limit_tier || ''} onChange={field('messaging_limit_tier')}>
                    <option value="">— Não definido —</option>
                    <option value="TIER_1">Tier 1 (1k/dia)</option>
                    <option value="TIER_2">Tier 2 (10k/dia)</option>
                    <option value="TIER_3">Tier 3 (100k/dia)</option>
                    <option value="TIER_4">Tier 4 (ilimitado)</option>
                  </select>
                </div>
              </div>
              <div className="inv-form-row">
                <label>Observações</label>
                <textarea value={form.notes || ''} onChange={field('notes')} rows={3} placeholder="Notas livres..." />
              </div>
            </>
          )}

          {/* Automations section — only when we have an ID (edit or just created) */}
          {isEdit && (
            <div className="inv-auto-section" ref={autoSectionRef}>
              <div className="inv-auto-section-header">
                <span>Automações ({automations.length})</span>
                {!showAddAuto && (
                  <button type="button" className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => setShowAdd(true)}>
                    <IconPlus /> Adicionar
                  </button>
                )}
              </div>

              {showAddAuto && (
                <AutoForm onSave={handleCreateAuto} onCancel={() => setShowAdd(false)} />
              )}

              {automations.length === 0 && !showAddAuto && (
                <div className="inv-empty-autos">Nenhuma automação registrada.</div>
              )}

              {automations.length > 0 && (
                <table className="auto-table">
                  <thead>
                    <tr>
                      <th>Automação</th>
                      <th>Template</th>
                      <th>Vol./dia</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automations.map(a => (
                      <>
                        <tr key={a.id} className="auto-row">
                          <td className="auto-td">{a.automation_name}</td>
                          <td className="auto-td auto-mono">{a.template_name || <span className="inv-dash">—</span>}</td>
                          <td className="auto-td">{a.daily_volume > 0 ? a.daily_volume.toLocaleString() : <span className="inv-dash">—</span>}</td>
                          <td className="auto-td">
                            <div className="inv-actions">
                              <button type="button" className="inv-icon-btn" onClick={() => setEditingAuto(editingAuto === a.id ? null : a.id)} title="Editar"><IconEdit /></button>
                              <button type="button" className="inv-icon-btn inv-icon-btn--danger" onClick={() => handleDeleteAuto(a.id)} title="Remover"><IconTrash /></button>
                            </div>
                          </td>
                        </tr>
                        {editingAuto === a.id && (
                          <tr key={`edit-${a.id}`}>
                            <td colSpan={4} className="auto-td-form">
                              <AutoForm initial={a} onSave={(f) => handleUpdateAuto(a.id, f)} onCancel={() => setEditingAuto(null)} />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {!createdNumber && (
            <div className="inv-modal-footer">
              <button type="button" className="inv-btn inv-btn--ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="inv-btn inv-btn--primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          )}
          {createdNumber && (
            <div className="inv-modal-footer">
              <button type="button" className="inv-btn inv-btn--primary" onClick={onClose}>Fechar</button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

// ─── Automation form (inline) ─────────────────────────────────────────────────

function AutoForm({ initial, onSave, onCancel }) {
  const [form, setForm]     = useState(initial
    ? { automation_name: initial.automation_name, template_name: initial.template_name || '', daily_volume: initial.daily_volume ?? 0 }
    : { automation_name: '', template_name: '', daily_volume: 0 }
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.automation_name.trim() || !form.template_name.trim()) return
    setSaving(true)
    try {
      await onSave({ ...form, daily_volume: Number(form.daily_volume) || 0 })
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="auto-form" onSubmit={handleSubmit}>
      <div className="auto-form-row3">
        <input
          className="auto-input"
          value={form.automation_name}
          onChange={e => setForm(f => ({ ...f, automation_name: e.target.value }))}
          placeholder="Nome da automação *"
          required
        />
        <input
          className="auto-input"
          value={form.template_name}
          onChange={e => setForm(f => ({ ...f, template_name: e.target.value }))}
          placeholder="Nome do template *"
          required
        />
        <input
          className="auto-input"
          type="number"
          min="0"
          value={form.daily_volume}
          onChange={e => setForm(f => ({ ...f, daily_volume: e.target.value }))}
          placeholder="Vol./dia"
        />
      </div>
      <div className="auto-form-btns">
        <button type="submit" className="inv-btn inv-btn--primary inv-btn--sm" disabled={saving || !form.automation_name.trim() || !form.template_name.trim()}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="inv-btn inv-btn--ghost inv-btn--sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

// ─── Health log form ──────────────────────────────────────────────────────────

function HealthLogForm({ onSave, onCancel }) {
  const [form, setForm]     = useState({ event_type: 'flagged', description: '', occurred_at: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="auto-form" onSubmit={handleSubmit}>
      <div className="inv-form-row">
        <label>Tipo de evento</label>
        <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
          <option value="banned">Banido</option>
          <option value="flagged">Flagado</option>
          <option value="tier_up">Tier Up</option>
          <option value="tier_down">Tier Down</option>
          <option value="recovered">Recuperado</option>
          <option value="deactivated">Desativado</option>
          <option value="other">Outro</option>
        </select>
      </div>
      <div className="inv-form-row">
        <label>Data/hora (opcional)</label>
        <input
          type="datetime-local"
          value={form.occurred_at}
          onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))}
        />
      </div>
      <div className="inv-form-row">
        <label>Descrição</label>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Detalhes do evento..." />
      </div>
      <div className="auto-form-btns">
        <button type="submit" className="inv-btn inv-btn--primary inv-btn--sm" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="inv-btn inv-btn--ghost inv-btn--sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ number: initialNumber, onClose, onNumberUpdated }) {
  const [number, setNumber]         = useState(initialNumber)
  const [automations, setAutos]     = useState(initialNumber.automations ?? [])
  const [editForm, setEditForm]     = useState({
    origin: initialNumber.origin, supplier: initialNumber.supplier || '',
    bm_name: initialNumber.bm_name || '', waba_name: initialNumber.waba_name || '',
    status: initialNumber.status, notes: initialNumber.notes || '',
    quality_rating: initialNumber.quality_rating || '',
    messaging_limit_tier: initialNumber.messaging_limit_tier || '',
  })
  const [saving, setSaving]           = useState(false)
  const [showAddAuto, setShowAdd]     = useState(false)
  const [editingAuto, setEditingAuto] = useState(null)

  // Health logs
  const [healthLogs, setHealthLogs]   = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [showAddLog, setShowAddLog]   = useState(false)

  useEffect(() => {
    inventoryService.listHealthLogs(initialNumber.id)
      .then(setHealthLogs)
      .catch(() => {})
      .finally(() => setLoadingLogs(false))
  }, [initialNumber.id])

  // Recalculate totals from live automations list
  const tierLimit = { TIER_1: 1000, TIER_2: 10000, TIER_3: 100000, TIER_4: null }[number.messaging_limit_tier] ?? null
  const totalVolume = automations.reduce((s, a) => s + (a.daily_volume ?? 0), 0)
  const volumePercent = tierLimit !== null ? Math.min(100, (totalVolume / tierLimit) * 100) : 0
  const volumeOver = tierLimit !== null && totalVolume > tierLimit

  function fieldEdit(key) {
    return (e) => setEditForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSaveNumber(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await inventoryService.updateNumber(number.id, editForm)
      setNumber(updated)
      onNumberUpdated(updated)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateAuto(form) {
    const auto = await inventoryService.createAutomation(number.id, form)
    setAutos(prev => [...prev, auto])
    onNumberUpdated({ ...number, automations: [...automations, auto] })
    setShowAdd(false)
  }

  async function handleUpdateAuto(autoId, form) {
    const auto = await inventoryService.updateAutomation(number.id, autoId, form)
    setAutos(prev => prev.map(a => a.id === autoId ? auto : a))
    setEditingAuto(null)
  }

  async function handleDeleteAuto(autoId) {
    if (!window.confirm('Remover esta automação?')) return
    await inventoryService.deleteAutomation(number.id, autoId)
    const updated = automations.filter(a => a.id !== autoId)
    setAutos(updated)
    onNumberUpdated({ ...number, automations: updated })
  }

  async function handleCreateLog(form) {
    const log = await inventoryService.createHealthLog(number.id, form)
    setHealthLogs(prev => [log, ...prev])
    setShowAddLog(false)
  }

  async function handleDeleteLog(logId) {
    if (!window.confirm('Remover este registro?')) return
    await inventoryService.deleteHealthLog(number.id, logId)
    setHealthLogs(prev => prev.filter(l => l.id !== logId))
  }

  function fmtDate(str) {
    if (!str) return '—'
    try {
      const d = new Date(str.includes('T') ? str : str + 'T00:00:00Z')
      return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return str }
  }

  return (
    <div className="inv-drawer-backdrop" onClick={onClose}>
      <div className="inv-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="inv-drawer-header">
          <button className="inv-icon-btn" onClick={onClose} title="Fechar"><IconChevronLeft /></button>
          <span className="inv-drawer-title inv-mono">{number.phone_number}</span>
          <OriginBadge origin={number.origin} />
        </div>

        <div className="inv-drawer-body">
          {/* ── Section: number data ── */}
          <div className="inv-drawer-section">
            <div className="inv-drawer-section-title">Dados do número</div>
            <form onSubmit={handleSaveNumber}>
              <div className="inv-form-2col">
                <div className="inv-form-row">
                  <label>Origem</label>
                  <select value={editForm.origin} onChange={fieldEdit('origin')}>
                    <option value="own">Próprio</option>
                    <option value="rented">Alugado</option>
                  </select>
                </div>
                <div className="inv-form-row">
                  <label>Status</label>
                  <select value={editForm.status} onChange={fieldEdit('status')}>
                    <option value="free">Livre</option>
                    <option value="in_use">Em uso</option>
                    <option value="reserved">Reservado</option>
                  </select>
                </div>
              </div>
              <div className="inv-form-2col" style={{ marginTop: 12 }}>
                <div className="inv-form-row">
                  <label>Qualidade</label>
                  <select value={editForm.quality_rating || ''} onChange={fieldEdit('quality_rating')}>
                    <option value="">— Não definido —</option>
                    <option value="GREEN">Verde</option>
                    <option value="YELLOW">Amarelo</option>
                    <option value="RED">Vermelho</option>
                  </select>
                </div>
                <div className="inv-form-row">
                  <label>Tier de limite</label>
                  <select value={editForm.messaging_limit_tier || ''} onChange={fieldEdit('messaging_limit_tier')}>
                    <option value="">— Não definido —</option>
                    <option value="TIER_1">Tier 1 (1k/dia)</option>
                    <option value="TIER_2">Tier 2 (10k/dia)</option>
                    <option value="TIER_3">Tier 3 (100k/dia)</option>
                    <option value="TIER_4">Tier 4 (ilimitado)</option>
                  </select>
                </div>
              </div>
              <div className="inv-form-row" style={{ marginTop: 12 }}>
                <label>Fornecedor</label>
                <input value={editForm.supplier} onChange={fieldEdit('supplier')} placeholder="Nome do fornecedor" />
              </div>
              <div className="inv-form-2col" style={{ marginTop: 12 }}>
                <div className="inv-form-row">
                  <label>BM</label>
                  <input value={editForm.bm_name} onChange={fieldEdit('bm_name')} placeholder="Nome da BM" />
                </div>
                <div className="inv-form-row">
                  <label>WABA</label>
                  <input value={editForm.waba_name} onChange={fieldEdit('waba_name')} placeholder="Nome da WABA" />
                </div>
              </div>
              <div className="inv-form-row" style={{ marginTop: 12 }}>
                <label>Observações</label>
                <textarea value={editForm.notes} onChange={fieldEdit('notes')} rows={2} placeholder="Notas livres..." />
              </div>
              <div style={{ marginTop: 14 }}>
                <button type="submit" className="inv-btn inv-btn--primary" disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Section: automations ── */}
          <div className="inv-drawer-section">
            <div className="inv-drawer-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Automações ({automations.length})</span>
              {!showAddAuto && (
                <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => setShowAdd(true)}>
                  <IconPlus /> Adicionar
                </button>
              )}
            </div>

            {/* Volume progress bar */}
            {automations.length > 0 && (
              <div className="inv-volume-bar-wrap">
                <div className="inv-volume-bar-labels">
                  <span style={{ color: volumeOver ? '#ef4444' : '#8a94a6' }}>
                    {volumeOver ? '⚠ ' : ''}{totalVolume.toLocaleString()} msg/dia
                  </span>
                  <span className="inv-volume-bar-limit">
                    {tierLimit !== null ? `limite: ${tierLimit.toLocaleString()}` : 'Tier 4 (ilimitado)'}
                  </span>
                </div>
                {tierLimit !== null && (
                  <div className="inv-volume-bar-bg">
                    <div
                      className="inv-volume-bar-fill"
                      style={{
                        width: `${volumePercent}%`,
                        background: volumeOver ? '#ef4444' : volumePercent > 80 ? '#f59e0b' : '#22c55e',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {showAddAuto && (
              <AutoForm onSave={handleCreateAuto} onCancel={() => setShowAdd(false)} />
            )}

            {automations.length === 0 && !showAddAuto && (
              <div className="inv-empty-autos">Nenhuma automação registrada.</div>
            )}

            {automations.length > 0 && (
              <table className="auto-table">
                <thead>
                  <tr>
                    <th>Automação</th>
                    <th>Template</th>
                    <th>Vol./dia</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {automations.map(a => (
                    <>
                      <tr key={a.id} className="auto-row">
                        <td className="auto-td">{a.automation_name}</td>
                        <td className="auto-td auto-mono">{a.template_name || <span className="inv-dash">—</span>}</td>
                        <td className="auto-td">{a.daily_volume > 0 ? a.daily_volume.toLocaleString() : <span className="inv-dash">—</span>}</td>
                        <td className="auto-td">
                          <div className="inv-actions">
                            <button className="inv-icon-btn" onClick={() => setEditingAuto(editingAuto === a.id ? null : a.id)} title="Editar"><IconEdit /></button>
                            <button className="inv-icon-btn inv-icon-btn--danger" onClick={() => handleDeleteAuto(a.id)} title="Remover"><IconTrash /></button>
                          </div>
                        </td>
                      </tr>
                      {editingAuto === a.id && (
                        <tr key={`edit-${a.id}`}>
                          <td colSpan={4} className="auto-td-form">
                            <AutoForm
                              initial={a}
                              onSave={(form) => handleUpdateAuto(a.id, form)}
                              onCancel={() => setEditingAuto(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Section: health logs ── */}
          <div className="inv-drawer-section">
            <div className="inv-drawer-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Histórico de saúde</span>
              {!showAddLog && (
                <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => setShowAddLog(true)}>
                  <IconPlus /> Registrar evento
                </button>
              )}
            </div>

            {showAddLog && (
              <HealthLogForm onSave={handleCreateLog} onCancel={() => setShowAddLog(false)} />
            )}

            {loadingLogs && <div className="inv-empty-autos">Carregando…</div>}

            {!loadingLogs && healthLogs.length === 0 && !showAddLog && (
              <div className="inv-empty-autos">Nenhum evento registrado.</div>
            )}

            {healthLogs.length > 0 && (
              <div className="inv-timeline">
                {healthLogs.map(log => {
                  const cfg = HEALTH_EVENT_CFG[log.event_type] ?? HEALTH_EVENT_CFG.other
                  return (
                    <div key={log.id} className="inv-timeline-item">
                      <div className="inv-timeline-dot" style={{ background: cfg.color }} />
                      <div className="inv-timeline-content">
                        <div className="inv-timeline-header">
                          <span className="inv-timeline-type" style={{ color: cfg.color }}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <span className="inv-timeline-date">{fmtDate(log.occurred_at)}</span>
                          <button className="inv-icon-btn inv-icon-btn--danger" style={{ width: 22, height: 22 }} onClick={() => handleDeleteLog(log.id)} title="Remover">
                            <IconX />
                          </button>
                        </div>
                        {log.description && (
                          <div className="inv-timeline-desc">{log.description}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Inventario() {
  const { numbers, loading, error, load, create, update, remove } = useInventory()
  const [editModal, setEditModal]   = useState(null)  // number being edited in simple modal
  const [detail, setDetail]         = useState(null)  // number open in drawer
  const [search, setSearch]         = useState('')
  const [filterStatus, setStatus]   = useState('')
  const [filterOrigin, setOrigin]   = useState('')

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = numbers
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        (n.phone_number || '').toLowerCase().includes(q) ||
        (n.bm_name || '').toLowerCase().includes(q) ||
        (n.waba_name || '').toLowerCase().includes(q) ||
        (n.supplier || '').toLowerCase().includes(q) ||
        (n.automations || []).some(a =>
          (a.automation_name || '').toLowerCase().includes(q) ||
          (a.template_name || '').toLowerCase().includes(q)
        )
      )
    }
    if (filterStatus) list = list.filter(n => n.status === filterStatus)
    if (filterOrigin) list = list.filter(n => n.origin === filterOrigin)
    return list
  }, [numbers, search, filterStatus, filterOrigin])

  async function handleCreate(form) {
    const saved = await create(form)
    return saved  // return so modal can switch to edit mode
  }

  async function handleEdit(form) {
    await update(editModal.id, form)
    setEditModal(null)
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover este número do inventário?')) return
    try { await remove(id) } catch (err) { alert(err.response?.data?.error || err.message) }
  }

  function handleNumberUpdated(updated) {
    load()
    if (detail?.id === updated.id) setDetail(updated)
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
          <button className="inv-btn inv-btn--primary" onClick={() => setEditModal('new')}>
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
            placeholder="Buscar por número, BM, WABA, automação…"
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
                <th>Qualidade</th>
                <th>Vol./dia</th>
                <th>Automações</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="inv-td-center">Carregando…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="inv-td-center">Nenhum número encontrado.</td></tr>
              )}
              {filtered.map(n => (
                <tr key={n.id} className="inv-row">
                  <td className="inv-td">
                    <button className="inv-phone-link inv-mono" onClick={() => setDetail(n)}>
                      {n.phone_number}
                    </button>
                  </td>
                  <td className="inv-td"><OriginBadge origin={n.origin} /></td>
                  <td className="inv-td">{n.supplier || <span className="inv-dash">—</span>}</td>
                  <td className="inv-td">{n.bm_name   || <span className="inv-dash">—</span>}</td>
                  <td className="inv-td">{n.waba_name || <span className="inv-dash">—</span>}</td>
                  <td className="inv-td"><QualityBadge quality={n.quality_rating} /></td>
                  <td className="inv-td"><VolumeBadge total={n.total_daily_volume ?? 0} limit={n.tier_limit} /></td>
                  <td className="inv-td"><AutoCount count={n.automations?.length ?? 0} /></td>
                  <td className="inv-td"><StatusBadge status={n.status} /></td>
                  <td className="inv-td">
                    <div className="inv-actions">
                      <button className="inv-icon-btn" onClick={() => setEditModal(n)} title="Editar dados"><IconEdit /></button>
                      <button className="inv-icon-btn inv-icon-btn--danger" onClick={() => handleDelete(n.id)} title="Remover"><IconTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple edit / create modal */}
      {editModal && (
        <NumberModal
          initial={editModal === 'new' ? null : editModal}
          onSave={editModal === 'new' ? handleCreate : handleEdit}
          onClose={() => { setEditModal(null); load() }}
          onNumberUpdated={handleNumberUpdated}
        />
      )}

      {/* Detail drawer */}
      {detail && (
        <DetailDrawer
          number={detail}
          onClose={() => setDetail(null)}
          onNumberUpdated={handleNumberUpdated}
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

  .inv-phone-link {
    background: none;
    border: none;
    color: #22c55e;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: #22c55e60;
    transition: color 0.15s;
  }
  .inv-phone-link:hover { color: #16a34a; }

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
  .inv-btn--sm { padding: 5px 10px; font-size: 12px; }

  .inv-error { background: #ef444415; border: 1px solid #ef444435; color: #ef4444; border-radius: 8px; padding: 10px 14px; font-size: 13px; }

  /* ── Number modal ── */
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
  .inv-form-row input:disabled,
  .inv-form-row select:disabled,
  .inv-form-row textarea:disabled { opacity: 0.5; cursor: default; }
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

  .inv-created-banner {
    background: #22c55e12;
    border: 1px solid #22c55e35;
    color: #22c55e;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.5;
  }

  /* Automations section inside modal */
  .inv-auto-section {
    border-top: 1px solid #1a2030;
    padding-top: 14px;
  }
  .inv-auto-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    color: #8a94a6;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
  }

  /* ── Detail drawer ── */
  .inv-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 900;
    display: flex;
    justify-content: flex-end;
  }
  .inv-drawer {
    width: 100%;
    max-width: 560px;
    background: #0f1215;
    border-left: 1px solid #252c38;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-shadow: -8px 0 32px rgba(0,0,0,0.5);
    animation: inv-slide-in 0.2s ease;
  }
  @keyframes inv-slide-in {
    from { transform: translateX(40px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  .inv-drawer-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid #1a2030;
    flex-shrink: 0;
  }
  .inv-drawer-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: #e8edf5;
  }
  .inv-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .inv-drawer-body::-webkit-scrollbar { width: 4px; }
  .inv-drawer-body::-webkit-scrollbar-thumb { background: #252c38; }
  .inv-drawer-section {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 10px;
    padding: 16px;
  }
  .inv-drawer-section-title {
    font-size: 12px;
    font-weight: 600;
    color: #8a94a6;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 14px;
  }

  /* Volume progress bar */
  .inv-volume-bar-wrap { margin-bottom: 12px; }
  .inv-volume-bar-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #8a94a6;
    margin-bottom: 5px;
  }
  .inv-volume-bar-limit { color: #4a5568; }
  .inv-volume-bar-bg {
    height: 6px;
    background: #1a2030;
    border-radius: 3px;
    overflow: hidden;
  }
  .inv-volume-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease, background 0.3s ease;
  }

  /* ── Automation table ── */
  .auto-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-top: 10px;
  }
  .auto-table th {
    color: #4a5568;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid #1a2030;
  }
  .auto-row:hover td { background: #1a1f28; }
  .auto-td {
    padding: 8px 10px;
    color: #c4cdd8;
    border-bottom: 1px solid #12161c;
    vertical-align: middle;
  }
  .auto-mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
  .auto-td-form {
    padding: 8px 10px;
    border-bottom: 1px solid #12161c;
    background: #0f1215;
  }

  .inv-empty-autos {
    font-size: 12px;
    color: #4a5568;
    padding: 12px 0 4px;
  }

  /* ── Automation inline form ── */
  .auto-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 8px;
    margin-top: 10px;
  }
  .auto-form-row3 {
    display: grid;
    grid-template-columns: 1fr 1fr 90px;
    gap: 8px;
  }
  .auto-input {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 6px;
    color: #e8edf5;
    font-size: 12px;
    font-family: inherit;
    padding: 7px 10px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }
  .auto-input:focus { border-color: #22c55e; }
  .auto-form-btns { display: flex; gap: 6px; }

  /* ── Health logs timeline ── */
  .inv-timeline { display: flex; flex-direction: column; gap: 0; margin-top: 6px; }
  .inv-timeline-item {
    display: flex;
    gap: 12px;
    position: relative;
    padding-bottom: 14px;
  }
  .inv-timeline-item:last-child { padding-bottom: 0; }
  .inv-timeline-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 14px;
    bottom: 0;
    width: 1px;
    background: #1a2030;
  }
  .inv-timeline-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 3px;
    box-shadow: 0 0 0 3px #141820;
  }
  .inv-timeline-content { flex: 1; min-width: 0; }
  .inv-timeline-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .inv-timeline-type {
    font-size: 12px;
    font-weight: 600;
  }
  .inv-timeline-date {
    font-size: 11px;
    color: #4a5568;
    margin-left: auto;
  }
  .inv-timeline-desc {
    font-size: 12px;
    color: #8a94a6;
    margin-top: 4px;
    line-height: 1.5;
  }
`
