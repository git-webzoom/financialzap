import { useState, useEffect } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'MARKETING',      label: 'Marketing' },
  { value: 'UTILITY',        label: 'Utilidade' },
  { value: 'AUTHENTICATION', label: 'Autenticação' },
]

const LANGUAGES = [
  { value: 'pt_BR', label: 'Português (Brasil)' },
  { value: 'en_US', label: 'Inglês (EUA)' },
  { value: 'es_ES', label: 'Espanhol (Espanha)' },
  { value: 'es_AR', label: 'Espanhol (Argentina)' },
  { value: 'fr_FR', label: 'Francês' },
  { value: 'de_DE', label: 'Alemão' },
  { value: 'it_IT', label: 'Italiano' },
]

const MEDIA_OPTIONS = [
  { value: 'none',  label: 'Sem mídia' },
  { value: 'IMAGE', label: 'Imagem' },
  { value: 'VIDEO', label: 'Vídeo' },
]

const BTN_OPTIONS = [
  { value: 'none',         label: 'Sem botão' },
  { value: 'URL',          label: 'Link externo' },
  { value: 'QUICK_REPLY',  label: 'Resposta rápida' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extract all {{N}} variable indices from a text
function extractVars(text) {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)]
  const unique = [...new Set(matches.map(m => Number(m[1])))]
  return unique.sort((a, b) => a - b)
}

// Validate template name: lowercase letters, digits, underscores only — no spaces
function isValidName(name) {
  return /^[a-z0-9_]+$/.test(name)
}

