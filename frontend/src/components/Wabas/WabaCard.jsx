import { useState } from 'react'
import NumeroItem from './NumeroItem'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wabaStatusColor(status) {
  if (!status) return '#4a5568'
  const s = status.toUpperCase()
  if (s === 'ACTIVE')     return '#22c55e'
  if (s === 'RESTRICTED') return '#f59e0b'
  if (s === 'FLAGGED')    return '#f59e0b'
  if (s === 'BANNED')     return '#ef4444'
  if (s === 'SUSPENDED')  return '#ef4444'
  return '#8a94a6'
}

function isWabaAlert(status) {
  if (!status) return false
  const s = status.toUpperCase()
  return ['BANNED', 'SUSPENDED', 'RESTRICTED', 'FLAGGED'].includes(s)
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * WabaCard
 * Props:
 *   waba        — waba object from API
 *   phoneNumbers — array of phone_number rows
 *   onRevoke(wabaId) — callback to revoke
 *   onSync(wabaId)   — callback to sync
 */
export default function WabaCard({ waba, phoneNumbers = [], onRevoke, onSync }) {
  const [expanded, setExpanded]   = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [revoking, setRevoking]   = useState(false)
  const [syncMsg, setSyncMsg]     = useState('')

  const alert  = isWabaAlert(waba.status)
  const sColor = wabaStatusColor(waba.status)

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const r = await onSync(waba.waba_id)
      setSyncMsg(`✓ ${r.phone_numbers_synced} números · ${r.templates_synced} templates sincronizados`)
      setTimeout(() => setSyncMsg(''), 4000)
    } catch (err) {
      setSyncMsg(`⚠ ${err.response?.data?.error || err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  async function handleRevoke() {
    if (!window.confirm(`Desconectar a WABA "${waba.name || waba.waba_id}"? Esta ação removerá os dados locais.`)) return
    setRevoking(true)
    try {
      await onRevoke(waba.waba_id)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
      setRevoking(false)
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className={`wc-root${alert ? ' wc-root--alert' : ''}`}>

        {/* ── Header ── */}
        <div className="wc-header">
          <button className="wc-expand-btn" onClick={() => setExpanded(v => !v)} title={expanded ? 'Recolher' : 'Expandir'}>
            <span className={`wc-chevron${expanded ? ' wc-chevron--open' : ''}`}>
              <IconChevron />
            </span>
          </button>

          <div className="wc-title">
            <span className="wc-name">{waba.name || 'WABA sem nome'}</span>
            <span className="wc-id">{waba.waba_id}</span>
          </div>

          <div className="wc-meta">
            {/* Status badge */}
            <span className="wc-badge" style={{ color: sColor, borderColor: `${sColor}40`, background: `${sColor}10` }}>
              <span className="wc-dot" style={{ background: sColor }} />
              {waba.status || 'Desconhecido'}
            </span>

            {/* Currency */}
            {waba.currency && (
              <span className="wc-badge">
                <IconCoin /> {waba.currency}
              </span>
            )}

            {/* Timezone */}
            {waba.timezone && (
              <span className="wc-badge">
                <IconClock /> {waba.timezone}
              </span>
            )}

            {/* Numbers count */}
            <span className="wc-badge wc-badge--count">
              <IconPhone /> {phoneNumbers.length} número{phoneNumbers.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="wc-actions">
            <button className="wc-action-btn" onClick={handleSync} disabled={syncing || revoking} title="Sincronizar números e templates">
              <span className={syncing ? 'wc-spin' : ''}><IconRefresh /></span>
            </button>
            <button className="wc-action-btn wc-action-btn--danger" onClick={handleRevoke} disabled={revoking || syncing} title="Desconectar WABA">
              <IconTrash />
            </button>
          </div>
        </div>

        {/* Alert banner */}
        {alert && (
          <div className="wc-alert">
            ⚠ WABA com restrições ({waba.status}) — verifique o Business Manager para mais detalhes
          </div>
        )}

        {/* Sync feedback */}
        {syncMsg && (
          <div className={`wc-syncmsg${syncMsg.startsWith('⚠') ? ' wc-syncmsg--err' : ''}`}>
            {syncMsg}
          </div>
        )}

        {/* ── Phone numbers ── */}
        {expanded && (
          <div className="wc-numbers">
            {phoneNumbers.length === 0 ? (
              <p className="wc-empty">Nenhum número associado a esta WABA.</p>
            ) : (
              phoneNumbers.map(n => (
                <NumeroItem key={n.phone_number_id} numero={n} />
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconPhone() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="5" y="1.5" width="10" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="10" cy="15.5" r="1" fill="currentColor"/>
    </svg>
  )
}

function IconCoin() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 4.5v7M6 6h3a1 1 0 010 2H7a1 1 0 000 2h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 6v4l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 8A5.5 5.5 0 0113 4.5M13.5 8A5.5 5.5 0 013 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 2.5l2 2-2 2M5 13.5l-2-2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12M5 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l1 9.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5L13 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .wc-root {
    border: 1px solid #252c38;
    border-radius: 10px;
    background: #141820;
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .wc-root--alert { border-color: #ef444440; }

  /* ── Header ── */
  .wc-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    flex-wrap: wrap;
  }

  .wc-expand-btn {
    background: none;
    border: none;
    color: #4a5568;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: color 0.15s;
  }
  .wc-expand-btn:hover { color: #8a94a6; }

  .wc-chevron { display: flex; transition: transform 0.2s; }
  .wc-chevron--open { transform: rotate(0deg); }
  .wc-chevron:not(.wc-chevron--open) { transform: rotate(-90deg); }

  .wc-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .wc-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #e8edf5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wc-id {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #4a5568;
    white-space: nowrap;
  }

  .wc-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .wc-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 100px;
    border: 1px solid #252c38;
    font-size: 11px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    color: #8a94a6;
    background: #0f1215;
    white-space: nowrap;
  }
  .wc-badge--count {
    color: #3b82f6;
    border-color: #3b82f640;
    background: #3b82f610;
  }

  .wc-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .wc-actions {
    display: flex;
    gap: 6px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .wc-action-btn {
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 6px;
    color: #4a5568;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .wc-action-btn:hover:not(:disabled) {
    color: #8a94a6;
    border-color: #374151;
    background: #252c38;
  }
  .wc-action-btn--danger:hover:not(:disabled) {
    color: #ef4444;
    border-color: #ef444440;
    background: #ef444415;
  }
  .wc-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .wc-action-btn { min-height: 36px; min-width: 36px; }

  .wc-spin { display: flex; animation: wc-rotate 0.8s linear infinite; }
  @keyframes wc-rotate { to { transform: rotate(360deg); } }

  @media (max-width: 600px) {
    .wc-meta { order: 3; width: 100%; }
    .wc-actions { margin-left: 0; }
    .wc-badge:not(:first-child) { display: none; }
  }

  /* ── Alerts ── */
  .wc-alert {
    margin: 0 16px 12px;
    padding: 8px 12px;
    background: #ef444415;
    border: 1px solid #ef444430;
    border-radius: 7px;
    font-size: 12px;
    color: #fca5a5;
    font-family: 'DM Sans', sans-serif;
  }

  .wc-syncmsg {
    margin: 0 16px 12px;
    padding: 7px 12px;
    background: #22c55e12;
    border: 1px solid #22c55e30;
    border-radius: 7px;
    font-size: 12px;
    color: #86efac;
    font-family: 'DM Sans', sans-serif;
  }
  .wc-syncmsg--err {
    background: #ef444412;
    border-color: #ef444430;
    color: #fca5a5;
  }

  /* ── Numbers list ── */
  .wc-numbers {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 16px 16px;
    border-top: 1px solid #1a1f28;
    padding-top: 12px;
  }

  .wc-empty {
    font-size: 13px;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    padding: 8px 0;
  }
`
