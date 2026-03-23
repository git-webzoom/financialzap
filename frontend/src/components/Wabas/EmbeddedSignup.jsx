import { useState } from 'react'

/**
 * ConectarWaba
 *
 * Formulário manual para conectar uma WABA informando Token e WABA ID.
 * Substitui o fluxo de Embedded Signup OAuth da Meta.
 *
 * Props:
 *   onConnect({ access_token, waba_id }) — chamado ao submeter
 *   disabled                             — desabilita o formulário
 */
export default function ConectarWaba({ onConnect, disabled = false }) {
  const [token,   setToken]   = useState('')
  const [wabaId,  setWabaId]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!token.trim())  { setError('Informe o Token de Acesso.'); return }
    if (!wabaId.trim()) { setError('Informe o WABA ID.'); return }

    setLoading(true)
    setError('')
    try {
      await onConnect({ access_token: token.trim(), waba_id: wabaId.trim() })
      setToken('')
      setWabaId('')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao conectar WABA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <form className="cw-form" onSubmit={handleSubmit} noValidate>
        <div className="cw-fields">
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-token">Token de Acesso</label>
            <input
              id="cw-token"
              className="cw-input"
              type="password"
              placeholder="EAAn…"
              value={token}
              onChange={e => { setToken(e.target.value); setError('') }}
              disabled={disabled || loading}
              autoComplete="off"
            />
          </div>

          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-waba-id">WABA ID</label>
            <input
              id="cw-waba-id"
              className="cw-input"
              type="text"
              placeholder="123456789012345"
              value={wabaId}
              onChange={e => { setWabaId(e.target.value); setError('') }}
              disabled={disabled || loading}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className="cw-btn"
            disabled={disabled || loading}
          >
            {loading ? <span className="cw-spinner" /> : <IconPlug />}
            {loading ? 'Conectando…' : 'Conectar WABA'}
          </button>
        </div>

        {error && <p className="cw-error" role="alert">⚠ {error}</p>}
      </form>
    </>
  )
}

function IconPlug() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7 2v4M13 2v4M5 6h10a1 1 0 011 1v3a6 6 0 01-12 0V7a1 1 0 011-1zM10 16v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const CSS = `
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

  .cw-input {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 8px;
    padding: 9px 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #e8edf5;
    outline: none;
    width: 220px;
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
  }

  @media (max-width: 640px) {
    .cw-fields { flex-direction: column; align-items: stretch; }
    .cw-input  { width: 100%; }
    .cw-btn    { width: 100%; justify-content: center; }
  }
`
