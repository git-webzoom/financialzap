import { useState } from 'react'
import { lookupWabas } from '../../services/wabaService'

/**
 * ConectarWaba
 *
 * Fluxo:
 *  1. Usuário informa o Token de Acesso e clica em "Buscar WABAs"
 *  2. Modal abre com a lista de WABAs encontradas (nome + ID)
 *  3. Usuário seleciona uma ou mais WABAs
 *  4. Clica em "Conectar selecionadas" — onConnect é chamado para cada WABA
 *
 * Props:
 *   onConnect({ access_token, waba_id }) — chamado para cada WABA selecionada
 *   disabled                             — desabilita o formulário
 */
export default function ConectarWaba({ onConnect, disabled = false }) {
  const [token,     setToken]     = useState('')
  const [looking,   setLooking]   = useState(false)
  const [lookError, setLookError] = useState('')

  // Modal state
  const [wabas,      setWabas]      = useState([])       // [{ waba_id, name }]
  const [selected,   setSelected]   = useState(new Set()) // Set of waba_ids
  const [connecting, setConnecting] = useState(false)
  const [connError,  setConnError]  = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)

  // ── Step 1: lookup ───────────────────────────────────────────────────────────

  async function handleLookup(e) {
    e.preventDefault()
    if (!token.trim()) { setLookError('Informe o Token de Acesso.'); return }
    setLooking(true)
    setLookError('')
    setConnError('')
    try {
      const result = await lookupWabas(token.trim())
      if (!result.wabas || result.wabas.length === 0) {
        setLookError('Nenhuma WABA encontrada para este token.')
        return
      }
      setWabas(result.wabas)
      setSelected(new Set(result.wabas.map(w => w.waba_id))) // select all by default
      setModalOpen(true)
    } catch (err) {
      setLookError(err.response?.data?.error || err.message || 'Erro ao buscar WABAs.')
    } finally {
      setLooking(false)
    }
  }

  // ── Step 2: toggle selection ─────────────────────────────────────────────────

  function toggleWaba(wabaId) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(wabaId) ? next.delete(wabaId) : next.add(wabaId)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === wabas.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(wabas.map(w => w.waba_id)))
    }
  }

  // ── Step 3: connect selected WABAs ───────────────────────────────────────────

  async function handleConnect() {
    if (!selected.size) { setConnError('Selecione ao menos uma WABA.'); return }
    setConnecting(true)
    setConnError('')
    const toConnect = wabas.filter(w => selected.has(w.waba_id))
    const errors = []

    for (const waba of toConnect) {
      try {
        await onConnect({ access_token: token.trim(), waba_id: waba.waba_id })
      } catch (err) {
        errors.push(`${waba.name || waba.waba_id}: ${err.response?.data?.error || err.message}`)
      }
    }

    setConnecting(false)

    if (errors.length) {
      setConnError(errors.join(' · '))
    } else {
      // All succeeded — reset everything
      setModalOpen(false)
      setToken('')
      setWabas([])
      setSelected(new Set())
    }
  }

  function closeModal() {
    if (connecting) return
    setModalOpen(false)
    setConnError('')
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{CSS}</style>

      {/* Token form */}
      <form className="cw-form" onSubmit={handleLookup} noValidate>
        <div className="cw-fields">
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-token">Token de Acesso</label>
            <div className="cw-input-wrap">
              <input
                id="cw-token"
                className="cw-input"
                type="password"
                placeholder="EAAn…"
                value={token}
                onChange={e => { setToken(e.target.value); setLookError('') }}
                disabled={disabled || looking}
                autoComplete="off"
              />
            </div>
          </div>

          <button
            type="submit"
            className="cw-btn"
            disabled={disabled || looking}
          >
            {looking ? <span className="cw-spinner" /> : <IconSearch />}
            {looking ? 'Buscando…' : 'Buscar WABAs'}
          </button>
        </div>

        {lookError && <p className="cw-error" role="alert">⚠ {lookError}</p>}
      </form>

      {/* Modal overlay */}
      {modalOpen && (
        <div className="cw-overlay" onClick={closeModal}>
          <div className="cw-modal" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="cw-modal-header">
              <div>
                <p className="cw-modal-title">WABAs encontradas</p>
                <p className="cw-modal-sub">{wabas.length} WABA{wabas.length !== 1 ? 's' : ''} disponíve{wabas.length !== 1 ? 'is' : 'l'}</p>
              </div>
              <button className="cw-modal-close" onClick={closeModal} disabled={connecting} aria-label="Fechar">
                <IconClose />
              </button>
            </div>

            {/* Select all toggle */}
            <div className="cw-select-all">
              <button type="button" className="cw-select-all-btn" onClick={toggleAll} disabled={connecting}>
                <span className={`cw-check ${selected.size === wabas.length ? 'cw-check--on' : ''}`}>
                  {selected.size === wabas.length && <IconCheck />}
                </span>
                {selected.size === wabas.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
              <span className="cw-select-count">
                {selected.size} selecionada{selected.size !== 1 ? 's' : ''}
              </span>
            </div>

            {/* WABA list */}
            <div className="cw-waba-list">
              {wabas.map(w => {
                const on = selected.has(w.waba_id)
                return (
                  <button
                    key={w.waba_id}
                    type="button"
                    className={`cw-waba-item ${on ? 'cw-waba-item--on' : ''}`}
                    onClick={() => toggleWaba(w.waba_id)}
                    disabled={connecting}
                  >
                    <span className={`cw-check ${on ? 'cw-check--on' : ''}`}>
                      {on && <IconCheck />}
                    </span>
                    <div className="cw-waba-info">
                      <span className="cw-waba-name">{w.name || '(sem nome)'}</span>
                      <span className="cw-waba-id">{w.waba_id}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Connect error */}
            {connError && (
              <p className="cw-error" role="alert">⚠ {connError}</p>
            )}

            {/* Modal footer */}
            <div className="cw-modal-footer">
              <button type="button" className="cw-btn-secondary" onClick={closeModal} disabled={connecting}>
                Cancelar
              </button>
              <button
                type="button"
                className="cw-btn"
                onClick={handleConnect}
                disabled={connecting || !selected.size}
              >
                {connecting ? <span className="cw-spinner" /> : <IconPlug />}
                {connecting ? 'Conectando…' : `Conectar ${selected.size > 0 ? `(${selected.size})` : ''}`}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )
}

function IconPlug() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7 2v4M13 2v4M5 6h10a1 1 0 011 1v3a6 6 0 01-12 0V7a1 1 0 011-1zM10 16v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Token form ── */
  .cw-form { display: flex; flex-direction: column; gap: 8px; }

  .cw-fields {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .cw-field { display: flex; flex-direction: column; gap: 5px; }

  .cw-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 500;
    color: #8a94a6;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .cw-input-wrap { position: relative; }

  .cw-input {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 8px;
    padding: 9px 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #e8edf5;
    outline: none;
    width: 260px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .cw-input::placeholder { color: #4a5568; }
  .cw-input:focus {
    border-color: #22c55e60;
    box-shadow: 0 0 0 3px #22c55e18;
  }
  .cw-input:disabled { opacity: 0.5; cursor: not-allowed; }

  .cw-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    background: #22c55e;
    border: none;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #000;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
    height: 38px;
    flex-shrink: 0;
  }
  .cw-btn:hover:not(:disabled) {
    background: #16a34a;
    box-shadow: 0 0 16px #22c55e28;
  }
  .cw-btn:active:not(:disabled) { transform: scale(0.98); }
  .cw-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .cw-btn-secondary {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 18px; height: 38px;
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 8px; color: #8a94a6;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .cw-btn-secondary:hover:not(:disabled) { background: #252c38; color: #e8edf5; }
  .cw-btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

  .cw-spinner {
    width: 14px; height: 14px;
    border: 2px solid #00000030;
    border-top-color: #000;
    border-radius: 50%;
    animation: cw-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes cw-spin { to { transform: rotate(360deg); } }

  .cw-error {
    font-size: 12px;
    color: #fca5a5;
    font-family: 'DM Sans', sans-serif;
    margin: 0;
  }

  /* ── Modal overlay ── */
  .cw-overlay {
    position: fixed; inset: 0;
    background: #00000088;
    backdrop-filter: blur(3px);
    z-index: 100;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: cw-fade 0.15s ease;
  }
  @keyframes cw-fade { from { opacity: 0 } to { opacity: 1 } }

  .cw-modal {
    background: #0f1215;
    border: 1px solid #1a1f28;
    border-radius: 14px;
    width: 100%; max-width: 480px;
    display: flex; flex-direction: column;
    max-height: calc(100vh - 48px);
    overflow: hidden;
    animation: cw-slide 0.18s ease;
    box-shadow: 0 24px 64px #00000080;
  }
  @keyframes cw-slide { from { transform: translateY(12px); opacity: 0 } to { transform: none; opacity: 1 } }

  /* ── Modal header ── */
  .cw-modal-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px solid #1a1f28;
    gap: 12px;
    flex-shrink: 0;
  }
  .cw-modal-title {
    font-family: 'DM Sans', sans-serif; font-size: 15px;
    font-weight: 600; color: #e8edf5; margin: 0;
  }
  .cw-modal-sub {
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    color: #4a5568; margin: 3px 0 0;
  }
  .cw-modal-close {
    width: 28px; height: 28px; flex-shrink: 0;
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 7px; color: #8a94a6;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .cw-modal-close:hover:not(:disabled) { background: #252c38; color: #e8edf5; }
  .cw-modal-close:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Select all ── */
  .cw-select-all {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 20px;
    border-bottom: 1px solid #1a1f28;
    flex-shrink: 0;
  }
  .cw-select-all-btn {
    display: flex; align-items: center; gap: 8px;
    background: none; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    color: #8a94a6; transition: color 0.15s;
    padding: 0;
  }
  .cw-select-all-btn:hover:not(:disabled) { color: #e8edf5; }
  .cw-select-all-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .cw-select-count {
    font-family: 'DM Sans', sans-serif; font-size: 12px; color: #4a5568;
  }

  /* ── Checkbox ── */
  .cw-check {
    width: 18px; height: 18px; flex-shrink: 0;
    border: 1.5px solid #252c38;
    border-radius: 5px; background: #0c0f13;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.12s, border-color 0.12s;
  }
  .cw-check--on {
    background: #22c55e;
    border-color: #22c55e;
    color: #000;
  }

  /* ── WABA list ── */
  .cw-waba-list {
    overflow-y: auto;
    flex: 1;
    display: flex; flex-direction: column;
    min-height: 0;
  }

  .cw-waba-item {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 20px;
    background: none; border: none; border-bottom: 1px solid #1a1f28;
    text-align: left; cursor: pointer; width: 100%;
    transition: background 0.12s;
  }
  .cw-waba-item:last-child { border-bottom: none; }
  .cw-waba-item:hover:not(:disabled) { background: #1a1f2840; }
  .cw-waba-item--on { background: #22c55e08; }
  .cw-waba-item--on:hover:not(:disabled) { background: #22c55e12; }
  .cw-waba-item:disabled { opacity: 0.4; cursor: not-allowed; }

  .cw-waba-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .cw-waba-name {
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    font-weight: 500; color: #e8edf5;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cw-waba-id {
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    color: #4a5568;
  }

  /* ── Modal footer ── */
  .cw-modal-footer {
    display: flex; align-items: center; justify-content: flex-end;
    gap: 8px; padding: 14px 20px;
    border-top: 1px solid #1a1f28;
    flex-shrink: 0;
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .cw-fields   { flex-direction: column; align-items: stretch; }
    .cw-input    { width: 100%; }
    .cw-btn      { width: 100%; justify-content: center; }
    .cw-modal    { border-radius: 14px 14px 0 0; position: fixed; bottom: 0; left: 0; right: 0; max-width: 100%; }
    .cw-overlay  { align-items: flex-end; padding: 0; }
  }
`