// Build the components array in Meta format
function buildComponents({ bodyText, varExamples, mediaType, buttonType, buttonLabel, buttonUrl }) {
  const components = []

  // Header (media)
  if (mediaType !== 'none') {
    components.push({
      type:   'HEADER',
      format: mediaType,
      example: { header_handle: ['{{media_handle}}'] },
    })
  }

  // Body
  const bodyParams = varExamples.map(ex => ex || 'exemplo')
  components.push({
    type: 'BODY',
    text: bodyText,
    ...(bodyParams.length > 0 && {
      example: { body_text: [bodyParams] },
    }),
  })

  // Buttons
  if (buttonType === 'URL') {
    components.push({
      type: 'BUTTONS',
      buttons: [{
        type: 'URL',
        text: buttonLabel,
        url:  buttonUrl,
      }],
    })
  } else if (buttonType === 'QUICK_REPLY') {
    components.push({
      type: 'BUTTONS',
      buttons: [{
        type: 'QUICK_REPLY',
        text: buttonLabel,
      }],
    })
  }

  return components
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * TemplateForm
 * Props:
 *   wabas     — array of waba objects [{ waba_id, name }]
 *   onSubmit(payload) — called with the full payload ready for createTemplate()
 *   onCancel()
 *   submitting — bool, disables form while request is in flight
 *   error      — string error message from parent
 */
export default function TemplateForm({ wabas = [], onSubmit, onCancel, submitting = false, error = '' }) {
  const [name,        setName]        = useState('')
  const [wabaId,      setWabaId]      = useState('')
  const [category,    setCategory]    = useState('MARKETING')
  const [language,    setLanguage]    = useState('pt_BR')
  const [bodyText,    setBodyText]    = useState('')
  const [varExamples, setVarExamples] = useState([])  // indexed by var number - 1
  const [mediaType,   setMediaType]   = useState('none')
  const [buttonType,  setButtonType]  = useState('none')
  const [buttonLabel, setButtonLabel] = useState('')
  const [buttonUrl,   setButtonUrl]   = useState('')
  const [nameError,   setNameError]   = useState('')

  // Re-extract variables whenever bodyText changes
  useEffect(() => {
    const indices = extractVars(bodyText)
    setVarExamples(prev => {
      const next = []
      for (const idx of indices) {
        next[idx - 1] = prev[idx - 1] || ''
      }
      return next
    })
  }, [bodyText])

  const varIndices = extractVars(bodyText)

  function handleNameChange(e) {
    const val = e.target.value.toLowerCase().replace(/\s/g, '_')
    setName(val)
    setNameError(val && !isValidName(val) ? 'Apenas letras minúsculas, números e underscore (_)' : '')
  }

  function handleVarExample(idx, value) {
    setVarExamples(prev => {
      const next = [...prev]
      next[idx - 1] = value
      return next
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!isValidName(name)) { setNameError('Nome inválido'); return }
    if (!wabaId) return

    const components = buildComponents({
      bodyText,
      varExamples,
      mediaType,
      buttonType,
      buttonLabel,
      buttonUrl,
    })

    onSubmit({
      waba_id:    wabaId,
      name,
      category,
      language,
      components,
    })
  }

  const canSubmit = name && !nameError && wabaId && bodyText.trim() && !submitting

  return (
    <>
      <style>{CSS}</style>
      <form className="tf-root" onSubmit={handleSubmit} noValidate>

        {/* ── Name + WABA row ── */}
        <div className="tf-row tf-row--2">

          <div className="tf-field">
            <label className="tf-label">
              Nome do template
              <span className="tf-label-hint">letras minúsculas e _</span>
            </label>
            <input
              className={`tf-input${nameError ? ' tf-input--err' : ''}`}
              value={name}
              onChange={handleNameChange}
              placeholder="meu_template_de_cobrança"
              required
              disabled={submitting}
            />
            {nameError && <span className="tf-err">{nameError}</span>}
          </div>

          <div className="tf-field">
            <label className="tf-label">WABA</label>
            <select
              className="tf-select"
              value={wabaId}
              onChange={e => setWabaId(e.target.value)}
              required
              disabled={submitting}
            >
              <option value="">Selecione a WABA</option>
              {wabas.map(w => (
                <option key={w.waba_id} value={w.waba_id}>
                  {w.name || w.waba_id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Category + Language row ── */}
        <div className="tf-row tf-row--2">
          <div className="tf-field">
            <label className="tf-label">Categoria</label>
            <select className="tf-select" value={category} onChange={e => setCategory(e.target.value)} disabled={submitting}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="tf-field">
            <label className="tf-label">Idioma</label>
            <select className="tf-select" value={language} onChange={e => setLanguage(e.target.value)} disabled={submitting}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── Body copy ── */}
        <div className="tf-field">
          <label className="tf-label">
            Texto da mensagem
            <span className="tf-label-hint">use {'{{1}}'}, {'{{2}}'} para variáveis</span>
          </label>
          <textarea
            className="tf-textarea"
            value={bodyText}
            onChange={e => setBodyText(e.target.value)}
            placeholder="Olá, {{1}}! Seu pagamento de R$ {{2}} vence em {{3}} dias."
            rows={5}
            required
            disabled={submitting}
          />
        </div>

        {/* ── Variable examples (auto-generated) ── */}
        {varIndices.length > 0 && (
          <div className="tf-var-block">
            <p className="tf-var-title">
              <IconVar />
              Exemplos de variáveis <span className="tf-var-hint">(obrigatório pela Meta para aprovação)</span>
            </p>
            <div className="tf-var-grid">
              {varIndices.map(idx => (
                <div key={idx} className="tf-field">
                  <label className="tf-label">Exemplo para {`{{${idx}}}`}</label>
                  <input
                    className="tf-input"
                    value={varExamples[idx - 1] || ''}
                    onChange={e => handleVarExample(idx, e.target.value)}
                    placeholder={`valor de {{${idx}}}`}
                    disabled={submitting}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Media ── */}
        <div className="tf-field">
          <label className="tf-label">Mídia</label>
          <div className="tf-radio-group">
            {MEDIA_OPTIONS.map(opt => (
              <label key={opt.value} className={`tf-radio${mediaType === opt.value ? ' tf-radio--active' : ''}`}>
                <input
                  type="radio"
                  name="media"
                  value={opt.value}
                  checked={mediaType === opt.value}
                  onChange={() => setMediaType(opt.value)}
                  disabled={submitting}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* ── Button ── */}
        <div className="tf-field">
          <label className="tf-label">Botão</label>
          <div className="tf-radio-group">
            {BTN_OPTIONS.map(opt => (
              <label key={opt.value} className={`tf-radio${buttonType === opt.value ? ' tf-radio--active' : ''}`}>
                <input
                  type="radio"
                  name="button"
                  value={opt.value}
                  checked={buttonType === opt.value}
                  onChange={() => setButtonType(opt.value)}
                  disabled={submitting}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Button detail fields */}
          {buttonType !== 'none' && (
            <div className="tf-btn-detail">
              <div className="tf-row tf-row--2">
                <div className="tf-field">
                  <label className="tf-label">
                    {buttonType === 'URL' ? 'Nome do botão' : 'Texto do botão'}
                  </label>
                  <input
                    className="tf-input"
                    value={buttonLabel}
                    onChange={e => setButtonLabel(e.target.value)}
                    placeholder={buttonType === 'URL' ? 'Acessar portal' : 'Sim, confirmar'}
                    disabled={submitting}
                  />
                </div>

                {buttonType === 'URL' && (
                  <div className="tf-field">
                    <label className="tf-label">URL</label>
                    <input
                      className="tf-input"
                      type="url"
                      value={buttonUrl}
                      onChange={e => setButtonUrl(e.target.value)}
                      placeholder="https://meusite.com.br/pagamento"
                      disabled={submitting}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && <div className="tf-error-banner">{error}</div>}

        {/* ── Actions ── */}
        <div className="tf-actions">
          <button type="button" className="tf-btn tf-btn--secondary" onClick={onCancel} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="tf-btn tf-btn--primary" disabled={!canSubmit}>
            {submitting ? (
              <><span className="tf-spinner" /> Criando…</>
            ) : (
              <><IconSend /> Criar template</>
            )}
          </button>
        </div>
      </form>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconVar() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4l-2 4 2 4M13 4l2 4-2 4M9.5 2l-3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14 2L1 7l5 3 2 5 6-13z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6 10l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .tf-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .tf-row {
    display: grid;
    gap: 16px;
  }
  .tf-row--2 { grid-template-columns: 1fr 1fr; }

  @media (max-width: 600px) {
    .tf-row--2 { grid-template-columns: 1fr; }
  }

  .tf-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tf-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #8a94a6;
    letter-spacing: 0.3px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tf-label-hint {
    font-weight: 400;
    color: #374151;
    font-size: 11px;
  }

  .tf-input,
  .tf-select,
  .tf-textarea {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #e8edf5;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    padding: 9px 12px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
  }
  .tf-input:focus,
  .tf-select:focus,
  .tf-textarea:focus { border-color: #22c55e60; }
  .tf-input--err { border-color: #ef444460 !important; }
  .tf-input:disabled,
  .tf-select:disabled,
  .tf-textarea:disabled { opacity: 0.5; cursor: not-allowed; }

  .tf-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%234a5568' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }
  .tf-select option { background: #1a1f28; }

  .tf-textarea { resize: vertical; min-height: 100px; line-height: 1.6; }

  .tf-err {
    font-size: 11px;
    color: #fca5a5;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Variable examples ── */
  .tf-var-block {
    background: #22c55e08;
    border: 1px solid #22c55e20;
    border-radius: 9px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tf-var-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #86efac;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tf-var-hint {
    font-weight: 400;
    color: #4a7c59;
  }

  .tf-var-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  /* ── Radio groups ── */
  .tf-radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tf-radio {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid #252c38;
    background: #1a1f28;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #8a94a6;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    user-select: none;
  }
  .tf-radio input[type="radio"] { display: none; }
  .tf-radio--active {
    border-color: #22c55e50;
    background: #22c55e12;
    color: #86efac;
  }
  .tf-radio:hover:not(.tf-radio--active) {
    border-color: #374151;
    color: #e8edf5;
  }

  .tf-btn-detail {
    margin-top: 12px;
  }

  /* ── Error banner ── */
  .tf-error-banner {
    padding: 10px 14px;
    background: #ef444412;
    border: 1px solid #ef444430;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Actions ── */
  .tf-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 4px;
  }

  .tf-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 20px;
    border-radius: 8px;
    border: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
  }
  .tf-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .tf-btn--primary {
    background: #22c55e;
    color: #0a0c0f;
  }
  .tf-btn--primary:hover:not(:disabled) { background: #16a34a; }

  .tf-btn--secondary {
    background: #1a1f28;
    border: 1px solid #252c38;
    color: #8a94a6;
  }
  .tf-btn--secondary:hover:not(:disabled) { background: #252c38; color: #e8edf5; }

  .tf-spinner {
    width: 13px; height: 13px;
    border: 2px solid #0a0c0f40;
    border-top-color: #0a0c0f;
    border-radius: 50%;
    animation: tf-spin 0.7s linear infinite;
    display: inline-block;
  }
  @keyframes tf-spin { to { transform: rotate(360deg); } }
`
