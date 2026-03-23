// ─── Tier info ────────────────────────────────────────────────────────────────

const TIER_INFO = {
  TIER_1: { label: 'Tier 1', limit: '1.000/dia' },
  TIER_2: { label: 'Tier 2', limit: '10.000/dia' },
  TIER_3: { label: 'Tier 3', limit: '100.000/dia' },
  TIER_4: { label: 'Tier 4', limit: 'Ilimitado' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function qualityColor(rating) {
  if (!rating) return '#4a5568'
  const r = rating.toUpperCase()
  if (r === 'GREEN')  return '#22c55e'
  if (r === 'YELLOW') return '#f59e0b'
  if (r === 'RED')    return '#ef4444'
  return '#4a5568'
}

function qualityLabel(rating) {
  if (!rating) return '–'
  const r = rating.toUpperCase()
  if (r === 'GREEN')  return 'Ótimo'
  if (r === 'YELLOW') return 'Médio'
  if (r === 'RED')    return 'Crítico'
  return rating
}

function statusColor(status) {
  if (!status) return '#4a5568'
  const s = status.toUpperCase()
  if (s === 'CONNECTED')  return '#22c55e'
  if (s === 'FLAGGED')    return '#f59e0b'
  if (s === 'RESTRICTED') return '#f59e0b'
  if (s === 'BANNED')     return '#ef4444'
  return '#8a94a6'
}

function isAlert(status) {
  if (!status) return false
  const s = status.toUpperCase()
  return s === 'FLAGGED' || s === 'RESTRICTED' || s === 'BANNED'
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * NumeroItem
 * Props: numero (phone_numbers row from DB)
 */
export default function NumeroItem({ numero }) {
  const tier    = TIER_INFO[numero.messaging_limit_tier] || null
  const alert   = isAlert(numero.status)
  const qColor  = qualityColor(numero.quality_rating)
  const sColor  = statusColor(numero.status)

  return (
    <>
      <style>{CSS}</style>
      <div className={`ni-root${alert ? ' ni-root--alert' : ''}`}>

        {/* Left: phone + name */}
        <div className="ni-identity">
          <div className="ni-phone-wrap">
            <span className="ni-icon">
              <IconPhone />
            </span>
            <span className="ni-phone">
              {numero.display_phone_number || numero.phone_number_id}
            </span>
          </div>
          {numero.verified_name && (
            <span className="ni-vname">{numero.verified_name}</span>
          )}
          <span className="ni-id"># {numero.phone_number_id}</span>
        </div>

        {/* Middle: status + rating + tier */}
        <div className="ni-badges">
          {/* Status */}
          <span className="ni-badge" style={{ color: sColor, borderColor: `${sColor}40`, background: `${sColor}10` }}>
            <span className="ni-dot" style={{ background: sColor }} />
            {numero.status || 'Desconhecido'}
          </span>

          {/* Quality rating */}
          {numero.quality_rating && (
            <span className="ni-badge" style={{ color: qColor, borderColor: `${qColor}40`, background: `${qColor}10` }}>
              <span className="ni-dot" style={{ background: qColor }} />
              {qualityLabel(numero.quality_rating)}
            </span>
          )}

          {/* Tier */}
          {tier && (
            <span className="ni-badge ni-badge--tier">
              <IconBolt />
              {tier.label} · {tier.limit}
            </span>
          )}

          {/* Business verification */}
          {numero.is_verified_business ? (
            <span className="ni-badge ni-badge--verified">
              <IconCheck /> Verificado
            </span>
          ) : (
            <span className="ni-badge ni-badge--unverified">
              Não verificado
            </span>
          )}
        </div>

        {/* Alert banner */}
        {alert && (
          <div className="ni-alert">
            ⚠ Número {numero.status?.toLowerCase()} — verifique o Business Manager
          </div>
        )}
      </div>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="5" y="1.5" width="10" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="10" cy="15.5" r="1" fill="currentColor"/>
    </svg>
  )
}

function IconBolt() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9 2L3 9h5l-1 5 6-7H8l1-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .ni-root {
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid #252c38;
    background: #0f1215;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 0.15s;
  }
  .ni-root--alert {
    border-color: #ef444440;
    background: #ef44440a;
  }

  .ni-identity { display: flex; flex-direction: column; gap: 2px; }

  .ni-phone-wrap {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .ni-icon {
    display: flex;
    align-items: center;
    color: #8a94a6;
    flex-shrink: 0;
  }

  .ni-phone {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    color: #e8edf5;
    letter-spacing: 0.2px;
  }

  .ni-vname {
    font-size: 12px;
    color: #8a94a6;
    font-family: 'DM Sans', sans-serif;
  }

  .ni-id {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #4a5568;
  }

  .ni-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .ni-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 100px;
    border: 1px solid #252c38;
    font-size: 11px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    color: #8a94a6;
    background: #141820;
    white-space: nowrap;
  }

  .ni-badge--tier {
    color: #3b82f6;
    border-color: #3b82f640;
    background: #3b82f610;
  }

  .ni-badge--verified {
    color: #22c55e;
    border-color: #22c55e40;
    background: #22c55e10;
  }

  .ni-badge--unverified {
    color: #4a5568;
    border-color: #252c38;
  }

  .ni-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ni-alert {
    font-size: 11px;
    color: #fca5a5;
    background: #ef444415;
    border: 1px solid #ef444430;
    border-radius: 6px;
    padding: 6px 10px;
    font-family: 'DM Sans', sans-serif;
  }
`
