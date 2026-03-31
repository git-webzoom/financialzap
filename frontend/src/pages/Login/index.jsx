import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

// ─── Field validation ─────────────────────────────────────────────────────────

function validateLogin({ email, password }) {
  const errors = {}
  if (!email || !/\S+@\S+\.\S+/.test(email)) errors.email = 'E-mail inválido'
  if (!password || password.length < 8) errors.password = 'Mínimo 8 caracteres'
  return errors
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, id, error, ...props }) {
  return (
    <div className="field-group">
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} className={`field-input${error ? ' field-input--error' : ''}`} {...props} />
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

function StatusMessage({ type, message }) {
  if (!message) return null
  return (
    <div className={`status-msg status-msg--${type}`} role="alert">
      <span className="status-icon">{type === 'error' ? '⚠' : '✓'}</span>
      {message}
    </div>
  )
}

// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm({ onSuccess }) {
  const { login, loading } = useAuth()
  const [fields, setFields] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [apiError, setApiError] = useState('')

  const set = (k) => (e) => {
    setFields((p) => ({ ...p, [k]: e.target.value }))
    if (fieldErrors[k]) setFieldErrors((p) => ({ ...p, [k]: '' }))
    setApiError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = validateLogin(fields)
    if (Object.keys(errors).length) { setFieldErrors(errors); return }

    try {
      await login(fields)
      onSuccess()
    } catch (err) {
      setApiError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <StatusMessage type="error" message={apiError} />
      <Field
        label="E-mail"
        id="login-email"
        type="email"
        autoComplete="email"
        value={fields.email}
        onChange={set('email')}
        error={fieldErrors.email}
        placeholder="voce@empresa.com"
      />
      <Field
        label="Senha"
        id="login-password"
        type="password"
        autoComplete="current-password"
        value={fields.password}
        onChange={set('password')}
        error={fieldErrors.password}
        placeholder="••••••••"
      />
      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? <span className="spinner" /> : 'Entrar'}
      </button>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate()

  function onLoginSuccess() {
    navigate('/dashboard', { replace: true })
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="auth-root">

        {/* ── Left panel ── */}
        <div className="brand-panel" aria-hidden="true">
          <div className="scan-line" />
          <div className="grid-overlay" />

          <div className="brand-content">
            <div className="brand-logo">
              <span className="brand-zap">⚡</span>
            </div>
            <h1 className="brand-name">FinancialZap</h1>
            <p className="brand-tagline">Disparos em massa via<br />API Oficial WhatsApp</p>

            <ul className="brand-features">
              {[
                'Multi-tenant SaaS',
                'Meta Cloud API oficial',
                'Fila BullMQ + Redis',
                'Gestão de WABAs',
              ].map((f) => (
                <li key={f} className="brand-feature">
                  <span className="feature-dot" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="brand-footer">
            <span className="status-dot" />
            Sistema operacional
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="form-panel">
          <div className="form-card">
            <div className="form-heading">
              <div className="form-logo">⚡</div>
              <h2 className="form-title">Acesse sua conta</h2>
              <p className="form-subtitle">Insira suas credenciais para continuar</p>
            </div>

            <LoginForm onSuccess={onLoginSuccess} />
          </div>
        </div>

      </div>
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-void:     #0a0c0f;
    --bg-panel:    #0f1215;
    --bg-card:     #141820;
    --bg-input:    #1a1f28;
    --border:      #252c38;
    --border-glow: #22c55e40;
    --green:       #22c55e;
    --green-dim:   #16a34a;
    --green-muted: #22c55e22;
    --text-primary:  #e8edf5;
    --text-secondary:#8a94a6;
    --text-muted:    #4a5568;
    --red:         #ef4444;
    --red-bg:      #ef444410;
    --mono: 'JetBrains Mono', monospace;
    --sans: 'DM Sans', sans-serif;
  }

  .auth-root {
    display: flex;
    min-height: 100vh;
    background: var(--bg-void);
    font-family: var(--sans);
  }

  /* ── Brand panel ── */
  .brand-panel {
    position: relative;
    width: 420px;
    flex-shrink: 0;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 48px 40px;
    overflow: hidden;
  }
  @media (max-width: 768px) { .brand-panel { display: none; } }

  .scan-line {
    position: absolute; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--green), transparent);
    animation: scan 4s ease-in-out infinite; opacity: 0.6;
  }
  @keyframes scan {
    0%   { top: 0%;   opacity: 0; }
    10%  { opacity: 0.6; }
    90%  { opacity: 0.6; }
    100% { top: 100%; opacity: 0; }
  }

  .grid-overlay {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 40px 40px; opacity: 0.25;
  }

  .brand-content { position: relative; z-index: 1; }

  .brand-logo {
    width: 52px; height: 52px;
    background: var(--green-muted); border: 1px solid var(--green);
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    margin-bottom: 24px; box-shadow: 0 0 20px var(--green)30;
  }
  .brand-zap { font-size: 24px; line-height: 1; }

  .brand-name {
    font-family: var(--mono); font-size: 26px; font-weight: 700;
    color: var(--text-primary); letter-spacing: -0.5px; margin-bottom: 10px;
  }
  .brand-tagline {
    font-size: 14px; color: var(--text-secondary);
    line-height: 1.6; margin-bottom: 40px;
  }
  .brand-features { list-style: none; display: flex; flex-direction: column; gap: 14px; }
  .brand-feature {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: var(--text-secondary); font-family: var(--mono);
  }
  .feature-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--green); flex-shrink: 0; box-shadow: 0 0 8px var(--green);
  }
  .brand-footer {
    position: relative; z-index: 1; display: flex; align-items: center; gap: 8px;
    font-family: var(--mono); font-size: 11px; color: var(--text-muted); letter-spacing: 0.5px;
  }
  .status-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--green);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 4px var(--green); }
    50%       { opacity: 0.4; box-shadow: none; }
  }

  /* ── Form panel ── */
  .form-panel {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 40px 24px;
  }
  .form-card { width: 100%; max-width: 400px; }

  .form-heading { margin-bottom: 32px; }
  .form-logo {
    width: 44px; height: 44px;
    background: var(--green-muted); border: 1px solid var(--green);
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    font-size: 20px; margin-bottom: 20px;
    box-shadow: 0 0 16px var(--green)25;
  }
  .form-title {
    font-size: 22px; font-weight: 600; color: var(--text-primary);
    letter-spacing: -0.3px; margin-bottom: 6px;
  }
  .form-subtitle { font-size: 13px; color: var(--text-secondary); }

  /* ── Fields ── */
  .field-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .field-label {
    font-size: 12px; font-weight: 500; color: var(--text-secondary);
    letter-spacing: 0.3px; text-transform: uppercase;
  }
  .field-input {
    background: var(--bg-input); border: 1px solid var(--border);
    border-radius: 8px; padding: 11px 14px;
    font-family: var(--sans); font-size: 14px; color: var(--text-primary);
    outline: none; transition: border-color 0.15s, box-shadow 0.15s; width: 100%;
  }
  .field-input::placeholder { color: var(--text-muted); }
  .field-input:focus {
    border-color: var(--green-dim); box-shadow: 0 0 0 3px var(--border-glow);
  }
  .field-input--error { border-color: var(--red); }
  .field-input--error:focus { box-shadow: 0 0 0 3px var(--red-bg); }
  .field-error { font-size: 12px; color: var(--red); display: flex; align-items: center; gap: 4px; }

  /* ── Status messages ── */
  .status-msg {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 14px; border-radius: 8px;
    font-size: 13px; margin-bottom: 16px; line-height: 1.4;
  }
  .status-msg--error  { background: var(--red-bg); border: 1px solid #ef444430; color: #fca5a5; }
  .status-msg--success { background: var(--green-muted); border: 1px solid #22c55e30; color: #86efac; }
  .status-icon { font-size: 14px; flex-shrink: 0; }

  /* ── Submit button ── */
  .submit-btn {
    width: 100%; margin-top: 8px; padding: 12px;
    background: var(--green); border: none; border-radius: 8px;
    font-family: var(--sans); font-size: 14px; font-weight: 600; color: #000;
    cursor: pointer; transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    display: flex; align-items: center; justify-content: center; min-height: 44px;
  }
  .submit-btn:hover:not(:disabled) { background: #16a34a; box-shadow: 0 0 20px #22c55e30; }
  .submit-btn:active:not(:disabled) { transform: scale(0.99); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .spinner {
    width: 16px; height: 16px; border: 2px solid #00000030; border-top-color: #000;
    border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`
