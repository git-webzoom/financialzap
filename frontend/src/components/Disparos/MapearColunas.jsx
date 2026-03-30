import { useMemo, useRef } from 'react'

/**
 * Etapa 3 — Personalização por template
 *
 * Cada variável {{N}} do template vira um campo de texto livre onde o usuário
 * pode escrever qualquer texto e inserir {{nome_coluna}} do CSV onde quiser.
 * Ex: "Olá {{nome}}, seu vencimento é {{data}}."
 *
 * Props:
 *   templates      { templateId, name, structure }[]
 *   columns        string[]           CSV column names
 *   preview        object[]           first preview rows
 *   personalisation { [templateId]: { mediaUrl, varTemplates } }
 *   onChange(templateId, fields)
 */
export default function MapearColunas({ templates, columns, preview, personalisation, onChange }) {
  if (!templates.length) return null

  return (
    <>
      <style>{CSS}</style>
      <div className="mc-root">
        {templates.map((tpl, idx) => (
          <TemplatePanel
            key={tpl.templateId}
            tpl={tpl}
            idx={idx}
            columns={columns}
            preview={preview}
            config={personalisation[tpl.templateId] || {}}
            onChange={(fields) => onChange(tpl.templateId, fields)}
          />
        ))}
      </div>
    </>
  )
}

