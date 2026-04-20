import { useEffect, useState, useMemo } from 'react'
import { useRegua } from '../../hooks/useRegua'

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
function IconChevron({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <path d="M2 4.5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconGroup() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="5" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="8" y="3" width="5" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  )
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  ativo:    { label: 'Ativo',    color: '#22c55e', bg: '#22c55e18', border: '#22c55e40' },
  pausado:  { label: 'Pausado',  color: '#ef4444', bg: '#ef444418', border: '#ef444440' },
  agendado: { label: 'Agendado', color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b40' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' }
  return (
    <span className="rg-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      <span className="rg-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ resumo }) {
  const cards = [
    { label: 'Total de Registros', value: resumo.total,          color: '#3b82f6', bg: '#3b82f618', border: '#3b82f635' },
    { label: 'Ativos',             value: resumo.ativos,         color: '#22c55e', bg: '#22c55e18', border: '#22c55e35' },
    { label: 'Pausados',           value: resumo.pausados,       color: '#ef4444', bg: '#ef444418', border: '#ef444435' },
    { label: 'Registros Hoje',     value: resumo.registros_hoje, color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b35' },
  ]
  return (
    <div className="rg-cards">
      {cards.map(c => (
        <div key={c.label} className="rg-card" style={{ borderColor: c.border, background: c.bg }}>
          <span className="rg-card-value" style={{ color: c.color }}>{c.value}</span>
          <span className="rg-card-label">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Registro Form ────────────────────────────────────────────────────────────

const EMPTY_REGISTRO = { grupo_id: '', data_disparo: '', regua: '', status: 'ativo', responsavel: '', observacao: '' }

function RegistroForm({ initial, grupos, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial ? {
    grupo_id:     initial.grupo_id     ?? '',
    data_disparo: initial.data_disparo ?? '',
    regua:        initial.regua        ?? '',
    status:       initial.status       ?? 'ativo',
    responsavel:  initial.responsavel  ?? '',
    observacao:   initial.observacao   ?? '',
  } : { ...EMPTY_REGISTRO })

  function field(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  const canSave = form.grupo_id && form.data_disparo && form.regua.trim()

  return (
    <div className="rg-form">
      <div className="rg-form-grid">
        <div className="rg-form-row">
          <label>Data do disparo *</label>
          <input type="date" value={form.data_disparo} onChange={field('data_disparo')} />
        </div>
        <div className="rg-form-row">
          <label>Grupo *</label>
          <select value={form.grupo_id} onChange={field('grupo_id')}>
            <option value="">— Selecione —</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div className="rg-form-row">
          <label>Status</label>
          <select value={form.status} onChange={field('status')}>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="agendado">Agendado</option>
          </select>
        </div>
        <div className="rg-form-row">
          <label>Responsável</label>
          <input value={form.responsavel} onChange={field('responsavel')} placeholder="Nome do responsável" />
        </div>
      </div>
      <div className="rg-form-row">
        <label>Régua de disparo *</label>
        <textarea value={form.regua} onChange={field('regua')} rows={3} placeholder="Descreva a sequência, horários, mensagens, configurações..." />
      </div>
      <div className="rg-form-row">
        <label>Observação</label>
        <input value={form.observacao} onChange={field('observacao')} placeholder="Motivo de pausa, ajuste de estratégia, etc." />
      </div>
      <div className="rg-form-btns">
        <button type="button" className="rg-btn rg-btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="rg-btn rg-btn--primary" disabled={saving || !canSave} onClick={() => onSave(form)}>
          {saving ? 'Salvando…' : initial ? 'Atualizar' : 'Registrar'}
        </button>
      </div>
    </div>
  )
}

// ─── Grupo Modal ──────────────────────────────────────────────────────────────

function GrupoModal({ grupos, onCriar, onExcluir, onClose }) {
  const [form, setForm]   = useState({ nome: '', descricao: '' })
  const [saving, setSaving] = useState(false)

  async function handleCriar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      await onCriar(form)
      setForm({ nome: '', descricao: '' })
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleExcluir(id) {
    if (!window.confirm('Excluir este grupo? Só é possível se não houver registros vinculados.')) return
    try { await onExcluir(id) }
    catch (err) { alert(err.response?.data?.error || err.message) }
  }

  return (
    <div className="rg-backdrop" onClick={onClose}>
      <div className="rg-modal" onClick={e => e.stopPropagation()}>
        <div className="rg-modal-header">
          <span>Gerenciar Grupos</span>
          <button className="rg-icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="rg-modal-body">
          <div className="rg-grupo-form">
            <input
              className="rg-grupo-input"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Nome do grupo *"
              onKeyDown={e => e.key === 'Enter' && handleCriar()}
            />
            <input
              className="rg-grupo-input"
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descrição (opcional)"
            />
            <button type="button" className="rg-btn rg-btn--primary" disabled={saving || !form.nome.trim()} onClick={handleCriar}>
              {saving ? '…' : <><IconPlus /> Criar</>}
            </button>
          </div>

          {grupos.length === 0 && (
            <div className="rg-empty">Nenhum grupo cadastrado.</div>
          )}
          <div className="rg-grupo-list">
            {grupos.map(g => (
              <div key={g.id} className="rg-grupo-item">
                <div className="rg-grupo-info">
                  <span className="rg-grupo-nome">{g.nome}</span>
                  {g.descricao && <span className="rg-grupo-desc">{g.descricao}</span>}
                  <span className="rg-grupo-count">{g.total_registros ?? 0} registro{g.total_registros !== 1 ? 's' : ''}</span>
                </div>
                <button
                  className="rg-icon-btn rg-icon-btn--danger"
                  onClick={() => handleExcluir(g.id)}
                  title={g.total_registros > 0 ? 'Remova os registros antes de excluir' : 'Excluir grupo'}
                  disabled={Number(g.total_registros) > 0}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tabela de registros ──────────────────────────────────────────────────────

function ReguaTable({ registros, onEditar, onExcluir }) {
  if (registros.length === 0) {
    return <div className="rg-empty">Nenhum registro encontrado.</div>
  }
  function fmtData(str) {
    if (!str) return '—'
    const [y, m, d] = str.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="rg-table-wrap">
      <table className="rg-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Grupo</th>
            <th>Régua</th>
            <th>Status</th>
            <th>Responsável</th>
            <th>Observação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {registros.map(r => (
            <tr key={r.id} className="rg-row">
              <td className="rg-td rg-td--date">{fmtData(r.data_disparo)}</td>
              <td className="rg-td"><span className="rg-grupo-tag">{r.grupo_nome}</span></td>
              <td className="rg-td rg-td--regua">{r.regua}</td>
              <td className="rg-td"><StatusBadge status={r.status} /></td>
              <td className="rg-td">{r.responsavel || <span className="rg-dash">—</span>}</td>
              <td className="rg-td rg-td--obs">{r.observacao || <span className="rg-dash">—</span>}</td>
              <td className="rg-td">
                <div className="rg-actions">
                  <button className="rg-icon-btn" onClick={() => onEditar(r)} title="Editar"><IconEdit /></button>
                  <button className="rg-icon-btn rg-icon-btn--danger" onClick={() => onExcluir(r.id)} title="Excluir"><IconTrash /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReguaDisparos() {
  const {
    grupos, registros, resumo, loading, error,
    fetchGrupos, criarGrupo, excluirGrupo,
    fetchRegistros, criarRegistro, editarRegistro, excluirRegistro,
    fetchResumo,
  } = useRegua()

  const [showGrupos,    setShowGrupos]    = useState(false)
  const [showForm,      setShowForm]      = useState(false)
  const [editando,      setEditando]      = useState(null)   // registro sendo editado
  const [saving,        setSaving]        = useState(false)

  // Filtros
  const [filtroData,   setFiltroData]   = useState('')
  const [filtroTexto,  setFiltroTexto]  = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  useEffect(() => {
    fetchGrupos()
    fetchRegistros()
    fetchResumo()
  }, [fetchGrupos, fetchRegistros, fetchResumo])

  const filtrados = useMemo(() => {
    let list = registros
    if (filtroData)   list = list.filter(r => r.data_disparo === filtroData)
    if (filtroStatus) list = list.filter(r => r.status === filtroStatus)
    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase()
      list = list.filter(r =>
        (r.grupo_nome    || '').toLowerCase().includes(q) ||
        (r.regua         || '').toLowerCase().includes(q) ||
        (r.responsavel   || '').toLowerCase().includes(q) ||
        (r.observacao    || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [registros, filtroData, filtroTexto, filtroStatus])

  async function handleSalvar(form) {
    setSaving(true)
    try {
      if (editando) {
        await editarRegistro(editando.id, form)
        setEditando(null)
      } else {
        await criarRegistro(form)
        setShowForm(false)
      }
      fetchResumo()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleExcluir(id) {
    if (!window.confirm('Excluir este registro?')) return
    try {
      await excluirRegistro(id)
      fetchResumo()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  return (
    <>
      <style>{CSS_STR}</style>
      <div className="page-root">

        {/* Topbar */}
        <div className="rg-topbar">
          <div>
            <h1 className="rg-page-title">Régua de Disparos</h1>
            <p className="rg-page-sub">Auditoria e acompanhamento diário dos disparos por grupo</p>
          </div>
          <div className="rg-topbar-actions">
            <button className="rg-btn rg-btn--ghost" onClick={() => setShowGrupos(true)}>
              <IconGroup /> Gerenciar Grupos
            </button>
            <button className="rg-btn rg-btn--primary" onClick={() => { setShowForm(f => !f); setEditando(null) }}>
              <IconPlus /> Registrar disparo
              <IconChevron open={showForm} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards resumo={resumo} />

        {/* Inline form — novo registro */}
        {showForm && !editando && (
          <div className="rg-inline-form">
            <div className="rg-inline-form-title">Novo registro</div>
            <RegistroForm
              grupos={grupos}
              onSave={handleSalvar}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
          </div>
        )}

        {/* Inline form — editar */}
        {editando && (
          <div className="rg-inline-form">
            <div className="rg-inline-form-title">Editar registro</div>
            <RegistroForm
              initial={editando}
              grupos={grupos}
              onSave={handleSalvar}
              onCancel={() => setEditando(null)}
              saving={saving}
            />
          </div>
        )}

        {/* Filtros */}
        <div className="rg-filters">
          <input
            type="date"
            className="rg-filter-date"
            value={filtroData}
            onChange={e => setFiltroData(e.target.value)}
            title="Filtrar por data"
          />
          {filtroData && (
            <button className="rg-filter-clear" onClick={() => setFiltroData('')} title="Limpar data">
              <IconX />
            </button>
          )}
          <input
            className="rg-search"
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            placeholder="Buscar por grupo, régua, responsável…"
          />
          <select className="rg-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="agendado">Agendado</option>
          </select>
          <span className="rg-count">{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</span>
        </div>

        {error && <div className="rg-error">⚠ {error}</div>}

        {/* Tabela */}
        {loading ? (
          <div className="rg-loading">Carregando…</div>
        ) : (
          <ReguaTable
            registros={filtrados}
            onEditar={r => { setEditando(r); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            onExcluir={handleExcluir}
          />
        )}
      </div>

      {/* Modal de grupos */}
      {showGrupos && (
        <GrupoModal
          grupos={grupos}
          onCriar={criarGrupo}
          onExcluir={excluirGrupo}
          onClose={() => setShowGrupos(false)}
        />
      )}
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS_STR = `
  .rg-topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .rg-page-title { font-size: 20px; font-weight: 600; color: #e8edf5; }
  .rg-page-sub   { font-size: 13px; color: #8a94a6; margin-top: 2px; }
  .rg-topbar-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

  /* ── Cards ── */
  .rg-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  @media (max-width: 900px) { .rg-cards { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 500px) { .rg-cards { grid-template-columns: 1fr; } }

  .rg-card {
    border: 1px solid;
    border-radius: 10px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .rg-card-value { font-size: 28px; font-weight: 700; line-height: 1; }
  .rg-card-label { font-size: 12px; color: #8a94a6; }

  /* ── Filtros ── */
  .rg-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    position: relative;
  }
  .rg-filter-date,
  .rg-search,
  .rg-select {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #e8edf5;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 12px;
    outline: none;
    transition: border-color 0.15s;
  }
  .rg-filter-date:focus,
  .rg-search:focus,
  .rg-select:focus { border-color: #22c55e; }
  .rg-search { flex: 1; min-width: 220px; }
  .rg-select { cursor: pointer; }
  .rg-filter-clear {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; background: none; border: none;
    color: #4a5568; cursor: pointer; margin-left: -4px;
    transition: color 0.12s; flex-shrink: 0;
  }
  .rg-filter-clear:hover { color: #8a94a6; }
  .rg-count { font-size: 12px; color: #22c55e; white-space: nowrap; }

  /* ── Inline form panel ── */
  .rg-inline-form {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 12px;
    padding: 18px 20px;
  }
  .rg-inline-form-title {
    font-size: 13px;
    font-weight: 600;
    color: #e8edf5;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #1a2030;
  }

  /* ── Form ── */
  .rg-form { display: flex; flex-direction: column; gap: 12px; }
  .rg-form-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  @media (max-width: 900px) { .rg-form-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 500px) { .rg-form-grid { grid-template-columns: 1fr; } }

  .rg-form-row { display: flex; flex-direction: column; gap: 5px; }
  .rg-form-row label { font-size: 11px; color: #8a94a6; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
  .rg-form-row input,
  .rg-form-row select,
  .rg-form-row textarea {
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
  .rg-form-row input:focus,
  .rg-form-row select:focus,
  .rg-form-row textarea:focus { border-color: #22c55e; }
  .rg-form-btns { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

  /* ── Tabela ── */
  .rg-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #252c38; }
  .rg-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .rg-table th {
    background: #0f1215;
    color: #4a5568;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    padding: 10px 14px;
    text-align: left;
    border-bottom: 1px solid #1a2030;
    white-space: nowrap;
  }
  .rg-row:hover td { background: #141820; }
  .rg-td {
    padding: 10px 14px;
    color: #c4cdd8;
    border-bottom: 1px solid #12161c;
    vertical-align: top;
  }
  .rg-td--date { white-space: nowrap; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8a94a6; }
  .rg-td--regua { max-width: 280px; word-break: break-word; line-height: 1.5; }
  .rg-td--obs { max-width: 180px; font-size: 12px; color: #8a94a6; word-break: break-word; }
  .rg-actions { display: flex; gap: 4px; }
  .rg-dash { color: #4a5568; }

  .rg-grupo-tag {
    display: inline-block;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 5px;
    font-size: 11px;
    color: #8a94a6;
    padding: 2px 8px;
    white-space: nowrap;
  }

  /* ── Badge ── */
  .rg-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 20px;
    border: 1px solid;
    white-space: nowrap;
  }
  .rg-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }

  /* ── Botões ── */
  .rg-btn {
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
  .rg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .rg-btn--primary { background: #22c55e; color: #0a0c0f; }
  .rg-btn--primary:hover:not(:disabled) { background: #16a34a; }
  .rg-btn--ghost { background: #1a1f28; color: #8a94a6; border: 1px solid #252c38; }
  .rg-btn--ghost:hover:not(:disabled) { color: #e8edf5; border-color: #374151; }

  .rg-icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 6px; border: none;
    background: none; color: #4a5568; cursor: pointer;
    transition: color 0.15s, background 0.15s; padding: 0;
  }
  .rg-icon-btn:hover { color: #8a94a6; background: #1a1f28; }
  .rg-icon-btn--danger:hover { color: #ef4444; background: #ef444415; }
  .rg-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .rg-icon-btn:disabled:hover { color: #4a5568; background: none; }

  /* ── Modal de grupos ── */
  .rg-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 16px;
  }
  .rg-modal {
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 14px;
    width: 100%; max-width: 480px;
    max-height: 80vh; overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  }
  .rg-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 14px;
    border-bottom: 1px solid #1a2030;
    font-size: 15px; font-weight: 600; color: #e8edf5;
  }
  .rg-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }

  .rg-grupo-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .rg-grupo-input {
    flex: 1; min-width: 120px;
    background: #1a1f28; border: 1px solid #252c38; border-radius: 7px;
    color: #e8edf5; font-size: 13px; font-family: inherit;
    padding: 8px 11px; outline: none; transition: border-color 0.15s;
  }
  .rg-grupo-input:focus { border-color: #22c55e; }

  .rg-grupo-list { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
  .rg-grupo-item {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    background: #141820; border: 1px solid #252c38; border-radius: 8px;
    padding: 10px 12px;
  }
  .rg-grupo-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .rg-grupo-nome { font-size: 13px; font-weight: 600; color: #e8edf5; }
  .rg-grupo-desc { font-size: 11px; color: #8a94a6; }
  .rg-grupo-count { font-size: 10px; color: #4a5568; }

  /* ── Estados ── */
  .rg-empty   { color: #4a5568; font-size: 13px; padding: 32px 0; text-align: center; }
  .rg-loading { color: #4a5568; font-size: 13px; padding: 40px 0; }
  .rg-error   { background: #ef444415; border: 1px solid #ef444435; color: #ef4444; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
`
