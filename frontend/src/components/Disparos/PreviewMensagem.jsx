import { useState } from 'react'

/**
 * Etapa 4 — Revisão completa antes de disparar
 * Props:
 *   draft          full useCampanha draft object
 *   wabas          WABA list (to resolve names)
 *   phones         phone number list (to resolve display names)
 *   onTest(phone)  called when user clicks "Enviar Teste"
 *   testing        bool
 *   testResult     { ok, error } | null
 */
export default function PreviewMensagem({ draft, wabas = [], phones = [], onTest, testing, testResult }) {
  const {
    name, wabaId, phoneNumberId, speed, scheduleType, scheduledAt,
    templates, splitMode, weights, totalRows, personalisation, columns,
  } = draft

  const waba  = wabas.find(w => w.waba_id === wabaId)
  const phone = phones.find(p => p.phone_number_id === phoneNumberId)

  const CATEGORY_LABELS = { MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação' }

  // Per-template contact counts (mirror campanha.service logic)
  function computeCounts() {
    if (!templates.length) return []
    const n = templates.length
    if (splitMode === 'equal') {
      const base = Math.floor(totalRows / n)
      return templates.map((_, i) =>
        i === n - 1 ? totalRows - base * (n - 1) : base
      )
    }
    // weighted
    const total = weights.reduce((s, w) => s + w, 0) || 1
    const exact   = weights.map(w => (w / total) * totalRows)
    const floored = exact.map(Math.floor)
    const rem     = totalRows - floored.reduce((s, c) => s + c, 0)
    const fracs   = exact.map((e, i) => ({ i, frac: e - floored[i] }))
    fracs.sort((a, b) => b.frac - a.frac)
    for (let k = 0; k < rem; k++) floored[fracs[k].i]++
    return floored
  }

  const counts = computeCounts()

  return (
    <>
      <style>{CSS}</style>
      <div className="pm-root">

        {/* Campaign summary */}
        <div className="pm-card">
          <p className="pm-card-title">Resumo da campanha</p>
          <div className="pm-grid">
            <PmItem label="Nome"       value={name || '—'} />
            <PmItem label="WABA"       value={waba?.name || wabaId || '—'} />
            <PmItem label="Número"     value={phone ? `${phone.display_phone_number} — ${phone.verified_name || ''}` : phoneNumberId || '—'} />
            <PmItem label="Velocidade" value={`${speed} msg/s`} />
            <PmItem label="Disparo"    value={scheduleType === 'immediate' ? 'Imediato' : `Agendado: ${formatDate(scheduledAt)}`} />
            <PmItem label="Contatos"   value={totalRows.toLocaleString('pt-BR')} />
            <PmItem label="Divisão"    value={splitMode === 'equal' ? 'Igual' : 'Por peso'} />
            <PmItem label="Colunas CSV" value={columns.length ? columns.join(', ') : '—'} />
          </div>
        </div>

        {/* Templates */}
        <div className="pm-card">
          <p className="pm-card-title">{templates.length} template{templates.length !== 1 ? 's' : ''} selecionado{templates.length !== 1 ? 's' : ''}</p>
          <div className="pm-templates">
            {templates.map((tpl, i) => {
              const struct  = Array.isArray(tpl.structure) ? tpl.structure : []
              const body    = struct.find(c => c.type === 'BODY')
              const header  = struct.find(c => c.type === 'HEADER')
              const footer  = struct.find(c => c.type === 'FOOTER')
              const buttons = struct.find(c => c.type === 'BUTTONS')
              const pers    = personalisation[tpl.templateId] || {}
              const hasMedia = header && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format)

              return (
                <div key={tpl.templateId} className="pm-tpl">
                  <div className="pm-tpl-header">
                    <span className="pm-tpl-idx">{i + 1}</span>
                    <span className="pm-tpl-name">{tpl.name}</span>
                    <span className="pm-tpl-count">{(counts[i] || 0).toLocaleString('pt-BR')} contatos</span>
                    {splitMode === 'weighted' && (
                      <span className="pm-tpl-pct">{weights[i]}%</span>
                    )}
                  </div>

                  <div className="pm-bubble-wrap">
                    <div className="pm-bubble">
                      {hasMedia && (
                        <div className="pm-bubble-media">
                          {header.format === 'IMAGE'    && '📷 Imagem'}
                          {header.format === 'VIDEO'    && '🎬 Vídeo'}
                          {header.format === 'DOCUMENT' && '📄 Documento'}
                          {pers.mediaUrl && <span className="pm-media-url">{pers.mediaUrl}</span>}
                        </div>
                      )}
                      {body && <p className="pm-bubble-body">{body.text}</p>}
                      {footer && <p className="pm-bubble-footer">{footer.text}</p>}
                      {buttons?.buttons?.length > 0 && (
                        <div className="pm-bubble-btns">
                          {buttons.buttons.map((btn, j) => (
                            <div key={j} className="pm-bubble-btn">{btn.text}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Variable mapping summary */}
                  {(Object.keys(pers.fixedVars || {}).length > 0 || Object.keys(pers.dynamicVars || {}).length > 0) && (
                    <div className="pm-vars-summary">
                      {Object.entries(pers.fixedVars || {}).map(([k, v]) => (
                        <span key={`f${k}`} className="pm-var-tag pm-var-tag--fixed">
                          {`{{${k}}}`} = "{v}"
                        </span>
                      ))}
                      {Object.entries(pers.dynamicVars || {}).map(([k, col]) => (
                        <span key={`d${k}`} className="pm-var-tag pm-var-tag--dynamic">
                          {`{{${k}}}`} ← coluna "{col}"
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Test send */}
        {templates.length > 0 && (
          <TestSend
            firstTemplate={templates[0]}
            onTest={onTest}
            testing={testing}
            testResult={testResult}
          />
        )}
      </div>
    </>
  )
}

function TestSend({ firstTemplate, onTest, testing, testResult }) {
  const [phone, setPhone] = useState('')
  const digits = phone.replace(/\D/g, '')
  const canTest = digits.length >= 10 && digits.length <= 15 && !testing

  return (
    <div className="pm-card pm-test-card">
      <p className="pm-card-title">Disparo de teste</p>
      <p className="pm-test-desc">
        Envia uma mensagem de teste usando o primeiro template selecionado
        (<span className="pm-test-tname">{firstTemplate.name}</span>).
      </p>
      <div className="pm-test-row">
        <input
          className="pm-test-input"
          placeholder="5511999990001"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          disabled={testing}
        />
        <button
          className="pm-test-btn"
          disabled={!canTest}
          onClick={() => onTest(digits)}
        >
          {testing ? <><span className="pm-spinner" /> Enviando…</> : '↗ Enviar Teste'}
        </button>
      </div>
      <p className="pm-test-hint">Formato internacional sem + (ex: 5511999990001)</p>
      {testResult && (
        <div className={`pm-test-result${testResult.ok ? ' pm-test-result--ok' : ' pm-test-result--err'}`}>
          {testResult.ok
            ? '✓ Mensagem de teste enviada com sucesso!'
            : `✕ Erro: ${testResult.error}`}
        </div>
      )}
    </div>
  )
}

function PmItem({ label, value }) {
  return (
    <div className="pm-item">
      <span className="pm-item-label">{label}</span>
      <span className="pm-item-value">{value}</span>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

const CSS = `
  .pm-root { display: flex; flex-direction: column; gap: 16px; }

  .pm-card {
    background: #0f1215; border: 1px solid #1a1f28;
    border-radius: 12px; padding: 18px 20px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .pm-card-title {
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    font-weight: 600; color: #8a94a6; margin: 0;
  }

  .pm-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 10px 24px;
  }
  .pm-item { display: flex; flex-direction: column; gap: 2px; }
  .pm-item-label { font-size: 10px; color: #4a5568; font-family: 'DM Sans', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; }
  .pm-item-value { font-size: 13px; color: #e8edf5; font-family: 'DM Sans', sans-serif; word-break: break-word; }

  .pm-templates { display: flex; flex-direction: column; gap: 12px; }

  .pm-tpl {
    background: #141820; border: 1px solid #1a1f28;
    border-radius: 10px; overflow: hidden;
    display: flex; flex-direction: column; gap: 12px;
    padding: 14px 16px;
  }
  .pm-tpl-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .pm-tpl-idx {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    background: #22c55e20; border: 1px solid #22c55e30;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #22c55e;
    font-family: 'JetBrains Mono', monospace;
  }
  .pm-tpl-name {
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: #8a94a6; flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pm-tpl-count {
    font-size: 12px; color: #22c55e;
    font-family: 'JetBrains Mono', monospace;
    background: #22c55e10; border: 1px solid #22c55e25;
    border-radius: 5px; padding: 2px 8px; white-space: nowrap;
  }
  .pm-tpl-pct {
    font-size: 12px; color: #4a5568;
    font-family: 'JetBrains Mono', monospace;
  }

  .pm-bubble-wrap { display: flex; justify-content: flex-end; padding: 10px; background: #1a4731; border-radius: 8px; }
  .pm-bubble {
    background: #dcf8c6; border-radius: 10px 2px 10px 10px;
    padding: 10px 14px; max-width: 90%;
    display: flex; flex-direction: column; gap: 5px;
    box-shadow: 0 1px 3px #00000030;
  }
  .pm-bubble-media {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: #166534; font-family: 'DM Sans', sans-serif;
    font-weight: 500; background: #b7e0a0;
    border-radius: 5px; padding: 5px 10px;
  }
  .pm-media-url {
    font-size: 10px; color: #166534;
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;
  }
  .pm-bubble-body {
    font-size: 13px; color: #1f2937; font-family: 'DM Sans', sans-serif;
    line-height: 1.55; white-space: pre-wrap; word-break: break-word; margin: 0;
  }
  .pm-bubble-footer { font-size: 11px; color: #6b7280; font-family: 'DM Sans', sans-serif; margin: 0; }
  .pm-bubble-btns { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; padding-top: 6px; border-top: 1px solid #a7d99030; }
  .pm-bubble-btn { font-size: 12px; color: #0ea5e9; font-family: 'DM Sans', sans-serif; font-weight: 500; text-align: center; }

  .pm-vars-summary { display: flex; flex-wrap: wrap; gap: 6px; }
  .pm-var-tag {
    font-size: 11px; font-family: 'JetBrains Mono', monospace;
    border-radius: 5px; padding: 3px 8px;
  }
  .pm-var-tag--fixed   { background: #1a1f28; border: 1px solid #252c38; color: #8a94a6; }
  .pm-var-tag--dynamic { background: #22c55e10; border: 1px solid #22c55e25; color: #86efac; }

  /* Test card */
  .pm-test-card { gap: 10px; }
  .pm-test-desc { font-size: 13px; color: #4a5568; font-family: 'DM Sans', sans-serif; margin: 0; }
  .pm-test-tname { font-family: 'JetBrains Mono', monospace; color: #8a94a6; }
  .pm-test-row { display: flex; gap: 8px; }
  .pm-test-input {
    flex: 1; background: #1a1f28; border: 1px solid #252c38;
    border-radius: 8px; color: #e8edf5;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    padding: 9px 12px; outline: none; transition: border-color 0.15s;
  }
  .pm-test-input:focus { border-color: #22c55e60; }
  .pm-test-input:disabled { opacity: 0.5; }
  .pm-test-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 16px; background: #22c55e; border: none;
    border-radius: 8px; color: #0a0c0f;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s; white-space: nowrap;
  }
  .pm-test-btn:hover:not(:disabled) { background: #16a34a; }
  .pm-test-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .pm-test-hint { font-size: 11px; color: #374151; font-family: 'DM Sans', sans-serif; margin: 0; }
  .pm-spinner {
    width: 13px; height: 13px;
    border: 2px solid #0a0c0f40; border-top-color: #0a0c0f;
    border-radius: 50%; animation: pm-spin 0.7s linear infinite; display: inline-block;
  }
  @keyframes pm-spin { to { transform: rotate(360deg); } }
  .pm-test-result {
    padding: 10px 14px; border-radius: 8px;
    font-size: 13px; font-family: 'DM Sans', sans-serif; line-height: 1.5;
  }
  .pm-test-result--ok  { background: #22c55e12; border: 1px solid #22c55e30; color: #86efac; }
  .pm-test-result--err { background: #ef444412; border: 1px solid #ef444430; color: #fca5a5; }

  @media (max-width: 640px) {
    .pm-grid { grid-template-columns: 1fr; }
    .pm-test-row { flex-direction: column; }
    .pm-test-btn { justify-content: center; }
  }
`
