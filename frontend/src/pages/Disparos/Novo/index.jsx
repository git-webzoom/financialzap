import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCampanha }        from '../../../hooks/useCampanha'
import { useTemplates }       from '../../../hooks/useTemplates'
import { useWabas }           from '../../../hooks/useWabas'
import * as wabaService       from '../../../services/wabaService'
import * as templateService   from '../../../services/templateService'
import UploadCSV              from '../../../components/Disparos/UploadCSV'
import SelecionarTemplates    from '../../../components/Disparos/SelecionarTemplates'
import MapearColunas          from '../../../components/Disparos/MapearColunas'
import PreviewMensagem        from '../../../components/Disparos/PreviewMensagem'

const STEPS = [
  { num: 1, label: 'Upload CSV'     },
  { num: 2, label: 'Configuração'   },
  { num: 3, label: 'Personalização' },
  { num: 4, label: 'Revisão'        },
]

export default function DisparosNovo() {
  const [step, setStep] = useState(1)
  const navigate = useNavigate()

  const {
    draft, uploading, uploadError,
    submitting, submitError,
    campaignId,
    setConfig, setPersonalisation, uploadFile, submit, reset,
  } = useCampanha()

  const { templates: allTemplates, loading: loadingTpls, load: loadTemplates } = useTemplates()
  const { groups, load: loadWabas } = useWabas()

  const wabas  = useMemo(() => groups.flatMap(g => g.wabas), [groups])
  const [phones, setPhones]   = useState([])

  // Load WABAs + templates on mount
  useEffect(() => { loadWabas(); loadTemplates() }, [loadWabas, loadTemplates])

  // Load phone numbers when wabaId changes
  useEffect(() => {
    if (!draft.wabaId) { setPhones([]); return }
    wabaService.getPhoneNumbers(draft.wabaId)
      .then(r => {
        const list = r.phone_numbers || []
        setPhones(list)
        if (list.length && !draft.phoneNumberId) {
          setConfig({ phoneNumberId: list[0].phone_number_id })
        }
      })
      .catch(() => setPhones([]))
  }, [draft.wabaId]) // eslint-disable-line

  // Test send state
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState(null)

  const handleTest = useCallback(async (toPhone) => {
    if (!draft.templates.length) return
    setTesting(true)
    setTestResult(null)
    const firstTpl = draft.templates[0]
    const pers     = draft.personalisation[firstTpl.templateId] || {}
    try {
      await templateService.sendTestMessage(firstTpl.templateId, {
        phone_number_id: draft.phoneNumberId,
        to: toPhone,
        variables:  pers.varTemplates || {},
        media_url:  pers.mediaUrl || '',
      })
      setTestResult({ ok: true })
    } catch (err) {
      setTestResult({ ok: false, error: err.response?.data?.error || err.message })
    } finally {
      setTesting(false)
    }
  }, [draft])

  // Validation per step
  const stepValid = useMemo(() => ({
    1: draft.columns.length > 0 && !!draft.phoneColumn,
    2: !!(draft.name.trim() && draft.wabaId && draft.phoneNumberId && draft.templates.length > 0),
    3: true, // personalisation is optional
    4: true,
  }), [draft])

  function handleNext() { if (step < 4 && stepValid[step]) setStep(s => s + 1) }
  function handleBack() { if (step > 1) setStep(s => s - 1) }

  async function handleSubmit() {
    try {
      await submit()
      // Redirect to history so the user sees the new campaign (running or scheduled)
      navigate('/disparos/historico')
    } catch {
      // error shown via submitError
    }
  }

  // ── Now scheduling fields helpers ──────────────────────────────────────────
  // datetime-local inputs work in LOCAL time — never use toISOString() (UTC).
  // Pad helper for local date parts
  const nowIso = useMemo(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 30)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }, [])

  return (
    <>
      <style>{CSS}</style>
      <div className="page-root">

        {/* ── Header ── */}
        <div className="wz-header">
          <div>
            <h1 className="wz-title">Novo disparo</h1>
            <p className="wz-sub">Configure e dispare sua campanha em 4 etapas</p>
          </div>
        </div>

        {/* ── Stepper ── */}
        {step <= 4 && (
          <div className="wz-stepper">
            {STEPS.map(s => (
              <div key={s.num} className={`wz-step${step === s.num ? ' wz-step--active' : ''}${step > s.num ? ' wz-step--done' : ''}`}>
                <div className="wz-step-circle">
                  {step > s.num ? <IconCheck /> : s.num}
                </div>
                <span className="wz-step-label">{s.label}</span>
                {s.num < 4 && <div className="wz-step-line" />}
              </div>
            ))}
          </div>
        )}

        {/* ── Step panels ── */}
        <div className="wz-body">

          {/* ─ Step 1: Upload CSV ─ */}
          {step === 1 && (
            <StepPanel title="Upload do arquivo CSV">
              <UploadCSV
                onFile={uploadFile}
                uploading={uploading}
                uploadError={uploadError}
                columns={draft.columns}
                preview={draft.preview}
                totalRows={draft.totalRows}
                phoneColumn={draft.phoneColumn}
                onPhoneColumn={col => setConfig({ phoneColumn: col })}
              />
              {draft.columns.length > 0 && !draft.phoneColumn && (
                <p className="wz-hint" style={{ color: '#f59e0b' }}>
                  ⚠ Selecione a coluna do telefone para continuar.
                </p>
              )}
            </StepPanel>
          )}

          {/* ─ Step 2: Configuration ─ */}
          {step === 2 && (
            <StepPanel title="Configuração do disparo">
              <div className="wz-form">

                {/* Campaign name */}
                <div className="wz-field">
                  <label className="wz-label">Nome da campanha</label>
                  <input
                    className="wz-input"
                    placeholder="Ex: Promo Junho 2025"
                    value={draft.name}
                    onChange={e => setConfig({ name: e.target.value })}
                  />
                </div>

                {/* WABA */}
                <div className="wz-field">
                  <label className="wz-label">WABA</label>
                  <select className="wz-select" value={draft.wabaId} onChange={e => setConfig({ wabaId: e.target.value, phoneNumberId: '', templates: [], weights: [] })}>
                    <option value="">— selecione a WABA —</option>
                    {wabas.map(w => <option key={w.waba_id} value={w.waba_id}>{w.name || w.waba_id}</option>)}
                  </select>
                </div>

                {/* Phone number */}
                {draft.wabaId && (
                  <div className="wz-field">
                    <label className="wz-label">Número de origem</label>
                    {phones.length === 0 ? (
                      <p className="wz-hint">Nenhum número encontrado nessa WABA.</p>
                    ) : (
                      <select className="wz-select" value={draft.phoneNumberId} onChange={e => setConfig({ phoneNumberId: e.target.value })}>
                        {phones.map(p => (
                          <option key={p.phone_number_id} value={p.phone_number_id}>
                            {p.display_phone_number} — {p.verified_name || ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Speed */}
                <div className="wz-field">
                  <label className="wz-label">Velocidade <span className="wz-label-hint">mensagens por segundo</span></label>
                  <input
                    className="wz-input"
                    type="number" min={1} max={80}
                    value={draft.speed}
                    onChange={e => setConfig({ speed: Math.max(1, Math.min(80, parseInt(e.target.value) || 1)) })}
                  />
                </div>

                {/* Schedule type */}
                <div className="wz-field">
                  <label className="wz-label">Tipo de disparo</label>
                  <div className="wz-radio-group">
                    {[
                      { value: 'immediate', label: 'Imediato' },
                      { value: 'scheduled', label: 'Agendado' },
                    ].map(opt => (
                      <label key={opt.value} className={`wz-radio-card${draft.scheduleType === opt.value ? ' wz-radio-card--active' : ''}`}>
                        <input
                          type="radio" name="scheduleType" value={opt.value}
                          checked={draft.scheduleType === opt.value}
                          onChange={() => setConfig({ scheduleType: opt.value })}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {draft.scheduleType === 'scheduled' && (
                  <div className="wz-field">
                    <label className="wz-label">Data e hora do disparo</label>
                    <input
                      className="wz-input"
                      type="datetime-local"
                      min={nowIso}
                      value={draft.scheduledAt}
                      onChange={e => setConfig({ scheduledAt: e.target.value })}
                    />
                  </div>
                )}

                {/* Template selection */}
                <div className="wz-field">
                  <label className="wz-label">Templates</label>
                  {!draft.wabaId ? (
                    <p className="wz-hint">Selecione uma WABA para ver os templates disponíveis.</p>
                  ) : loadingTpls ? (
                    <p className="wz-hint">Carregando templates…</p>
                  ) : (
                    <SelecionarTemplates
                      availableTemplates={allTemplates.filter(t =>
                        t.status?.toUpperCase() === 'APPROVED' &&
                        t.waba_id === draft.wabaId
                      )}
                      selected={draft.templates}
                      splitMode={draft.splitMode}
                      weights={draft.weights}
                      totalRows={draft.totalRows}
                      onChange={({ templates, splitMode, weights }) =>
                        setConfig({ templates, splitMode, weights })
                      }
                    />
                  )}
                </div>

              </div>
            </StepPanel>
          )}

          {/* ─ Step 3: Personalisation ─ */}
          {step === 3 && (
            <StepPanel title="Personalização das mensagens">
              {draft.templates.length === 0 ? (
                <p className="wz-hint">Volte ao passo anterior e selecione ao menos um template.</p>
              ) : (
                <MapearColunas
                  templates={draft.templates}
                  columns={draft.columns}
                  preview={draft.preview}
                  personalisation={draft.personalisation}
                  onChange={setPersonalisation}
                />
              )}
            </StepPanel>
          )}

          {/* ─ Step 4: Review ─ */}
          {step === 4 && (
            <StepPanel title="Revisão e confirmação">
              <PreviewMensagem
                draft={draft}
                wabas={wabas}
                phones={phones}
                onTest={handleTest}
                testing={testing}
                testResult={testResult}
              />
              {submitError && (
                <div className="wz-banner wz-banner--err">⚠ {submitError}</div>
              )}
            </StepPanel>
          )}

          {/* ─ Done ─ */}
          {step === 5 && (
            <div className="wz-done">
              <div className="wz-done-icon"><IconSuccess /></div>
              <p className="wz-done-title">Campanha criada com sucesso!</p>
              <p className="wz-done-sub">
                {campaignId
                  ? `ID da campanha: ${campaignId}`
                  : 'Os disparos foram enfileirados e serão processados em breve.'}
              </p>
              <div className="wz-done-actions">
                <button className="wz-btn wz-btn--secondary" onClick={() => { reset(); setStep(1) }}>
                  Nova campanha
                </button>
                <a className="wz-btn wz-btn--primary" href="/disparos/historico">
                  Ver histórico
                </a>
              </div>
            </div>
          )}

        </div>

        {/* ── Navigation ── */}
        {step <= 4 && (
          <div className="wz-nav">
            <button
              className="wz-btn wz-btn--secondary"
              onClick={step === 1 ? undefined : handleBack}
              disabled={step === 1}
            >
              ← Voltar
            </button>

            {step < 4 ? (
              <button
                className="wz-btn wz-btn--primary"
                onClick={handleNext}
                disabled={!stepValid[step]}
              >
                Próximo →
              </button>
            ) : (
              <button
                className="wz-btn wz-btn--confirm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? <><span className="wz-spinner" /> Criando campanha…</> : '🚀 Confirmar e Disparar'}
              </button>
            )}
          </div>
        )}

      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepPanel({ title, children }) {
  return (
    <div className="wz-panel">
      <p className="wz-panel-title">{title}</p>
      {children}
    </div>
  )
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconSuccess() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="22" stroke="#22c55e" strokeWidth="2"/>
      <path d="M14 24l7 7 13-14" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Header ── */
  .wz-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 16px; flex-wrap: wrap;
  }
  .wz-title {
    font-family: 'DM Sans', sans-serif; font-size: 22px;
    font-weight: 600; color: #e8edf5; letter-spacing: -0.3px;
  }
  .wz-sub { font-size: 13px; color: #4a5568; font-family: 'DM Sans', sans-serif; }

  /* ── Stepper ── */
  .wz-stepper {
    display: flex; align-items: center;
    gap: 0; overflow-x: auto; padding: 4px 0;
    -webkit-overflow-scrolling: touch;
  }
  .wz-step {
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0;
  }
  .wz-step-circle {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
    border: 1.5px solid #252c38; background: #1a1f28; color: #4a5568;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }
  .wz-step--active .wz-step-circle {
    background: #22c55e; border-color: #22c55e; color: #0a0c0f;
  }
  .wz-step--done .wz-step-circle {
    background: #22c55e20; border-color: #22c55e40; color: #22c55e;
  }
  .wz-step-label {
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    color: #4a5568; white-space: nowrap;
  }
  .wz-step--active .wz-step-label { color: #e8edf5; }
  .wz-step--done  .wz-step-label  { color: #22c55e; }
  .wz-step-line {
    width: 32px; height: 1px; background: #1a1f28; flex-shrink: 0; margin: 0 6px;
  }

  /* ── Body ── */
  .wz-body { display: flex; flex-direction: column; gap: 16px; }

  .wz-panel {
    background: #0f1215; border: 1px solid #1a1f28;
    border-radius: 12px; padding: 20px 22px;
    display: flex; flex-direction: column; gap: 18px;
  }
  .wz-panel-title {
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    font-weight: 600; color: #e8edf5; margin: 0;
    padding-bottom: 14px; border-bottom: 1px solid #1a1f28;
  }

  /* ── Form fields ── */
  .wz-form { display: flex; flex-direction: column; gap: 18px; }
  .wz-field { display: flex; flex-direction: column; gap: 6px; }
  .wz-label {
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    font-weight: 600; color: #8a94a6;
    display: flex; align-items: center; gap: 8px;
  }
  .wz-label-hint { font-weight: 400; color: #374151; font-size: 11px; }
  .wz-hint { font-size: 12px; color: #374151; font-family: 'DM Sans', sans-serif; margin: 0; }

  .wz-input, .wz-select {
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 8px; color: #e8edf5;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    padding: 9px 12px; outline: none;
    transition: border-color 0.15s; box-sizing: border-box;
    width: 100%;
  }
  .wz-input:focus, .wz-select:focus { border-color: #22c55e60; }
  .wz-select {
    cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%234a5568' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px;
  }
  .wz-select option { background: #1a1f28; }

  .wz-radio-group { display: flex; gap: 8px; flex-wrap: wrap; }
  .wz-radio-card {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 16px; background: #1a1f28;
    border: 1.5px solid #252c38; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: #8a94a6; cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .wz-radio-card input { display: none; }
  .wz-radio-card--active { border-color: #22c55e40; background: #22c55e08; color: #e8edf5; }

  /* ── Navigation bar ── */
  .wz-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding-top: 4px;
  }

  /* ── Buttons ── */
  .wz-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 20px; border-radius: 8px; border: 1px solid transparent;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: opacity 0.15s, background 0.15s;
    white-space: nowrap; text-decoration: none;
  }
  .wz-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .wz-btn--primary   { background: #22c55e; color: #0a0c0f; }
  .wz-btn--primary:hover:not(:disabled) { background: #16a34a; }
  .wz-btn--secondary { background: #1a1f28; border-color: #252c38; color: #8a94a6; }
  .wz-btn--secondary:hover:not(:disabled) { background: #252c38; color: #e8edf5; }
  .wz-btn--confirm   { background: #16a34a; color: #fff; border-color: #15803d; font-size: 14px; padding: 10px 24px; }
  .wz-btn--confirm:hover:not(:disabled) { background: #15803d; }

  .wz-spinner {
    width: 13px; height: 13px;
    border: 2px solid #ffffff40; border-top-color: #fff;
    border-radius: 50%; animation: wz-spin 0.7s linear infinite; display: inline-block;
  }
  @keyframes wz-spin { to { transform: rotate(360deg); } }

  /* ── Banners ── */
  .wz-banner {
    padding: 10px 14px; border-radius: 8px;
    font-size: 13px; font-family: 'DM Sans', sans-serif;
  }
  .wz-banner--err { background: #ef444412; border: 1px solid #ef444430; color: #fca5a5; }

  /* ── Done screen ── */
  .wz-done {
    display: flex; flex-direction: column; align-items: center;
    gap: 16px; padding: 48px 24px; text-align: center;
  }
  .wz-done-icon { color: #22c55e; }
  .wz-done-title {
    font-family: 'DM Sans', sans-serif; font-size: 20px;
    font-weight: 600; color: #e8edf5;
  }
  .wz-done-sub { font-size: 13px; color: #4a5568; font-family: 'DM Sans', sans-serif; }
  .wz-done-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .wz-title  { font-size: 19px; }
    .wz-panel  { padding: 16px 14px; }
    .wz-nav    { gap: 10px; }
    .wz-btn    { flex: 1; justify-content: center; min-height: 42px; }
    .wz-step-line { width: 16px; }
    .wz-step-label { font-size: 10px; }
  }
`
