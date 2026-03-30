import { useMemo } from 'react'

/**
 * Etapa 3 — Personalização por template
 * Renders one panel per selected template.
 *
 * Props:
 *   templates      { templateId, name, structure }[]
 *   columns        string[]                        CSV column names
 *   preview        object[]                        first preview rows
 *   personalisation { [templateId]: { mediaUrl, fixedVars, dynamicVars } }
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
  const structure    = Array.isArray(tpl.structure) ? tpl.structure : []
  const bodyComp     = structure.find(c => c.type === 'BODY')
  const headerComp   = structure.find(c => c.type === 'HEADER')
  const buttonsComp  = structure.find(c => c.type === 'BUTTONS')
  const hasMedia     = headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)

  // Extract variable indices from body text
  const varIndices = useMemo(() => {
    if (!bodyComp?.text) return []
    const matches = [...bodyComp.text.matchAll(/\{\{(\d+)\}\}/g)]
    return [...new Set(matches.map(m => Number(m[1])))].sort((a, b) => a - b)
  }, [bodyComp])

  const fixedVars   = config.fixedVars   || {}
  const dynamicVars = config.dynamicVars || {}
  const mediaUrl    = config.mediaUrl    || ''

  function setFixed(idx, val) {
    onChange({ fixedVars: { ...fixedVars, [String(idx)]: val } })
  }
  function setDynamic(idx, col) {
    const next = { ...dynamicVars }
    if (col === '') delete next[String(idx)]
    else next[String(idx)] = col
    onChange({ dynamicVars: next })
  }
  function setMedia(url) {
    onChange({ mediaUrl: url })
  }

  // Live preview: replace vars in body text using first CSV row
  const livePreview = useMemo(() => {
    if (!bodyComp?.text) return ''
    const row = preview[0] || {}
    return bodyComp.text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
      const col = dynamicVars[n]
      if (col) return row[col] ?? `{{${n}}}`
      return fixedVars[n] || `{{${n}}}`
    })
  }, [bodyComp, dynamicVars, fixedVars, preview])

  return (
    <div className="mc-panel">
      {/* Panel header */}
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

        {/* Variables */}
        {varIndices.length > 0 && (
          <div className="mc-section">
            <p className="mc-section-title">Variáveis da mensagem</p>
            <p className="mc-section-desc">
              Escolha entre preencher um valor fixo (igual para todos) ou
              mapear para uma coluna do CSV (valor diferente por contato).
            </p>
            <div className="mc-vars">
              {varIndices.map(vi => (
                <VarRow
                  key={vi}
                  index={vi}
                  columns={columns}
                  fixedVal={fixedVars[String(vi)] || ''}
                  dynamicCol={dynamicVars[String(vi)] || ''}
                  onFixed={val => setFixed(vi, val)}
                  onDynamic={col => setDynamic(vi, col)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Buttons info (read-only) */}
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

function VarRow({ index, columns, fixedVal, dynamicCol, onFixed, onDynamic }) {
  const mode = dynamicCol ? 'dynamic' : 'fixed'

  return (
    <div className="mc-var-row">
      <span className="mc-var-label">{`{{${index}}}`}</span>
      <div className="mc-var-modes">
        <button
          className={`mc-var-mode${mode === 'fixed' ? ' mc-var-mode--active' : ''}`}
          onClick={() => { onDynamic(''); }}
        >Fixo</button>
        <button
          className={`mc-var-mode${mode === 'dynamic' ? ' mc-var-mode--active' : ''}`}
          onClick={() => { if (columns.length) onDynamic(columns[0]); }}
        >CSV</button>
      </div>
      {mode === 'fixed' ? (
        <input
          className="mc-var-input"
          placeholder={`Valor fixo para {{${index}}}`}
          value={fixedVal}
          onChange={e => onFixed(e.target.value)}
        />
      ) : (
        <select
          className="mc-var-select"
          value={dynamicCol}
          onChange={e => onDynamic(e.target.value)}
        >
          <option value="">— selecione coluna —</option>
          {columns.map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      )}
    </div>
  )
}

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

  .mc-input, .mc-var-input, .mc-var-select {
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 8px; color: #e8edf5;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    padding: 8px 12px; outline: none; width: 100%;
    box-sizing: border-box; transition: border-color 0.15s;
  }
  .mc-input:focus, .mc-var-input:focus, .mc-var-select:focus { border-color: #22c55e60; }
  .mc-var-select {
    cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%234a5568' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px;
  }
  .mc-var-select option { background: #1a1f28; }

  .mc-vars { display: flex; flex-direction: column; gap: 10px; }
  .mc-var-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .mc-var-label {
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: #22c55e; background: #22c55e10; border: 1px solid #22c55e25;
    border-radius: 4px; padding: 3px 8px; white-space: nowrap; flex-shrink: 0;
  }
  .mc-var-modes {
    display: flex; background: #0c0f13;
    border: 1px solid #1a1f28; border-radius: 6px; padding: 2px; flex-shrink: 0;
  }
  .mc-var-mode {
    padding: 3px 10px; border: none; border-radius: 4px;
    background: transparent; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 500;
    color: #4a5568; transition: color 0.15s, background 0.15s;
  }
  .mc-var-mode:hover:not(.mc-var-mode--active) { color: #8a94a6; }
  .mc-var-mode--active { background: #252c38; color: #e8edf5; }
  .mc-var-input, .mc-var-select { flex: 1; min-width: 160px; }

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
    .mc-var-row { flex-direction: column; align-items: flex-start; }
    .mc-var-input, .mc-var-select { min-width: 100%; }
  }
`
