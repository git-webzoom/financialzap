import { useMemo, useState } from 'react'

const PAGE_SIZE = 5

/**
 * Etapa 2 — Seleção e divisão de templates
 * Props:
 *   availableTemplates  Template[]
 *   selected            { templateId, wabaId, name, structure }[]
 *   splitMode           'equal' | 'weighted'
 *   weights             number[]
 *   totalRows           number
 *   onChange({ templates, splitMode, weights })
 */
export default function SelecionarTemplates({
  availableTemplates = [],
  selected = [],
  splitMode = 'equal',
  weights = [],
  totalRows = 0,
  onChange,
}) {
  const selectedIds = useMemo(() => new Set(selected.map(t => t.templateId)), [selected])

  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return availableTemplates
    return availableTemplates.filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    )
  }, [availableTemplates, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSearch(val) { setSearch(val); setPage(1) }

  function toggleTemplate(tpl) {
    let next
    if (selectedIds.has(tpl.template_id)) {
      next = selected.filter(t => t.templateId !== tpl.template_id)
    } else {
      next = [...selected, {
        templateId: tpl.template_id,
        wabaId:     tpl.waba_id,
        name:       tpl.name,
        structure:  tpl.structure,
      }]
    }
    const n = next.length
    const equalW = n > 0
      ? next.map((_, i) => {
          const base = Math.floor(100 / n)
          return i === n - 1 ? 100 - base * (n - 1) : base
        })
      : []
    onChange({ templates: next, splitMode, weights: equalW })
  }

  function handleWeightChange(idx, raw) {
    const val = Math.max(0, Math.min(100, parseInt(raw) || 0))
    const next = [...weights]
    next[idx] = val
    onChange({ templates: selected, splitMode, weights: next })
  }

  function handleSplitModeChange(mode) {
    const n = selected.length
    const equalW = n > 0
      ? selected.map((_, i) => {
          const base = Math.floor(100 / n)
          return i === n - 1 ? 100 - base * (n - 1) : base
        })
      : []
    onChange({ templates: selected, splitMode: mode, weights: equalW })
  }

  // Compute preview counts
  const counts = useMemo(() => {
    if (!selected.length || !totalRows) return selected.map(() => 0)
    if (splitMode === 'equal') {
      const base = Math.floor(totalRows / selected.length)
      return selected.map((_, i) =>
        i === selected.length - 1 ? totalRows - base * (selected.length - 1) : base
      )
    }
    // weighted — largest-remainder
    const total = weights.reduce((s, w) => s + w, 0) || 1
    const exact   = weights.map(w => (w / total) * totalRows)
    const floored = exact.map(Math.floor)
    const rem     = totalRows - floored.reduce((s, c) => s + c, 0)
    const fracs   = exact.map((e, i) => ({ i, frac: e - floored[i] }))
    fracs.sort((a, b) => b.frac - a.frac)
    for (let k = 0; k < rem; k++) floored[fracs[k].i]++
    return floored
  }, [selected, splitMode, weights, totalRows])

  const weightSum = weights.reduce((s, w) => s + w, 0)
  const weightOk  = Math.abs(weightSum - 100) <= 1  // allow 1pt rounding slack

  const CATEGORY_LABELS = { MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação' }

  return (
    <>
      <style>{CSS}</style>

      {availableTemplates.length === 0 ? (
        <div className="st-empty">Nenhum template disponível. Sincronize uma WABA primeiro.</div>
      ) : (
        <>
        {/* Search */}
        <div className="st-search-wrap">
          <span className="st-search-icon">🔍</span>
          <input
            className="st-search"
            placeholder="Buscar por nome ou categoria…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
          {search && (
            <button className="st-search-clear" onClick={() => handleSearch('')}>✕</button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="st-empty">Nenhum template encontrado para "{search}".</div>
        ) : (
        <div className="st-list">
          {paginated.map(tpl => {
            const checked = selectedIds.has(tpl.template_id)
            const body    = tpl.structure?.find?.(c => c.type === 'BODY')
            return (
              <div
                key={`${tpl.waba_id}:${tpl.template_id}`}
                className={`st-item${checked ? ' st-item--checked' : ''}`}
                onClick={() => toggleTemplate(tpl)}
              >
                <div className="st-check-col">
                  <div className={`st-checkbox${checked ? ' st-checkbox--on' : ''}`}>
                    {checked && <IconCheck />}
                  </div>
                </div>
                <div className="st-item-body">
                  <span className="st-item-name">{tpl.name}</span>
                  <div className="st-item-meta">
                    <span className="st-item-cat">{CATEGORY_LABELS[tpl.category] || tpl.category}</span>
                    <span className="st-item-lang">{tpl.language}</span>
                    <span className={`st-item-status st-item-status--${(tpl.status || '').toLowerCase()}`}>
                      {tpl.status}
                    </span>
                  </div>
                  {body?.text && (
                    <span className="st-item-preview">{body.text.slice(0, 80)}{body.text.length > 80 ? '…' : ''}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="st-pagination">
            <button
              className="st-page-btn"
              onClick={() => setPage(p => p - 1)}
              disabled={safePage === 1}
            >‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`st-page-btn${p === safePage ? ' st-page-btn--active' : ''}`}
                onClick={() => setPage(p)}
              >{p}</button>
            ))}
            <button
              className="st-page-btn"
              onClick={() => setPage(p => p + 1)}
              disabled={safePage === totalPages}
            >›</button>
            <span className="st-page-info">
              {filtered.length} template{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        </>
      )}

      {/* Split config — only shown when ≥1 template selected */}
      {selected.length > 0 && (
        <div className="st-split">
          <p className="st-split-title">Divisão de contatos</p>

          <div className="st-mode-tabs">
            {[
              { value: 'equal',    label: 'Igual' },
              { value: 'weighted', label: 'Por peso' },
            ].map(m => (
              <button
                key={m.value}
                className={`st-mode-tab${splitMode === m.value ? ' st-mode-tab--active' : ''}`}
                onClick={() => handleSplitModeChange(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Per-template rows */}
          <div className="st-rows">
            {selected.map((t, i) => (
              <div key={t.templateId} className="st-row">
                <span className="st-row-name">{t.name}</span>

                {splitMode === 'weighted' && (
                  <div className="st-weight-wrap">
                    <input
                      type="number"
                      className={`st-weight-input${!weightOk ? ' st-weight-input--err' : ''}`}
                      min={0} max={100}
                      value={weights[i] ?? 0}
                      onChange={e => handleWeightChange(i, e.target.value)}
                    />
                    <span className="st-weight-pct">%</span>
                  </div>
                )}

                <span className="st-row-count">
                  {counts[i]?.toLocaleString('pt-BR') ?? '—'} contatos
                </span>
              </div>
            ))}
          </div>

          {splitMode === 'weighted' && !weightOk && (
            <p className="st-weight-warn">
              A soma dos pesos é {weightSum}% — ajuste para 100%.
            </p>
          )}

          <div className="st-split-total">
            Total: <strong>{totalRows.toLocaleString('pt-BR')}</strong> contatos
            · {selected.length} template{selected.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </>
  )
}

function IconCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const CSS = `
  .st-empty {
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: #4a5568; padding: 24px 0; text-align: center;
  }

  .st-list { display: flex; flex-direction: column; gap: 6px; }

  .st-item {
    display: flex; gap: 12px; align-items: flex-start;
    padding: 12px 14px;
    background: #0f1215; border: 1px solid #1a1f28;
    border-radius: 10px; cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .st-item:hover { border-color: #252c38; background: #141820; }
  .st-item--checked { border-color: #22c55e40; background: #22c55e06; }
  .st-item--checked:hover { border-color: #22c55e60; background: #22c55e0a; }

  .st-check-col { flex-shrink: 0; padding-top: 2px; }
  .st-checkbox {
    width: 18px; height: 18px;
    border: 1.5px solid #374151; border-radius: 5px;
    background: #1a1f28;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, background 0.15s; color: #0a0c0f;
  }
  .st-checkbox--on { background: #22c55e; border-color: #22c55e; }

  .st-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .st-item-name {
    font-family: 'JetBrains Mono', monospace; font-size: 13px;
    color: #e8edf5; font-weight: 500;
  }
  .st-item-meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .st-item-cat, .st-item-lang {
    font-size: 11px; color: #4a5568; font-family: 'DM Sans', sans-serif;
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 4px; padding: 2px 7px;
  }
  .st-item-status {
    font-size: 10px; font-weight: 600; font-family: 'DM Sans', sans-serif;
    padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;
  }
  .st-item-status--approved { background: #22c55e18; color: #22c55e; }
  .st-item-status--pending  { background: #f59e0b18; color: #f59e0b; }
  .st-item-status--rejected { background: #ef444418; color: #ef4444; }
  .st-item-preview {
    font-size: 11px; color: #374151; font-family: 'DM Sans', sans-serif;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* Split */
  .st-split {
    margin-top: 8px;
    background: #0f1215; border: 1px solid #1a1f28;
    border-radius: 10px; padding: 16px 18px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .st-split-title {
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    font-weight: 600; color: #8a94a6; margin: 0;
  }

  .st-mode-tabs {
    display: flex; gap: 4px;
    background: #0c0f13; border: 1px solid #1a1f28;
    border-radius: 8px; padding: 3px; width: fit-content;
  }
  .st-mode-tab {
    padding: 5px 14px; border: none; border-radius: 6px;
    background: transparent; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    color: #4a5568; transition: color 0.15s, background 0.15s;
  }
  .st-mode-tab:hover:not(.st-mode-tab--active) { color: #8a94a6; }
  .st-mode-tab--active { background: #252c38; color: #e8edf5; }

  .st-rows { display: flex; flex-direction: column; gap: 8px; }
  .st-row {
    display: flex; align-items: center; gap: 10px;
    flex-wrap: wrap;
  }
  .st-row-name {
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: #8a94a6; flex: 1; min-width: 120px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .st-weight-wrap { display: flex; align-items: center; gap: 4px; }
  .st-weight-input {
    width: 60px; padding: 5px 8px;
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 6px; color: #e8edf5;
    font-family: 'JetBrains Mono', monospace; font-size: 13px;
    text-align: right; outline: none;
    transition: border-color 0.15s;
  }
  .st-weight-input:focus { border-color: #22c55e60; }
  .st-weight-input--err { border-color: #ef444450; }
  .st-weight-pct { font-size: 12px; color: #4a5568; font-family: 'DM Sans', sans-serif; }

  .st-row-count {
    font-size: 12px; color: #22c55e;
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    background: #22c55e10; border: 1px solid #22c55e25;
    border-radius: 5px; padding: 2px 8px;
  }

  .st-weight-warn {
    font-size: 12px; color: #fca5a5;
    font-family: 'DM Sans', sans-serif; margin: 0;
  }
  .st-split-total {
    font-size: 12px; color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    border-top: 1px solid #1a1f28; padding-top: 12px;
  }
  .st-split-total strong { color: #8a94a6; }

  /* ── Search ── */
  .st-search-wrap {
    display: flex; align-items: center; gap: 8px;
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 8px; padding: 0 12px;
    transition: border-color 0.15s;
  }
  .st-search-wrap:focus-within { border-color: #22c55e60; }
  .st-search-icon { font-size: 13px; flex-shrink: 0; opacity: 0.5; }
  .st-search {
    flex: 1; background: transparent; border: none; outline: none;
    color: #e8edf5; font-family: 'DM Sans', sans-serif; font-size: 13px;
    padding: 9px 0;
  }
  .st-search::placeholder { color: #374151; }
  .st-search-clear {
    background: none; border: none; color: #4a5568;
    cursor: pointer; font-size: 12px; padding: 4px;
    transition: color 0.15s; flex-shrink: 0;
  }
  .st-search-clear:hover { color: #8a94a6; }

  /* ── Pagination ── */
  .st-pagination {
    display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  }
  .st-page-btn {
    min-width: 30px; height: 30px;
    display: inline-flex; align-items: center; justify-content: center;
    background: #1a1f28; border: 1px solid #252c38;
    border-radius: 6px; color: #4a5568;
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    cursor: pointer; transition: color 0.15s, background 0.15s, border-color 0.15s;
  }
  .st-page-btn:hover:not(:disabled):not(.st-page-btn--active) {
    background: #252c38; color: #8a94a6;
  }
  .st-page-btn--active { background: #22c55e18; border-color: #22c55e40; color: #22c55e; font-weight: 600; }
  .st-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .st-page-info {
    font-size: 11px; color: #374151;
    font-family: 'DM Sans', sans-serif; margin-left: 6px;
  }
`
