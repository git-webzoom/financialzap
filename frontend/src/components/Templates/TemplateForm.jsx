import { useState, useEffect, useMemo } from 'react'
import { listMedia } from '../../services/midiaService'

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

// Header format options
const HEADER_OPTIONS = [
  { value: 'none',     label: 'Sem cabeçalho' },
  { value: 'TEXT',     label: 'Texto' },
  { value: 'IMAGE',    label: 'Imagem' },
  { value: 'VIDEO',    label: 'Vídeo' },
  { value: 'DOCUMENT', label: 'Documento' },
]

const BTN_TYPES = [
  { value: 'URL',          label: 'Link externo' },
  { value: 'PHONE_NUMBER', label: 'Telefone' },
  { value: 'QUICK_REPLY',  label: 'Resposta rápida' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractVars(text) {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)]
  const unique = [...new Set(matches.map(m => Number(m[1])))]
  return unique.sort((a, b) => a - b)
}

function isValidName(name) {
  return /^[a-z0-9_]+$/.test(name)
}

function buildComponents({ headerType, headerText, headerMediaUrl, headerHandleId, bodyText, varExamples, footerText, buttons }) {
  const components = []

  // Header
  if (headerType === 'TEXT' && headerText.trim()) {
    components.push({ type: 'HEADER', format: 'TEXT', text: headerText.trim() })
  } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
    const comp = { type: 'HEADER', format: headerType }
    if (headerHandleId?.trim()) {
      comp.example = { header_handle: [headerHandleId.trim()] }
    } else if (headerMediaUrl.trim()) {
      comp.example = { header_url: [headerMediaUrl.trim()] }
    }
    components.push(comp)
  }

  // Body
  const bodyParams = varExamples.map(ex => ex || 'exemplo')
  components.push({
    type: 'BODY',
    text: bodyText,
    ...(bodyParams.length > 0 && { example: { body_text: [bodyParams] } }),
  })

  // Footer
  if (footerText.trim()) {
    components.push({ type: 'FOOTER', text: footerText.trim() })
  }

  // Buttons
  const validButtons = buttons.filter(b => b.text.trim())
  if (validButtons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: validButtons.map(b => {
        if (b.type === 'URL')          return { type: 'URL',          text: b.text, url: b.url }
        if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone }
        return { type: 'QUICK_REPLY', text: b.text }
      }),
    })
  }

  return components
}