function TemplatePanel({ tpl, idx, columns, preview, config, onChange }) {
  const structure   = Array.isArray(tpl.structure) ? tpl.structure : []
  const bodyComp    = structure.find(c => c.type === 'BODY')
  const headerComp  = structure.find(c => c.type === 'HEADER')
  const buttonsComp = structure.find(c => c.type === 'BUTTONS')
  const hasMedia    = headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)

  // Variable indices declared in the template body
  const varIndices = useMemo(() => {
    if (!bodyComp?.text) return []
    const matches = [...bodyComp.text.matchAll(/\{\{(\d+)\}\}/g)]
    return [...new Set(matches.map(m => Number(m[1])))].sort((a, b) => a - b)
  }, [bodyComp])

  const varTemplates = config.varTemplates || {}   // { "1": "Olá {{nome}}", "2": "{{valor}}" }
  const mediaUrl     = config.mediaUrl    || ''

  function setVarTemplate(varIdx, value) {
    onChange({ varTemplates: { ...varTemplates, [String(varIdx)]: value } })
  }
  function setMedia(url) {
    onChange({ mediaUrl: url })
  }

  // Live preview: resolve the whole body by:
  //   1. Replace each {{N}} with the varTemplate string for that index
  //   2. Then replace {{coluna}} tokens in that string with the first CSV row value
  const livePreview = useMemo(() => {
    if (!bodyComp?.text) return ''
    const row = preview[0] || {}
    return bodyComp.text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
      const tplStr = varTemplates[n] || `{{${n}}}`
      // resolve {{coluna}} references using first CSV row
      return tplStr.replace(/\{\{([^}]+)\}\}/g, (m, col) => {
        return row[col] !== undefined ? String(row[col]) : m
      })
    })
  }, [bodyComp, varTemplates, preview])

  return (
    <div className="mc-panel">
      <div className="mc-panel-header">
        <span className="mc-panel-num">Template {idx + 1}</span>
        <span className="mc-panel-name">{tpl.name}</span>
      </div>

      <div className="mc-panel-body">

        {/* Media URL */}
        {hasMedia && (
          <div className="mc-section">
            <p className="mc-section-title">
              Mídia
              <span className="mc-section-hint">
                {headerComp.format === 'IMAGE'    && 'Imagem (JPG/PNG)'}
                {headerComp.format === 'VIDEO'    && 'Vídeo (MP4)'}
                {headerComp.format === 'DOCUMENT' && 'Documento (PDF)'}
              </span>
            </p>
            <input
              className="mc-input"
              placeholder={
                headerComp.format === 'IMAGE'    ? 'https://…/imagem.jpg' :
                headerComp.format === 'VIDEO'    ? 'https://…/video.mp4' :
                                                   'https://…/documento.pdf'
              }
              value={mediaUrl}
              onChange={e => setMedia(e.target.value)}
            />
          </div>
        )}

        {/* Variable fields */}
        {varIndices.length > 0 && (
          <div className="mc-section">
            <p className="mc-section-title">Variáveis da mensagem</p>
            <p className="mc-section-desc">
              Para cada variável, escreva o texto que será enviado.
              Clique em um <strong>campo de coluna</strong> para inserir o valor da planilha naquele ponto.
            </p>

            {/* Column chips legend */}
            {columns.length > 0 && (
              <div className="mc-cols-legend">
                <span className="mc-cols-legend-label">Colunas disponíveis:</span>
                {columns.map(col => (
                  <span key={col} className="mc-chip mc-chip--legend">
                    {`{{${col}}}`}
                  </span>
                ))}
              </div>
            )}

            <div className="mc-vars">
              {varIndices.map(vi => (
                <VarField
                  key={vi}
                  index={vi}
                  columns={columns}
                  value={varTemplates[String(vi)] || ''}
                  onChange={val => setVarTemplate(vi, val)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Buttons (read-only) */}
        {buttonsComp?.buttons?.length > 0 && (
          <div className="mc-section">
            <p className="mc-section-title">Botões <span className="mc-section-hint">somente leitura</span></p>
            <div className="mc-btns-info">
              {buttonsComp.buttons.map((btn, i) => (
                <div key={i} className="mc-btn-info">
                  <span className="mc-btn-type">{btn.type}</span>
                  <span className="mc-btn-text">{btn.text}</span>
                  {btn.url && <span className="mc-btn-url">{btn.url}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live preview */}
        {bodyComp?.text && (
          <div className="mc-section">
            <p className="mc-section-title">Prévia com primeiro contato do CSV</p>
            <div className="mc-preview-bubble">
              {hasMedia && (
                <div className="mc-preview-media">
                  {headerComp.format === 'IMAGE'    && '📷 Imagem'}
                  {headerComp.format === 'VIDEO'    && '🎬 Vídeo'}
                  {headerComp.format === 'DOCUMENT' && '📄 Documento'}
                </div>
              )}
              <p className="mc-preview-body">{livePreview}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── VarField ─────────────────────────────────────────────────────────────────

/**
 * A textarea for one template variable ({{N}}).
 * Column chips insert {{coluna}} at the cursor position.
 */
function VarField({ index, columns, value, onChange }) {
  const ref = useRef(null)

  function insertColAtCursor(col) {
    const el    = ref.current
    if (!el) { onChange(value + `{{${col}}}`); return }
    const start = el.selectionStart
    const end   = el.selectionEnd
    const token = `{{${col}}}`
    const next  = value.slice(0, start) + token + value.slice(end)
    onChange(next)
    // restore cursor after the inserted token
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  return (
    <div className="mc-var-field">
      <div className="mc-var-field-header">
        <span className="mc-var-label">{`{{${index}}}`}</span>
        <span className="mc-var-hint">variável {index} do template</span>
      </div>

      <textarea
        ref={ref}
        className="mc-var-textarea"
        rows={2}
        placeholder={`Texto para {{${index}}}… ex: Olá {{nome}}, sua fatura vence em {{data}}.`}
        value={value}
        onChange={e => onChange(e.target.value)}
      />

      {/* Column insertion chips */}
      {columns.length > 0 && (
        <div className="mc-chip-row">
          <span className="mc-chip-row-label">Inserir coluna:</span>
          {columns.map(col => (
            <button
              key={col}
              type="button"
              className="mc-chip mc-chip--insert"
              onClick={() => insertColAtCursor(col)}
              title={`Inserir {{${col}}} no cursor`}
            >
              + {col}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .mc-root { display: flex; flex-direction: column; gap: 16px; }

  .mc-panel {
    background: #0f1215; border: 1px solid #1a1f28;
    border-radius: 12px; overflow: hidden;
  }
  .mc-panel-header {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 18px; background: #141820;
    border-bottom: 1px solid #1a1f28;
  }
  .mc-panel-num {
    font-size: 11px; font-weight: 600; color: #22c55e;
    background: #22c55e15; border: 1px solid #22c55e30;
    border-radius: 4px; padding: 2px 8px;
    font-family: 'DM Sans', sans-serif; white-space: nowrap;
  }
  .mc-panel-name {
    font-family: 'JetBrains Mono', monospace; font-size: 13px;
    color: #8a94a6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .mc-panel-body { padding: 18px; display: flex; flex-direction: column; gap: 20px; }

  .mc-section { display: flex; flex-direction: column; gap: 10px; }
  .mc-section-title {
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    font-weight: 600; color: #8a94a6;
    display: flex; align-items: center; gap: 8px; margin: 0;
  }
  .mc-section-hint { font-weight: 400; color: #374151; font-size: 11px; }
  .mc-section-desc {
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    color: #374151; margin: 0; line-height: 1.5;
  }
  .mc-section-desc strong { color: #8a94a6; font-weight: 600; }

  /* ── Input / URL field ── */
  .mc-input {
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 8px; color: #e8edf5;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    padding: 8px 12px; outline: none; width: 100%;
    box-sizing: border-box; transition: border-color 0.15s;
  }
  .mc-input:focus { border-color: #22c55e60; }

  /* ── Columns legend ── */
  .mc-cols-legend {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    padding: 8px 12px; background: #0c0f13;
    border: 1px solid #1a1f28; border-radius: 8px;
  }
  .mc-cols-legend-label {
    font-family: 'DM Sans', sans-serif; font-size: 11px; color: #4a5568;
    white-space: nowrap;
  }

  /* ── Chips ── */
  .mc-chip {
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    border-radius: 4px; padding: 2px 7px; white-space: nowrap;
  }
  .mc-chip--legend {
    background: #22c55e10; border: 1px solid #22c55e25; color: #22c55e80;
  }
  .mc-chip--insert {
    background: #1a1f28; border: 1px solid #252c38; color: #8a94a6;
    cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .mc-chip--insert:hover {
    background: #22c55e15; border-color: #22c55e40; color: #22c55e;
  }

  /* ── Variable fields ── */
  .mc-vars { display: flex; flex-direction: column; gap: 14px; }

  .mc-var-field {
    display: flex; flex-direction: column; gap: 7px;
    background: #0c0f13; border: 1px solid #1a1f28;
    border-radius: 10px; padding: 12px 14px;
  }
  .mc-var-field-header {
    display: flex; align-items: center; gap: 8px;
  }
  .mc-var-label {
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: #22c55e; background: #22c55e10; border: 1px solid #22c55e25;
    border-radius: 4px; padding: 2px 8px; white-space: nowrap; flex-shrink: 0;
  }
  .mc-var-hint {
    font-family: 'DM Sans', sans-serif; font-size: 11px; color: #374151;
  }

  .mc-var-textarea {
    background: #141820; border: 1px solid #252c38;
    border-radius: 7px; color: #e8edf5;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    padding: 8px 12px; outline: none; width: 100%;
    box-sizing: border-box; resize: vertical; line-height: 1.5;
    transition: border-color 0.15s;
  }
  .mc-var-textarea:focus { border-color: #22c55e60; }
  .mc-var-textarea::placeholder { color: #374151; }

  /* ── Column insertion chips row ── */
  .mc-chip-row {
    display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  }
  .mc-chip-row-label {
    font-family: 'DM Sans', sans-serif; font-size: 11px; color: #374151;
    white-space: nowrap;
  }

  /* ── Buttons info ── */
  .mc-btns-info { display: flex; flex-direction: column; gap: 6px; }
  .mc-btn-info {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 12px; background: #141820;
    border: 1px solid #1a1f28; border-radius: 7px; flex-wrap: wrap;
  }
  .mc-btn-type {
    font-size: 10px; font-weight: 600; color: #4a5568;
    font-family: 'DM Sans', sans-serif; text-transform: uppercase; letter-spacing: 0.4px;
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 4px; padding: 2px 6px;
  }
  .mc-btn-text { font-size: 12px; color: #8a94a6; font-family: 'DM Sans', sans-serif; }
  .mc-btn-url  { font-size: 11px; color: #374151; font-family: 'JetBrains Mono', monospace; }

  /* ── Live preview ── */
  .mc-preview-bubble {
    background: #dcf8c6; border-radius: 10px 2px 10px 10px;
    padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
    max-width: 360px; box-shadow: 0 1px 3px #00000030;
  }
  .mc-preview-media {
    font-size: 12px; color: #166534; background: #b7e0a0;
    border-radius: 5px; padding: 5px 10px; font-family: 'DM Sans', sans-serif;
    font-weight: 500;
  }
  .mc-preview-body {
    font-size: 13px; color: #1f2937; font-family: 'DM Sans', sans-serif;
    line-height: 1.55; white-space: pre-wrap; word-break: break-word; margin: 0;
  }

  @media (max-width: 640px) {
    .mc-chip-row { gap: 4px; }
    .mc-var-textarea { font-size: 12px; }
  }
`
