import { useEffect, useState } from 'react'
import { useWabas } from '../../hooks/useWabas'
import WabaCard from '../../components/Wabas/WabaCard'
import ConectarWaba from '../../components/Wabas/EmbeddedSignup'
import * as wabaService from '../../services/wabaService'

export default function Wabas() {
  const { groups, loading, error, load, connect, revoke, sync } = useWabas()

  // phone_numbers per waba_id, loaded lazily after wabas list arrives
  const [phoneMap, setPhoneMap] = useState({})
  const [connectError, setConnectError] = useState('')
  const [connectSuccess, setConnectSuccess] = useState('')

  useEffect(() => {
    load()
  }, [load])

  // After groups load, fetch phone numbers for each WABA
  useEffect(() => {
    if (!groups.length) return
    const allWabas = groups.flatMap(g => g.wabas)
    allWabas.forEach(async (w) => {
      if (phoneMap[w.waba_id]) return // already loaded
      try {
        const { phone_numbers } = await wabaService.getPhoneNumbers(w.waba_id)
        setPhoneMap(prev => ({ ...prev, [w.waba_id]: phone_numbers }))
      } catch { /* silently ignore per-waba errors */ }
    })
  }, [groups])

  async function handleConnect(payload) {
    setConnectError('')
    setConnectSuccess('')
    try {
      const waba = await connect(payload)
      setConnectSuccess(`WABA "${waba.name || waba.waba_id}" conectada com sucesso!`)
      setTimeout(() => setConnectSuccess(''), 5000)
    } catch (err) {
      setConnectError(err.response?.data?.error || err.message || 'Erro ao conectar WABA')
    }
  }

  const totalWabas   = (groups || []).reduce((s, g) => s + (g.wabas?.length || 0), 0)
  const totalNumbers = Object.values(phoneMap).reduce((s, arr) => s + (arr?.length || 0), 0)

  return (
    <>
      <style>{CSS}</style>
      <div className="page-root">

        {/* ── Page header ── */}
        <div className="wabas-header">
          <div className="wabas-title-wrap">
            <h1 className="wabas-title">WABAs Conectadas</h1>
            <p className="wabas-sub">
              {loading ? 'Carregando…' : `${totalWabas} WABA${totalWabas !== 1 ? 's' : ''} · ${totalNumbers} número${totalNumbers !== 1 ? 's' : ''}`}
            </p>
          </div>
          <ConectarWaba onConnect={handleConnect} disabled={loading} />
        </div>

        {/* ── Feedback ── */}
        {connectSuccess && <div className="wabas-feedback wabas-feedback--ok">{connectSuccess}</div>}
        {connectError   && <div className="wabas-feedback wabas-feedback--err">⚠ {connectError}</div>}
        {error          && <div className="wabas-feedback wabas-feedback--err">⚠ {error}</div>}

        {/* ── Content ── */}
        {loading ? (
          <div className="wabas-loading">
            <span className="wabas-spinner" />
            Carregando WABAs…
          </div>
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="wabas-groups">
            {groups.map(group => (
              <section key={group.business_id || '__no_bm__'} className="wabas-bm-section">

                {/* BM group header */}
                <div className="wabas-bm-header">
                  <span className="wabas-bm-icon">
                    <IconBuilding />
                  </span>
                  <div>
                    <span className="wabas-bm-name">{group.business_name}</span>
                    {group.business_id && (
                      <span className="wabas-bm-id">BM · {group.business_id}</span>
                    )}
                  </div>
                  <span className="wabas-bm-count">
                    {group.wabas.length} WABA{group.wabas.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* WABAs in this BM */}
                <div className="wabas-list">
                  {group.wabas.map(waba => (
                    <WabaCard
                      key={waba.waba_id}
                      waba={waba}
                      phoneNumbers={phoneMap[waba.waba_id] || []}
                      onRevoke={revoke}
                      onSync={sync}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="wabas-empty">
      <div className="wabas-empty-icon">
        <IconWhatsApp />
      </div>
      <p className="wabas-empty-title">Nenhuma WABA conectada</p>
      <p className="wabas-empty-sub">
        Informe o <strong>Token de Acesso</strong> e o <strong>WABA ID</strong> acima para conectar sua conta WhatsApp Business.
      </p>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M7 17V10h6v7M2 8h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconWhatsApp() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="#22c55e" strokeWidth="1.5"/>
      <path d="M8.5 9.5c.5 1 1.5 3 3.5 4.5 2 1.5 3.5 1.5 3.5 1.5l.5-1.5-2-1-.5 1s-1 0-2-1-1-2-1-2l1-.5-1-2-1.5.5z" stroke="#22c55e" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Page header ── */
  .wabas-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .wabas-title-wrap { display: flex; flex-direction: column; gap: 4px; }

  .wabas-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 22px;
    font-weight: 600;
    color: #e8edf5;
    letter-spacing: -0.3px;
  }

  .wabas-sub {
    font-size: 13px;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Feedback banners ── */
  .wabas-feedback {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
  }
  .wabas-feedback--ok  { background: #22c55e12; border: 1px solid #22c55e30; color: #86efac; }
  .wabas-feedback--err { background: #ef444412; border: 1px solid #ef444430; color: #fca5a5; }

  /* ── Loading ── */
  .wabas-loading {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 40px 0;
    color: #4a5568;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
  }
  .wabas-spinner {
    width: 18px; height: 18px;
    border: 2px solid #252c38;
    border-top-color: #22c55e;
    border-radius: 50%;
    animation: wabas-spin 0.8s linear infinite;
  }
  @keyframes wabas-spin { to { transform: rotate(360deg); } }

  /* ── Groups ── */
  .wabas-groups { display: flex; flex-direction: column; gap: 32px; }

  .wabas-bm-section { display: flex; flex-direction: column; gap: 12px; }

  .wabas-bm-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #1a1f28;
  }

  .wabas-bm-icon {
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    background: #22c55e12;
    border: 1px solid #22c55e30;
    border-radius: 7px;
    color: #22c55e;
    flex-shrink: 0;
  }

  .wabas-bm-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #e8edf5;
    display: block;
  }

  .wabas-bm-id {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #4a5568;
    display: block;
  }

  .wabas-bm-count {
    margin-left: auto;
    font-size: 12px;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    white-space: nowrap;
  }

  .wabas-list { display: flex; flex-direction: column; gap: 10px; }

  /* ── Empty state ── */
  .wabas-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 64px 24px;
    text-align: center;
  }

  .wabas-empty-icon {
    width: 72px; height: 72px;
    display: flex; align-items: center; justify-content: center;
    background: #22c55e0a;
    border: 1px solid #22c55e20;
    border-radius: 50%;
  }

  .wabas-empty-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 17px;
    font-weight: 600;
    color: #8a94a6;
  }

  .wabas-empty-sub {
    font-size: 13px;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    max-width: 380px;
    line-height: 1.6;
  }
  .wabas-empty-sub strong { color: #8a94a6; }
`
