// ─── TemplateCard ─────────────────────────────────────────────────────────────
// Exibe um template com nome, status, categoria, idioma e estrutura de componentes.

const STATUS_CONFIG = {
  APPROVED: { label: 'Aprovado',  color: '#22c55e' },
  PENDING:  { label: 'Pendente',  color: '#f59e0b' },
  REJECTED: { label: 'Rejeitado', color: '#ef4444' },
}

const CATEGORY_LABELS = {
  MARKETING:      'Marketing',
  UTILITY:        'Utilidade',
  AUTHENTICATION: 'Autenticação',
}

const LANGUAGE_LABELS = {
  'pt_BR': 'Português (BR)',
  'en_US': 'Inglês (EUA)',
  'es_ES': 'Espanhol',
  'es_AR': 'Espanhol (AR)',
  'fr_FR': 'Francês',
  'de_DE': 'Alemão',
  'it_IT': 'Italiano',
}

function statusConfig(status) {
  return STATUS_CONFIG[status?.toUpperCase?.()] || { label: status || 'Desconhecido', color: '#4a5568' }
}

function bodyText(structure) {
  if (!Array.isArray(structure)) return null
  const body = structure.find(c => c.type === 'BODY')
  return body?.text || null
}

function hasMedia(structure) {
  if (!Array.isArray(structure)) return null
  const header = structure.find(c => c.type === 'HEADER')
  if (!header) return null
  if (header.format === 'IMAGE') return 'Imagem'
  if (header.format === 'VIDEO') return 'Vídeo'
  if (header.format === 'DOCUMENT') return 'Documento'
  return null
}

function buttons(structure) {
  if (!Array.isArray(structure)) return []
  const btns = structure.find(c => c.type === 'BUTTONS')
  return btns?.buttons || []
}

/**
 * TemplateCard
 * Props:
 *   template — template object from API/DB
 */
export default function TemplateCard({ template }) {
  const sc      = statusConfig(template.status)
  const text    = bodyText(template.structure)
  const media   = hasMedia(template.structure)
  const btns    = buttons(template.structure)
  const catLabel = CATEGORY_LABELS[template.category] || template.category || '—'
  const langLabel = LANGUAGE_LABELS[template.language] || template.language || '—'

  return (
    <>
      <style>{CSS}</style>
      <div className="tc-root">

        {/* ── Header row ── */}
        <div className="tc-header">
          <div className="tc-title-wrap">
            <span className="tc-name">{template.name}</span>
            {template.waba_name && (
              <span className="tc-waba">{template.waba_name}</span>
            )}
          </div>

          <div className="tc-badges">
            {/* Status */}
            <span
              className="tc-badge"
              style={{ color: sc.color, borderColor: `${sc.color}40`, background: `${sc.color}10` }}
            >
              <span className="tc-dot" style={{ background: sc.color }} />
              {sc.label}
            </span>

            {/* Category */}
            <span className="tc-badge">
              <IconTag /> {catLabel}
            </span>

            {/* Language */}
            <span className="tc-badge">
              <IconGlobe /> {langLabel}
            </span>

            {/* Media */}
            {media && (
              <span className="tc-badge tc-badge--media">
                <IconMedia /> {media}
              </span>
            )}

            {/* Buttons count */}
            {btns.length > 0 && (
              <span className="tc-badge tc-badge--btn">
                <IconBtn /> {btns.length} botão{btns.length !== 1 ? 'ões' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Body preview ── */}
        {text && (
          <p className="tc-body">{text}</p>
        )}

        {/* ── Footer: last sync ── */}
        {template.last_sync_at && (
          <div className="tc-footer">
            <IconClock /> Sincronizado {formatRelative(template.last_sync_at)}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Relative time ────────────────────────────────────────────────────────────

function formatRelative(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'agora mesmo'
  if (mins < 60)  return `há ${mins} min`
  if (hours < 24) return `há ${hours}h`
  return `há ${days} dia${days !== 1 ? 's' : ''}`
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconTag() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="5" cy="5" r="1" fill="currentColor"/>
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 8h12M8 2c-1.5 2-2 4-2 6s.5 4 2 6M8 2c1.5 2 2 4 2 6s-.5 4-2 6" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

function IconMedia() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6 6.5l4 2-4 2V6.5z" fill="currentColor"/>
    </svg>
  )
}

function IconBtn() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="4.5" width="13" height="7" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .tc-root {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color 0.15s;
  }
  .tc-root:hover { border-color: #374151; }

  .tc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .tc-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .tc-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    color: #e8edf5;
    letter-spacing: 0.3px;
    word-break: break-all;
  }

  .tc-waba {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #4a5568;
  }

  .tc-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    flex-shrink: 0;
  }

  .tc-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 100px;
    border: 1px solid #252c38;
    font-size: 11px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    color: #8a94a6;
    background: #0f1215;
    white-space: nowrap;
  }
  .tc-badge--media { color: #3b82f6; border-color: #3b82f640; background: #3b82f610; }
  .tc-badge--btn   { color: #a78bfa; border-color: #a78bfa40; background: #a78bfa10; }

  .tc-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tc-body {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #8a94a6;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    background: #0f1215;
    border: 1px solid #1a1f28;
    border-radius: 7px;
    padding: 10px 12px;
    margin: 0;
  }

  .tc-footer {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #374151;
    font-family: 'DM Sans', sans-serif;
  }
`
