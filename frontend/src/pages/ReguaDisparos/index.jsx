import { useEffect, useState } from 'react'
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
function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Status / tipo configs ────────────────────────────────────────────────────

const STATUS_CFG = {
  ativo:    { label: 'Ativo',    color: '#22c55e', bg: '#22c55e18', border: '#22c55e40' },
  pausado:  { label: 'Pausado',  color: '#ef4444', bg: '#ef444418', border: '#ef444440' },
  agendado: { label: 'Agendado', color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b40' },
}

const TIPO_CFG = {
  recorrente: { label: 'Recorrente', color: '#3b82f6', bg: '#3b82f618', border: '#3b82f640' },
  avulso:     { label: 'Avulso',     color: '#a855f7', bg: '#a855f718', border: '#a855f740' },
}

const DIA_LABELS = {
  domingo: 'Domingo', segunda: 'Segunda', terca: 'Terça',
  quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado',
}
const DIAS_OPTIONS = Object.entries(DIA_LABELS)

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' }
  return (
    <span className="rg-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      <span className="rg-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }) {
  const cfg = TIPO_CFG[tipo] ?? TIPO_CFG.recorrente
  return (
    <span className="rg-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ resumo }) {
  const cards = [
    { label: 'Total de Grupos',     value: resumo.total_grupos,      color: '#3b82f6', bg: '#3b82f618', border: '#3b82f635' },
    { label: 'Total de Disparos',   value: resumo.total_disparos,    color: '#8a94a6', bg: '#8a94a615', border: '#8a94a630' },
    { label: 'Disparos Ativos',     value: resumo.disparos_ativos,   color: '#22c55e', bg: '#22c55e18', border: '#22c55e35' },
    { label: 'Disparos Pausados',   value: resumo.disparos_pausados, color: '#ef4444', bg: '#ef444418', border: '#ef444435' },
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

// ─── GrupoForm (modal inline) ─────────────────────────────────────────────────

function GrupoModal({ onCriar, onClose }) {
  const [form, setForm]     = useState({ nome: '', descricao: '' })
  const [saving, setSaving] = useState(false)

  async function handleCriar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      await onCriar(form)
      onClose()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rg-backdrop" onClick={onClose}>
      <div className="rg-modal" onClick={e => e.stopPropagation()}>
        <div className="rg-modal-header">
          <span>Novo Grupo</span>
          <button className="rg-icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="rg-modal-body">
          <div className="rg-form-row">
            <label>Nome *</label>
            <input
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Nome do grupo"
              onKeyDown={e => e.key === 'Enter' && handleCriar()}
              autoFocus
            />
          </div>
          <div className="rg-form-row">
            <label>Descrição</label>
            <input
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descrição opcional"
            />
          </div>
          <div className="rg-form-btns">
            <button className="rg-btn rg-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="rg-btn rg-btn--primary" disabled={saving || !form.nome.trim()} onClick={handleCriar}>
              {saving ? 'Criando…' : 'Criar grupo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── GrupoCard ────────────────────────────────────────────────────────────────

function GrupoCard({ grupo, onSelecionar, onExcluir }) {
  const [excluindo, setExcluindo] = useState(false)
  const ativos  = Number(grupo.disparos_ativos)  || 0
  const total   = Number(grupo.total_disparos)   || 0
  const bloqueado = total > 0

  async function handleExcluir(e) {
    e.stopPropagation()
    if (!window.confirm(`Excluir o grupo "${grupo.nome}"? Só é possível se não houver disparos vinculados.`)) return
    setExcluindo(true)
    try {
      await onExcluir(grupo.id)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className="rg-grupo-card">
      <div className="rg-grupo-card-body" onClick={() => onSelecionar(grupo)}>
        <div className="rg-grupo-card-nome">{grupo.nome}</div>
        {grupo.descricao && <div className="rg-grupo-card-desc">{grupo.descricao}</div>}
        <div className="rg-grupo-card-stats">
          <span className="rg-grupo-stat rg-grupo-stat--green">
            <span className="rg-dot" style={{ background: '#22c55e' }} />
            {ativos} ativo{ativos !== 1 ? 's' : ''}
          </span>
          <span className="rg-grupo-stat">
            {total} disparo{total !== 1 ? 's' : ''} no total
          </span>
        </div>
      </div>
      <div className="rg-grupo-card-footer">
        <button className="rg-btn rg-btn--primary rg-btn--sm" onClick={() => onSelecionar(grupo)}>
          Ver régua →
        </button>
        <button
          className="rg-icon-btn rg-icon-btn--danger"
          onClick={handleExcluir}
          disabled={excluindo || bloqueado}
          title={bloqueado ? 'Remova os disparos antes de excluir' : 'Excluir grupo'}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  )
}

// ─── DisparoForm ──────────────────────────────────────────────────────────────

const EMPTY_DISPARO = { nome: '', tipo: 'recorrente', dia_semana: 'domingo', data_fixa: '', horario: '', status: 'ativo', responsavel: '', observacao: '' }

function DisparoForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial ? {
    nome:        initial.nome        ?? '',
    tipo:        initial.tipo        ?? 'recorrente',
    dia_semana:  initial.dia_semana  ?? 'domingo',
    data_fixa:   initial.data_fixa   ?? '',
    horario:     initial.horario     ?? '',
    status:      initial.status      ?? 'ativo',
    responsavel: initial.responsavel ?? '',
    observacao:  initial.observacao  ?? '',
  } : { ...EMPTY_DISPARO })

  function field(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  const canSave = form.nome.trim() && form.horario &&
    (form.tipo === 'recorrente' ? !!form.dia_semana : !!form.data_fixa)

  return (
    <div className="rg-form">
      <div className="rg-form-grid rg-form-grid--3">
        <div className="rg-form-row">
          <label>Nome do disparo *</label>
          <input value={form.nome} onChange={field('nome')} placeholder="Ex: Disparo Domingo Manhã" />
        </div>
        <div className="rg-form-row">
          <label>Tipo *</label>
          <select value={form.tipo} onChange={field('tipo')}>
            <option value="recorrente">Recorrente (toda semana)</option>
            <option value="avulso">Avulso (data específica)</option>
          </select>
        </div>
        <div className="rg-form-row">
          <label>Horário *</label>
          <input type="time" value={form.horario} onChange={field('horario')} />
        </div>
      </div>

      <div className="rg-form-grid rg-form-grid--4">
        {form.tipo === 'recorrente' ? (
          <div className="rg-form-row">
            <label>Dia da semana *</label>
            <select value={form.dia_semana} onChange={field('dia_semana')}>
              {DIAS_OPTIONS.map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rg-form-row">
            <label>Data *</label>
            <input type="date" value={form.data_fixa} onChange={field('data_fixa')} />
          </div>
        )}
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
        <div className="rg-form-row">
          <label>Observação</label>
          <input value={form.observacao} onChange={field('observacao')} placeholder="Observação opcional" />
        </div>
      </div>

      <div className="rg-form-btns">
        <button type="button" className="rg-btn rg-btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="rg-btn rg-btn--primary" disabled={saving || !canSave} onClick={() => onSave(form)}>
          {saving ? 'Salvando…' : initial ? 'Atualizar' : 'Adicionar disparo'}
        </button>
      </div>
    </div>
  )
}

// ─── DisparosTable ────────────────────────────────────────────────────────────

function DisparosTable({ disparos, onEditar, onExcluir }) {
  function fmtData(str) {
    if (!str) return '—'
    const [y, m, d] = str.split('-')
    return `${d}/${m}/${y}`
  }

  if (disparos.length === 0) {
    return (
      <div className="rg-empty">
        <div>Nenhum disparo configurado para este grupo.</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#4a5568' }}>Clique em "Adicionar disparo" para começar.</div>
      </div>
    )
  }

  return (
    <div className="rg-table-wrap">
      <table className="rg-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Quando</th>
            <th>Horário</th>
            <th>Status</th>
            <th>Responsável</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {disparos.map(d => (
            <tr key={d.id} className="rg-row">
              <td className="rg-td rg-td--nome">{d.nome}</td>
              <td className="rg-td"><TipoBadge tipo={d.tipo} /></td>
              <td className="rg-td rg-td--quando">
                {d.tipo === 'recorrente'
                  ? (DIA_LABELS[d.dia_semana] ?? d.dia_semana)
                  : fmtData(d.data_fixa)
                }
              </td>
              <td className="rg-td rg-td--horario">{d.horario}</td>
              <td className="rg-td"><StatusBadge status={d.status} /></td>
              <td className="rg-td">{d.responsavel || <span className="rg-dash">—</span>}</td>
              <td className="rg-td">
                <div className="rg-actions">
                  <button className="rg-icon-btn" onClick={() => onEditar(d)} title="Editar"><IconEdit /></button>
                  <button className="rg-icon-btn rg-icon-btn--danger" onClick={() => onExcluir(d.id)} title="Excluir"><IconTrash /></button>
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
    grupos, grupoSelecionado, disparos, resumo, loading, error,
    fetchGrupos, criarGrupo, excluirGrupo, selecionarGrupo,
    criarDisparo, editarDisparo, excluirDisparo,
    fetchResumo, setGrupoSelecionado,
  } = useRegua()

  const [showGrupoModal, setShowGrupoModal] = useState(false)
  const [showForm,       setShowForm]       = useState(false)
  const [editando,       setEditando]       = useState(null)
  const [saving,         setSaving]         = useState(false)

  useEffect(() => {
    fetchGrupos()
    fetchResumo()
  }, [fetchGrupos, fetchResumo])

  async function handleSalvarDisparo(form) {
    setSaving(true)
    try {
      if (editando) {
        await editarDisparo(editando.id, form)
        setEditando(null)
      } else {
        await criarDisparo(grupoSelecionado.id, form)
        setShowForm(false)
      }
      fetchResumo()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleExcluirDisparo(id) {
    if (!window.confirm('Excluir este disparo?')) return
    try {
      await excluirDisparo(id)
      fetchResumo()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  function handleVoltar() {
    setGrupoSelecionado(null)
    setShowForm(false)
    setEditando(null)
  }

  function handleEditar(disparo) {
    setEditando(disparo)
    setShowForm(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Estado 2: Régua do grupo selecionado ──
  if (grupoSelecionado) {
    return (
      <>
        <style>{CSS_STR}</style>
        <div className="page-root">

          {/* Breadcrumb / voltar */}
          <div className="rg-breadcrumb">
            <button className="rg-btn rg-btn--ghost rg-btn--sm" onClick={handleVoltar}>
              <IconArrowLeft /> Grupos
            </button>
            <span className="rg-breadcrumb-sep">/</span>
            <span className="rg-breadcrumb-current">{grupoSelecionado.nome}</span>
          </div>

          {/* Header do grupo */}
          <div className="rg-topbar">
            <div>
              <h1 className="rg-page-title">{grupoSelecionado.nome}</h1>
              {grupoSelecionado.descricao && (
                <p className="rg-page-sub">{grupoSelecionado.descricao}</p>
              )}
            </div>
            <button
              className="rg-btn rg-btn--primary"
              onClick={() => { setShowForm(f => !f); setEditando(null) }}
            >
              <IconPlus /> Adicionar disparo
            </button>
          </div>

          {/* Formulário inline — novo disparo */}
          {showForm && !editando && (
            <div className="rg-inline-form">
              <div className="rg-inline-form-title">Novo disparo</div>
              <DisparoForm
                onSave={handleSalvarDisparo}
                onCancel={() => setShowForm(false)}
                saving={saving}
              />
            </div>
          )}

          {/* Formulário inline — editar */}
          {editando && (
            <div className="rg-inline-form">
              <div className="rg-inline-form-title">Editar disparo</div>
              <DisparoForm
                initial={editando}
                onSave={handleSalvarDisparo}
                onCancel={() => setEditando(null)}
                saving={saving}
              />
            </div>
          )}

          {error && <div className="rg-error">⚠ {error}</div>}

          {/* Tabela de disparos */}
          {loading ? (
            <div className="rg-loading">Carregando…</div>
          ) : (
            <DisparosTable
              disparos={disparos}
              onEditar={handleEditar}
              onExcluir={handleExcluirDisparo}
            />
          )}
        </div>
      </>
    )
  }

  // ── Estado 1: Visão geral de grupos ──
  return (
    <>
      <style>{CSS_STR}</style>
      <div className="page-root">

        {/* Topbar */}
        <div className="rg-topbar">
          <div>
            <h1 className="rg-page-title">Régua de Disparos</h1>
            <p className="rg-page-sub">Gerencie os disparos recorrentes e avulsos por grupo</p>
          </div>
          <button className="rg-btn rg-btn--primary" onClick={() => setShowGrupoModal(true)}>
            <IconPlus /> Novo grupo
          </button>
        </div>

        {/* Summary Cards */}
        <SummaryCards resumo={resumo} />

        {error && <div className="rg-error">⚠ {error}</div>}

        {/* Grid de grupos */}
        {grupos.length === 0 ? (
          <div className="rg-empty-state">
            <div className="rg-empty-state-icon">📋</div>
            <div className="rg-empty-state-title">Nenhum grupo criado</div>
            <div className="rg-empty-state-sub">Crie um grupo para começar a configurar sua régua de disparos.</div>
            <button className="rg-btn rg-btn--primary" onClick={() => setShowGrupoModal(true)}>
              <IconPlus /> Criar primeiro grupo
            </button>
          </div>
        ) : (
          <div className="rg-grupos-grid">
            {grupos.map(g => (
              <GrupoCard
                key={g.id}
                grupo={g}
                onSelecionar={selecionarGrupo}
                onExcluir={excluirGrupo}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal novo grupo */}
      {showGrupoModal && (
        <GrupoModal
          onCriar={async (payload) => {
            const g = await criarGrupo(payload)
            fetchResumo()
            return g
          }}
          onClose={() => setShowGrupoModal(false)}
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

  /* ── Breadcrumb ── */
  .rg-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #8a94a6;
    margin-bottom: -4px;
  }
  .rg-breadcrumb-sep     { color: #4a5568; }
  .rg-breadcrumb-current { color: #e8edf5; font-weight: 500; }

  /* ── Cards de resumo ── */
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

  /* ── Grid de grupos ── */
  .rg-grupos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }

  .rg-grupo-card {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    transition: border-color 0.15s;
    overflow: hidden;
  }
  .rg-grupo-card:hover { border-color: #374151; }

  .rg-grupo-card-body {
    padding: 16px 16px 12px;
    flex: 1;
    cursor: pointer;
  }
  .rg-grupo-card-nome {
    font-size: 15px;
    font-weight: 600;
    color: #e8edf5;
    margin-bottom: 4px;
  }
  .rg-grupo-card-desc {
    font-size: 12px;
    color: #8a94a6;
    margin-bottom: 10px;
    line-height: 1.4;
  }
  .rg-grupo-card-stats {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .rg-grupo-stat {
    font-size: 12px;
    color: #4a5568;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .rg-grupo-stat--green { color: #22c55e; }

  .rg-grupo-card-footer {
    padding: 10px 16px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #1a2030;
  }

  /* ── Empty state ── */
  .rg-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 20px;
    text-align: center;
  }
  .rg-empty-state-icon  { font-size: 36px; }
  .rg-empty-state-title { font-size: 16px; font-weight: 600; color: #e8edf5; }
  .rg-empty-state-sub   { font-size: 13px; color: #8a94a6; max-width: 320px; line-height: 1.5; }

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
    gap: 12px;
  }
  .rg-form-grid--3 { grid-template-columns: repeat(3, 1fr); }
  .rg-form-grid--4 { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 900px) {
    .rg-form-grid--3 { grid-template-columns: repeat(2, 1fr); }
    .rg-form-grid--4 { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .rg-form-grid--3,
    .rg-form-grid--4 { grid-template-columns: 1fr; }
  }

  .rg-form-row { display: flex; flex-direction: column; gap: 5px; }
  .rg-form-row label { font-size: 11px; color: #8a94a6; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
  .rg-form-row input,
  .rg-form-row select {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 7px;
    color: #e8edf5;
    font-size: 13px;
    font-family: inherit;
    padding: 8px 11px;
    outline: none;
    transition: border-color 0.15s;
  }
  .rg-form-row input:focus,
  .rg-form-row select:focus { border-color: #22c55e; }
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
    vertical-align: middle;
  }
  .rg-td--nome   { font-weight: 500; color: #e8edf5; max-width: 220px; }
  .rg-td--quando { white-space: nowrap; }
  .rg-td--horario { white-space: nowrap; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8a94a6; }
  .rg-actions { display: flex; gap: 4px; }
  .rg-dash { color: #4a5568; }

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
  .rg-btn--sm { padding: 6px 12px; font-size: 12px; }

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

  /* ── Modal ── */
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
    width: 100%; max-width: 440px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  }
  .rg-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 14px;
    border-bottom: 1px solid #1a2030;
    font-size: 15px; font-weight: 600; color: #e8edf5;
  }
  .rg-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }

  /* ── Estados ── */
  .rg-empty   { color: #4a5568; font-size: 13px; padding: 32px 0; text-align: center; }
  .rg-loading { color: #4a5568; font-size: 13px; padding: 40px 0; }
  .rg-error   { background: #ef444415; border: 1px solid #ef444435; color: #ef4444; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
`