function emptyButton() {
  return { type: 'QUICK_REPLY', text: '', url: '', phone: '' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TemplateForm({ wabas = [], onSubmit, onBatchSubmit, onCancel, submitting = false, error = '', externalBatchResults = null }) {
  const [name,           setName]           = useState('')
  const [wabaId,         setWabaId]         = useState('')
  const [category,       setCategory]       = useState('MARKETING')
  const [language,       setLanguage]       = useState('pt_BR')
  // Header
  const [headerType,      setHeaderType]      = useState('none')
  const [headerText,      setHeaderText]      = useState('')
  const [headerMediaUrl,  setHeaderMediaUrl]  = useState('')
  const [headerHandleId,  setHeaderHandleId]  = useState('')
  const [headerHandleName,setHeaderHandleName]= useState('')
  const [useHandleMode,   setUseHandleMode]   = useState(false)
  // Body
  const [bodyText,       setBodyText]       = useState('')
  const [varExamples,    setVarExamples]    = useState([])
  // Footer
  const [footerText,     setFooterText]     = useState('')
  // Buttons (up to 3)
  const [buttons,        setButtons]        = useState([])
  // Batch
  const [quantity,       setQuantity]       = useState(1)
  // Validation
  const [nameError,      setNameError]      = useState('')
  const [quantityError,  setQuantityError]  = useState('')

  // Re-extract variables whenever bodyText changes
  useEffect(() => {
    const indices = extractVars(bodyText)
    setVarExamples(prev => {
      const next = []
      for (const idx of indices) next[idx - 1] = prev[idx - 1] || ''
      return next
    })
  }, [bodyText])

  const varIndices = extractVars(bodyText)

  // Whether the name ends with a number (required for batch mode)
  const nameEndsWithNumber = useMemo(() => /\d+$/.test(name), [name])
  const isBatch = quantity > 1

  const displayBatchResults = externalBatchResults

  function handleNameChange(e) {
    const val = e.target.value.toLowerCase().replace(/\s/g, '_')
    setName(val)
    setNameError(val && !isValidName(val) ? 'Apenas letras minúsculas, números e _' : '')
  }

  function handleQuantityChange(e) {
    const val = e.target.value
    const n = parseInt(val, 10)
    setQuantity(val === '' ? '' : n)
    if (val === '' || isNaN(n) || n < 1 || n > 50) {
      setQuantityError('Entre 1 e 50')
    } else {
      setQuantityError('')
    }
  }

  function handleVarExample(idx, value) {
    setVarExamples(prev => { const n = [...prev]; n[idx - 1] = value; return n })
  }

  function addButton() {
    if (buttons.length >= 3) return
    setButtons(prev => [...prev, emptyButton()])
  }

  function updateButton(i, field, value) {
    setButtons(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b))
  }

  function removeButton(i) {
    setButtons(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!isValidName(name)) { setNameError('Nome inválido'); return }
    if (!wabaId) return
    if (isBatch && !nameEndsWithNumber) {
      setNameError('Para criar em lote, o nome deve terminar com um número (ex: cobranca_0)')
      return
    }
    if (isBatch && quantityError) return

    const components = buildComponents({
      headerType, headerText, headerMediaUrl,
      headerHandleId: useHandleMode ? headerHandleId : '',
      bodyText, varExamples,
      footerText,
      buttons,
    })

    if (isBatch && onBatchSubmit) {
      onBatchSubmit({
        waba_id: wabaId,
        name_base: name,
        count: Number(quantity),
        category,
        language,
        components,
      })
    } else {
      onSubmit({ waba_id: wabaId, name, category, language, components })
    }
  }

  const quantityValid = !isBatch || (nameEndsWithNumber && !quantityError && Number(quantity) >= 1 && Number(quantity) <= 50)
  const canSubmit = name && !nameError && wabaId && bodyText.trim() && !submitting && quantityValid

  // Build preview components for the bubble
  const previewHeader  = headerType === 'TEXT' ? headerText : headerType !== 'none' ? headerType : null
  const previewIsMedia = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)

  return (
    <>
      <style>{CSS}</style>
      <form className="tf-root" onSubmit={handleSubmit} noValidate>

        {/* ── Name + WABA ── */}
        <div className="tf-row tf-row--2">
          <div className="tf-field">
            <label className="tf-label">
              Nome do template <span className="tf-hint">letras minúsculas e _</span>
            </label>
            <input
              className={`tf-input${nameError ? ' tf-input--err' : ''}`}
              value={name}
              onChange={handleNameChange}
              placeholder="meu_template_cobranca"
              disabled={submitting}
            />
            {nameError && <span className="tf-err">{nameError}</span>}
          </div>

          <div className="tf-field">
            <label className="tf-label">WABA</label>
            <select className="tf-select" value={wabaId} onChange={e => setWabaId(e.target.value)} disabled={submitting}>
              <option value="">Selecione a WABA</option>
              {wabas.map(w => <option key={w.waba_id} value={w.waba_id}>{w.name || w.waba_id}</option>)}
            </select>
          </div>
        </div>

        {/* ── Quantity (batch) ── */}
        <div className="tf-row tf-row--2" style={{ marginTop: 14 }}>
          <div className="tf-field">
            <label className="tf-label">
              Quantidade de templates
              <span className="tf-hint">cria N templates incrementando o número final do nome</span>
            </label>
            <input
              type="number"
              className={`tf-input${quantityError ? ' tf-input--err' : ''}`}
              value={quantity}
              onChange={handleQuantityChange}
              min={1}
              max={50}
              disabled={submitting}
            />
            {quantityError && <span className="tf-err">{quantityError}</span>}
            {isBatch && !nameEndsWithNumber && name && (
              <span className="tf-err">O nome deve terminar com um número para criar em lote (ex: cobranca_0)</span>
            )}
            {isBatch && nameEndsWithNumber && name && !nameError && (
              <span className="tf-batch-preview">
                Serão criados: {Array.from({ length: Math.min(Number(quantity) || 0, 3) }, (_, i) => {
                  const m = name.match(/^(.*?)(\d+)$/)
                  if (!m) return null
                  return `${m[1]}${parseInt(m[2], 10) + i + 1}`
                }).filter(Boolean).join(', ')}{Number(quantity) > 3 ? ` … (+${Number(quantity) - 3} mais)` : ''}
              </span>
            )}
          </div>
          <div /> {/* spacer */}
        </div>

        {/* ── Category + Language ── */}
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

        {/* ══════════════════════════════════════════════════════════
            CABEÇALHO
        ══════════════════════════════════════════════════════════ */}
        <div className="tf-section">
          <div className="tf-section-title">Cabeçalho <span className="tf-hint">opcional</span></div>

          <div className="tf-field">
            <label className="tf-label">Tipo de cabeçalho</label>
            <div className="tf-radio-group">
              {HEADER_OPTIONS.map(opt => (
                <label key={opt.value} className={`tf-radio${headerType === opt.value ? ' tf-radio--active' : ''}`}>
                  <input type="radio" name="header" value={opt.value}
                    checked={headerType === opt.value}
                    onChange={() => { setHeaderType(opt.value); setHeaderText(''); setHeaderMediaUrl(''); setHeaderHandleId(''); setHeaderHandleName(''); setUseHandleMode(false) }}
                    disabled={submitting} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {headerType === 'TEXT' && (
            <div className="tf-field">
              <label className="tf-label">Texto do cabeçalho</label>
              <input
                className="tf-input"
                value={headerText}
                onChange={e => setHeaderText(e.target.value)}
                placeholder="Titulo da mensagem"
                maxLength={60}
                disabled={submitting}
              />
              <span className="tf-char-count">{headerText.length}/60</span>
            </div>
          )}

          {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
            <div className="tf-field">
              <label className="tf-label">
                Mídia do cabeçalho
                <span className="tf-hint">obrigatório pela Meta para aprovação</span>
              </label>

              {/* Toggle: Galeria vs URL */}
              <div className="tf-radio-group" style={{ marginBottom: 8 }}>
                <label className={`tf-radio${!useHandleMode ? ' tf-radio--active' : ''}`}>
                  <input type="radio" name="media-mode" checked={!useHandleMode}
                    onChange={() => { setUseHandleMode(false); setHeaderHandleId(''); setHeaderHandleName('') }}
                    disabled={submitting} />
                  URL de exemplo
                </label>
                <label className={`tf-radio${useHandleMode ? ' tf-radio--active' : ''}`}>
                  <input type="radio" name="media-mode" checked={useHandleMode}
                    onChange={() => { setUseHandleMode(true); setHeaderMediaUrl('') }}
                    disabled={submitting} />
                  Galeria de Mídia
                </label>
              </div>

              {useHandleMode ? (
                <MediaPickerInline
                  mediaType={headerType}
                  selectedHandleId={headerHandleId}
                  onSelect={(handle, name) => { setHeaderHandleId(handle); setHeaderHandleName(name) }}
                />
              ) : (
                <>
                  <input
                    className="tf-input"
                    value={headerMediaUrl}
                    onChange={e => setHeaderMediaUrl(e.target.value)}
                    placeholder={
                      headerType === 'IMAGE'    ? 'https://exemplo.com/imagem.jpg' :
                      headerType === 'VIDEO'    ? 'https://exemplo.com/video.mp4' :
                                                  'https://exemplo.com/documento.pdf'
                    }
                    disabled={submitting}
                  />
                  <span className="tf-hint-inline">
                    {headerType === 'IMAGE'    && 'Formatos: JPG, PNG, WEBP — máx 5 MB'}
                    {headerType === 'VIDEO'    && 'Formato: MP4 — máx 16 MB · Use a Galeria de Mídia para garantir aprovação'}
                    {headerType === 'DOCUMENT' && 'Formato: PDF — máx 100 MB · Use a Galeria de Mídia para garantir aprovação'}
                  </span>
                </>
              )}

              {useHandleMode && headerHandleId && (
                <div className="tf-selected-media">
                  <span className="tf-selected-media-name">{headerHandleName}</span>
                  <code className="tf-selected-media-handle">{headerHandleId.slice(0, 16)}…</code>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════
            CORPO DA MENSAGEM
        ══════════════════════════════════════════════════════════ */}
        <div className="tf-section">
          <div className="tf-section-title">Corpo da mensagem</div>

          <div className="tf-field">
            <label className="tf-label">
              Texto <span className="tf-hint">use {'{{1}}'}, {'{{2}}'} para variáveis</span>
            </label>
            <textarea
              className="tf-textarea"
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              placeholder={'Olá, {{1}}! Seu pagamento de R$ {{2}} vence em {{3}} dias.'}
              rows={5}
              disabled={submitting}
            />
            <span className="tf-char-count">{bodyText.length} caracteres</span>
          </div>

          {/* Variable examples */}
          {varIndices.length > 0 && (
            <div className="tf-var-block">
              <p className="tf-var-title">
                <IconVar />
                Exemplos das variáveis
                <span className="tf-var-hint"> — obrigatório pela Meta para aprovação</span>
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
        </div>

        {/* ══════════════════════════════════════════════════════════
            RODAPÉ
        ══════════════════════════════════════════════════════════ */}
        <div className="tf-section">
          <div className="tf-section-title">Rodapé <span className="tf-hint">opcional</span></div>
          <div className="tf-field">
            <label className="tf-label">Texto do rodapé</label>
            <input
              className="tf-input"
              value={footerText}
              onChange={e => setFooterText(e.target.value)}
              placeholder="Não responda a esta mensagem"
              maxLength={60}
              disabled={submitting}
            />
            <span className="tf-char-count">{footerText.length}/60</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            BOTÕES
        ══════════════════════════════════════════════════════════ */}
        <div className="tf-section">
          <div className="tf-section-header">
            <div className="tf-section-title">Botões <span className="tf-hint">opcional — máx 3</span></div>
            {buttons.length < 3 && (
              <button type="button" className="tf-add-btn" onClick={addButton} disabled={submitting}>
                <IconPlus /> Adicionar botão
              </button>
            )}
          </div>

          {buttons.length === 0 && (
            <p className="tf-empty-hint">Nenhum botão adicionado.</p>
          )}

          {buttons.map((btn, i) => (
            <div key={i} className="tf-btn-card">
              <div className="tf-btn-card-header">
                <span className="tf-btn-card-num">Botão {i + 1}</span>
                <button type="button" className="tf-remove-btn" onClick={() => removeButton(i)} disabled={submitting}>
                  <IconTrash />
                </button>
              </div>

              {/* Button type */}
              <div className="tf-field">
                <label className="tf-label">Tipo</label>
                <div className="tf-radio-group">
                  {BTN_TYPES.map(opt => (
                    <label key={opt.value} className={`tf-radio${btn.type === opt.value ? ' tf-radio--active' : ''}`}>
                      <input type="radio" name={`btn-type-${i}`} value={opt.value}
                        checked={btn.type === opt.value}
                        onChange={() => updateButton(i, 'type', opt.value)}
                        disabled={submitting} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Button fields */}
              <div className={`tf-row${btn.type === 'URL' ? ' tf-row--2' : btn.type === 'PHONE_NUMBER' ? ' tf-row--2' : ''}`}>
                <div className="tf-field">
                  <label className="tf-label">Texto do botão</label>
                  <input
                    className="tf-input"
                    value={btn.text}
                    onChange={e => updateButton(i, 'text', e.target.value)}
                    placeholder={
                      btn.type === 'URL'          ? 'Acessar portal' :
                      btn.type === 'PHONE_NUMBER' ? 'Falar com atendente' :
                                                    'Confirmar'
                    }
                    maxLength={25}
                    disabled={submitting}
                  />
                </div>

                {btn.type === 'URL' && (
                  <div className="tf-field">
                    <label className="tf-label">URL de destino</label>
                    <input
                      className="tf-input"
                      value={btn.url}
                      onChange={e => updateButton(i, 'url', e.target.value)}
                      placeholder="https://meusite.com.br/pagamento"
                      disabled={submitting}
                    />
                  </div>
                )}

                {btn.type === 'PHONE_NUMBER' && (
                  <div className="tf-field">
                    <label className="tf-label">Número de telefone</label>
                    <input
                      className="tf-input"
                      value={btn.phone}
                      onChange={e => updateButton(i, 'phone', e.target.value)}
                      placeholder="+5511999999999"
                      disabled={submitting}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════
            PREVIEW
        ══════════════════════════════════════════════════════════ */}
        {bodyText.trim() && (
          <div className="tf-section">
            <div className="tf-section-title">Prévia</div>
            <div className="tf-preview-wrap">
              <div className="tf-bubble">
                {/* Header */}
                {headerType === 'TEXT' && headerText && (
                  <div className="tf-bubble-header">{headerText}</div>
                )}
                {previewIsMedia && (
                  <div className="tf-bubble-media">
                    {headerType === 'IMAGE'    && <span>📷 Imagem</span>}
                    {headerType === 'VIDEO'    && <span>🎬 Vídeo</span>}
                    {headerType === 'DOCUMENT' && <span>📄 Documento</span>}
                  </div>
                )}
                {/* Body */}
                <div className="tf-bubble-body">{bodyText}</div>
                {/* Footer */}
                {footerText && <div className="tf-bubble-footer">{footerText}</div>}
                {/* Buttons */}
                {buttons.filter(b => b.text).length > 0 && (
                  <div className="tf-bubble-buttons">
                    {buttons.filter(b => b.text).map((b, i) => (
                      <div key={i} className="tf-bubble-btn">
                        {b.type === 'URL'          && `🔗 ${b.text}`}
                        {b.type === 'PHONE_NUMBER' && `📞 ${b.text}`}
                        {b.type === 'QUICK_REPLY'  && `↩ ${b.text}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && <div className="tf-error-banner">{error}</div>}

        {/* ── Batch results ── */}
        {displayBatchResults && (
          <div className="tf-batch-results">
            <div className="tf-batch-results-title">
              <IconBatch />
              Resultado da criação em lote
              <span className="tf-batch-summary">
                {displayBatchResults.filter(r => !r.error).length}/{displayBatchResults.length} criados com sucesso
              </span>
            </div>
            <div className="tf-batch-list">
              {displayBatchResults.map((r, i) => (
                <div key={i} className={`tf-batch-row${r.error ? ' tf-batch-row--err' : ' tf-batch-row--ok'}`}>
                  <span className="tf-batch-icon">{r.error ? '✕' : '✓'}</span>
                  <span className="tf-batch-name">{r.name}</span>
                  {r.error
                    ? <span className="tf-batch-msg">{r.error}</span>
                    : <span className="tf-batch-status">{r.status}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="tf-actions">
          <button type="button" className="tf-btn tf-btn--secondary" onClick={onCancel} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="tf-btn tf-btn--primary" disabled={!canSubmit}>
            {submitting
              ? <><span className="tf-spinner" /> {isBatch ? `Criando ${quantity} templates…` : 'Criando…'}</>
              : <><IconSend /> {isBatch ? `Criar ${quantity} templates` : 'Criar template'}</>
            }
          </button>
        </div>

      </form>
    </>
  )
}

// ─── MediaPickerInline ────────────────────────────────────────────────────────

function MediaPickerInline({ mediaType, selectedHandleId, onSelect }) {
  const [medias,  setMedias]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listMedia(mediaType)
      .then(d => setMedias(d.medias || []))
      .catch(() => setMedias([]))
      .finally(() => setLoading(false))
  }, [mediaType])

  if (loading) {
    return <div className="tf-media-picker"><span className="tf-hint" style={{ color: '#4a5568' }}>Carregando galeria…</span></div>
  }

  if (medias.length === 0) {
    return (
      <div className="tf-media-picker">
        <span className="tf-hint" style={{ color: '#4a5568' }}>
          Nenhuma mídia disponível.{' '}
          <a href="/midia" target="_blank" rel="noreferrer" className="tf-link">Abrir Galeria</a>
          {' '}para fazer upload.
        </span>
      </div>
    )
  }

  return (
    <div className="tf-media-picker">
      <div className="tf-media-list">
        {medias.map(m => (
          <div
            key={m.id}
            className={`tf-media-item${selectedHandleId === m.handle_id ? ' tf-media-item--selected' : ''}`}
            onClick={() => onSelect(m.handle_id, m.original_name)}
          >
            <span className="tf-media-item-icon">
              {m.media_type === 'IMAGE' ? '🖼' : m.media_type === 'VIDEO' ? '🎬' : '📄'}
            </span>
            <span className="tf-media-item-name">{m.original_name}</span>
            <span className="tf-media-item-handle">{m.handle_id.slice(0, 14)}…</span>
            {selectedHandleId === m.handle_id && (
              <span className="tf-media-item-check">✓</span>
            )}
          </div>
        ))}
      </div>
      <a href="/midia" target="_blank" rel="noreferrer" className="tf-link" style={{ fontSize: 11 }}>
        Gerenciar galeria →
      </a>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconBatch() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  )
}

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

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12M5 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l1 9.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5L13 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .tf-root {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Section blocks ── */
  .tf-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 0;
    border-bottom: 1px solid #1a1f28;
  }
  .tf-section:first-of-type { padding-top: 0; }
  .tf-section:last-of-type  { border-bottom: none; }

  .tf-section-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #e8edf5;
    letter-spacing: -0.1px;
  }

  .tf-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* ── Grid rows ── */
  .tf-row { display: grid; gap: 14px; }
  .tf-row--2 { grid-template-columns: 1fr 1fr; }
  @media (max-width: 600px) { .tf-row--2 { grid-template-columns: 1fr; } }

  /* ── Fields ── */
  .tf-field { display: flex; flex-direction: column; gap: 5px; }

  .tf-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #8a94a6;
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }

  .tf-hint {
    font-weight: 400;
    color: #374151;
    font-size: 11px;
  }

  .tf-hint-inline {
    font-size: 11px;
    color: #374151;
    font-family: 'DM Sans', sans-serif;
  }

  .tf-char-count {
    font-size: 11px;
    color: #374151;
    font-family: 'JetBrains Mono', monospace;
    text-align: right;
  }

  .tf-err {
    font-size: 11px;
    color: #fca5a5;
    font-family: 'DM Sans', sans-serif;
  }

  .tf-empty-hint {
    font-size: 12px;
    color: #374151;
    font-family: 'DM Sans', sans-serif;
    font-style: italic;
  }

  /* ── Inputs ── */
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
    box-sizing: border-box;
  }
  .tf-input:focus, .tf-select:focus, .tf-textarea:focus { border-color: #22c55e60; }
  .tf-input--err { border-color: #ef444460 !important; }
  .tf-input:disabled, .tf-select:disabled, .tf-textarea:disabled { opacity: 0.5; cursor: not-allowed; }

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

  /* ── Radio groups ── */
  .tf-radio-group { display: flex; flex-wrap: wrap; gap: 7px; }

  .tf-radio {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 13px;
    border-radius: 7px;
    border: 1px solid #252c38;
    background: #1a1f28;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #8a94a6;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    user-select: none;
  }
  .tf-radio input[type="radio"] { display: none; }
  .tf-radio--active { border-color: #22c55e50; background: #22c55e12; color: #86efac; }
  .tf-radio:hover:not(.tf-radio--active) { border-color: #374151; color: #e8edf5; }

  /* ── Variable block ── */
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
    flex-wrap: wrap;
  }
  .tf-var-hint { font-weight: 400; color: #4a7c59; font-size: 11px; }
  .tf-var-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 10px;
  }

  /* ── Button cards ── */
  .tf-btn-card {
    background: #0f1215;
    border: 1px solid #1a1f28;
    border-radius: 9px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tf-btn-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tf-btn-card-num {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #4a5568;
  }

  .tf-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #1a1f28;
    border: 1px dashed #374151;
    border-radius: 7px;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .tf-add-btn:hover:not(:disabled) { color: #8a94a6; border-color: #4a5568; }
  .tf-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .tf-remove-btn {
    width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    background: none;
    border: 1px solid #252c38;
    border-radius: 5px;
    color: #4a5568;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .tf-remove-btn:hover:not(:disabled) { color: #ef4444; border-color: #ef444440; background: #ef444410; }
  .tf-remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Preview bubble ── */
  .tf-preview-wrap {
    display: flex;
    justify-content: flex-end;
    padding: 16px;
    background: #1a4731;
    border-radius: 10px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' opacity='0.05'%3E%3Ccircle cx='20' cy='20' r='10' fill='%2322c55e'/%3E%3C/svg%3E");
  }
  .tf-bubble {
    background: #dcf8c6;
    border-radius: 10px 2px 10px 10px;
    padding: 10px 14px;
    max-width: 88%;
    display: flex;
    flex-direction: column;
    gap: 5px;
    box-shadow: 0 1px 3px #00000030;
  }
  .tf-bubble-header {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    font-family: 'DM Sans', sans-serif;
  }
  .tf-bubble-media {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: #b7e0a0;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #166534;
    font-family: 'DM Sans', sans-serif;
  }
  .tf-bubble-body {
    font-size: 13px;
    color: #1f2937;
    font-family: 'DM Sans', sans-serif;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .tf-bubble-footer {
    font-size: 11px;
    color: #6b7280;
    font-family: 'DM Sans', sans-serif;
    margin-top: 2px;
  }
  .tf-bubble-buttons {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 6px;
    padding-top: 8px;
    border-top: 1px solid #a7d99050;
  }
  .tf-bubble-btn {
    font-size: 12px;
    color: #0ea5e9;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    text-align: center;
    padding: 3px 0;
  }

  /* ── Media picker ── */
  .tf-media-picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tf-media-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #252c38;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }
  .tf-media-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid #1a1f28;
    transition: background 0.12s;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #8a94a6;
  }
  .tf-media-item:last-child { border-bottom: none; }
  .tf-media-item:hover { background: #1a1f28; color: #e8edf5; }
  .tf-media-item--selected { background: #22c55e10; color: #86efac; }
  .tf-media-item-icon { font-size: 14px; flex-shrink: 0; }
  .tf-media-item-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tf-media-item-handle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #4a5568;
    flex-shrink: 0;
  }
  .tf-media-item-check {
    font-size: 11px;
    color: #22c55e;
    font-weight: 700;
    flex-shrink: 0;
  }
  .tf-link { color: #22c55e; text-decoration: none; }
  .tf-link:hover { text-decoration: underline; }

  .tf-selected-media {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #22c55e10;
    border: 1px solid #22c55e30;
    border-radius: 6px;
    margin-top: 4px;
  }
  .tf-selected-media-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #86efac;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tf-selected-media-handle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #4a7c59;
    flex-shrink: 0;
  }

  /* ── Error banner ── */
  .tf-error-banner {
    margin-top: 16px;
    padding: 10px 14px;
    background: #ef444412;
    border: 1px solid #ef444430;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Action buttons ── */
  .tf-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 20px;
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
  .tf-btn--primary { background: #22c55e; color: #0a0c0f; }
  .tf-btn--primary:hover:not(:disabled) { background: #16a34a; }
  .tf-btn--secondary { background: #1a1f28; border: 1px solid #252c38; color: #8a94a6; }
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

  @media (max-width: 640px) {
    .tf-actions {
      flex-direction: row;
      flex-wrap: wrap;
    }
    .tf-actions .tf-btn {
      flex: 1;
      justify-content: center;
      min-height: 42px;
    }
    .tf-root { gap: 18px; padding: 4px 0; }
    .tf-batch-name { min-width: 100px; }
  }

  /* ── Batch preview hint ── */
  .tf-batch-preview {
    font-size: 11px;
    color: #86efac;
    font-family: 'JetBrains Mono', monospace;
    margin-top: 2px;
  }

  /* ── Batch results panel ── */
  .tf-batch-results {
    margin-top: 16px;
    background: #0f1215;
    border: 1px solid #1a1f28;
    border-radius: 10px;
    overflow: hidden;
  }
  .tf-batch-results-title {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #e8edf5;
    background: #141820;
    border-bottom: 1px solid #1a1f28;
  }
  .tf-batch-summary {
    margin-left: auto;
    font-size: 12px;
    font-weight: 400;
    color: #4a5568;
  }
  .tf-batch-list {
    display: flex;
    flex-direction: column;
  }
  .tf-batch-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 16px;
    border-bottom: 1px solid #1a1f2860;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
  }
  .tf-batch-row:last-child { border-bottom: none; }
  .tf-batch-row--ok { background: #22c55e06; }
  .tf-batch-row--err { background: #ef444406; }
  .tf-batch-icon {
    font-size: 11px;
    font-weight: 700;
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }
  .tf-batch-row--ok .tf-batch-icon { color: #22c55e; }
  .tf-batch-row--err .tf-batch-icon { color: #ef4444; }
  .tf-batch-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #e8edf5;
    flex-shrink: 0;
    min-width: 160px;
  }
  .tf-batch-status {
    font-size: 11px;
    color: #4a7c59;
    background: #22c55e15;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }
  .tf-batch-msg {
    font-size: 11px;
    color: #fca5a5;
    flex: 1;
    word-break: break-word;
  }
`
