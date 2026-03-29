import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

// ─── Mock data ────────────────────────────────────────────────────────────────
// Replace with real API calls when backend endpoints are ready.

const STATS = [
  {
    id: 'wabas',
    label: 'WABAs Conectadas',
    value: 4,
    unit: '',
    accent: '#22c55e',
    accentBg: '#22c55e12',
    icon: IconPhone,
    trend: '+1 esta semana',
    trendUp: true,
  },
  {
    id: 'disparos',
    label: 'Disparos Hoje',
    value: 12480,
    unit: '',
    accent: '#3b82f6',
    accentBg: '#3b82f612',
    icon: IconSend,
    trend: '+3.2k vs ontem',
    trendUp: true,
  },
  {
    id: 'entregues',
    label: 'Mensagens Entregues',
    value: 11903,
    unit: '',
    accent: '#22c55e',
    accentBg: '#22c55e12',
    icon: IconCheck,
    trend: '95.4% taxa entrega',
    trendUp: true,
  },
  {
    id: 'falhas',
    label: 'Falhas',
    value: 577,
    unit: '',
    accent: '#ef4444',
    accentBg: '#ef444412',
    icon: IconX,
    trend: '4.6% do total',
    trendUp: false,
  },
]

const RECENT_CAMPAIGNS = [
  { id: 1, name: 'Black Friday — Loja SP',    status: 'done',    sent: 4200, delivered: 4012, failed: 188, time: '14:32' },
  { id: 2, name: 'Reativação Q1 2025',        status: 'running', sent: 3100, delivered: 2940, failed: 160, time: '16:05' },
  { id: 3, name: 'Boas-vindas novos clientes', status: 'done',   sent: 1800, delivered: 1760, failed: 40,  time: '11:20' },
  { id: 4, name: 'Promoção Flash 48h',         status: 'done',   sent: 3380, delivered: 3191, failed: 189, time: '09:15' },
]

const STATUS_LABEL = { done: 'Concluído', running: 'Em andamento', failed: 'Com erros' }
const STATUS_COLOR = { done: '#22c55e', running: '#f59e0b', failed: '#ef4444' }

// ─── Animated counter ─────────────────────────────────────────────────────────

function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0)
  const raf = useRef(null)

  useEffect(() => {
    const start = performance.now()
    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return value
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ stat, delay }) {
  const count = useCountUp(stat.value, 1200)

  return (
    <div
      className="stat-card"
      style={{
        '--card-accent': stat.accent,
        '--card-accent-bg': stat.accentBg,
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="stat-card-top">
        <div className="stat-icon-wrap">
          <stat.icon />
        </div>
        <span className="stat-trend" style={{ color: stat.trendUp ? '#22c55e' : '#ef4444' }}>
          {stat.trend}
        </span>
      </div>

      <div className="stat-value">
        {count.toLocaleString('pt-BR')}
        {stat.unit && <span className="stat-unit">{stat.unit}</span>}
      </div>

      <div className="stat-label">{stat.label}</div>
    </div>
  )
}

// ─── Recent campaigns table ───────────────────────────────────────────────────

function CampaignsTable() {
  return (
    <div className="campaigns-card">
      <div className="campaigns-header">
        <h2 className="campaigns-title">Campanhas Recentes</h2>
        <a href="/disparos/historico" className="campaigns-link">Ver todas →</a>
      </div>

      <div className="campaigns-scroll-wrap">
        <table className="campaigns-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Status</th>
              <th>Enviadas</th>
              <th>Entregues</th>
              <th>Falhas</th>
              <th>Horário</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_CAMPAIGNS.map((c) => (
              <tr key={c.id} className="campaigns-row">
                <td className="campaigns-name">{c.name}</td>
                <td>
                  <span
                    className="campaign-badge"
                    style={{
                      color: STATUS_COLOR[c.status],
                      background: STATUS_COLOR[c.status] + '15',
                      borderColor: STATUS_COLOR[c.status] + '40',
                    }}
                  >
                    {c.status === 'running' && <span className="badge-dot" style={{ background: STATUS_COLOR[c.status] }} />}
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td className="campaigns-num">{c.sent.toLocaleString('pt-BR')}</td>
                <td className="campaigns-num" style={{ color: '#22c55e' }}>{c.delivered.toLocaleString('pt-BR')}</td>
                <td className="campaigns-num" style={{ color: '#ef4444' }}>{c.failed.toLocaleString('pt-BR')}</td>
                <td className="campaigns-time">{c.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0] || 'Usuário'

  return (
    <>
      <style>{CSS}</style>
      <div className="page-root">
        {/* Page heading */}
        <div className="dash-heading">
          <div>
            <h1 className="dash-title">Dashboard</h1>
            <p className="dash-subtitle">
              Bem-vindo, <span style={{ color: '#22c55e' }}>{firstName}</span> — hoje é{' '}
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <a href="/disparos/novo" className="dash-cta">
            <IconSend />
            Novo Disparo
          </a>
        </div>

        {/* Stats grid */}
        <div className="cards-grid">
          {STATS.map((stat, i) => (
            <StatCard key={stat.id} stat={stat} delay={i * 80} />
          ))}
        </div>

        {/* Recent campaigns */}
        <CampaignsTable />
      </div>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPhone() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="4" y="1" width="8" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="12" r="0.8" fill="currentColor"/>
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 2L9.5 14 7 9 2 6.5 14 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5L6.5 12 13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Heading ── */
  .dash-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .dash-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 20px;
    font-weight: 700;
    color: #e8edf5;
    letter-spacing: -0.5px;
    margin-bottom: 4px;
  }

  .dash-subtitle {
    font-size: 13px;
    color: #4a5568;
  }

  .dash-cta {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px;
    background: #22c55e;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #000;
    text-decoration: none;
    transition: background 0.15s, box-shadow 0.15s;
    flex-shrink: 0;
    min-height: 40px;
  }
  .dash-cta:hover {
    background: #16a34a;
    box-shadow: 0 0 20px #22c55e30;
  }

  @media (max-width: 480px) {
    .dash-heading { align-items: flex-start; }
    .dash-title { font-size: 18px; }
    .dash-subtitle { font-size: 12px; }
  }

  /* ── Stat card ── */
  .stat-card {
    background: #141820;
    border: 1px solid #252c38;
    border-top: 2px solid var(--card-accent);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: card-in 0.4s ease both;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .stat-card:hover {
    border-color: var(--card-accent);
    box-shadow: 0 0 24px var(--card-accent-bg);
  }

  @keyframes card-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .stat-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-icon-wrap {
    width: 32px; height: 32px;
    background: var(--card-accent-bg);
    border: 1px solid var(--card-accent);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: var(--card-accent);
    opacity: 0.8;
  }

  .stat-trend {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.2px;
  }

  .stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    color: #e8edf5;
    letter-spacing: -1px;
    line-height: 1;
  }

  @media (max-width: 480px) {
    .stat-value { font-size: 22px; }
    .stat-label { font-size: 11px; }
    .stat-trend { font-size: 9px; }
  }

  .stat-unit {
    font-size: 16px;
    color: #4a5568;
    margin-left: 2px;
  }

  .stat-label {
    font-size: 12px;
    color: #4a5568;
    font-family: 'DM Sans', sans-serif;
    font-weight: 400;
  }

  /* ── Campaigns table ── */
  .campaigns-card {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 10px;
    overflow: hidden;
  }

  .campaigns-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #252c38;
  }

  .campaigns-scroll-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .campaigns-scroll-wrap::-webkit-scrollbar { height: 3px; }
  .campaigns-scroll-wrap::-webkit-scrollbar-thumb { background: #252c38; border-radius: 2px; }

  .campaigns-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    color: #8a94a6;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .campaigns-link {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #22c55e;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .campaigns-link:hover { opacity: 0.7; }

  .campaigns-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .campaigns-table thead tr {
    border-bottom: 1px solid #1a1f28;
  }

  .campaigns-table th {
    padding: 10px 20px;
    text-align: left;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 400;
    color: #4a5568;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .campaigns-row {
    border-bottom: 1px solid #1a1f28;
    transition: background 0.12s;
  }
  .campaigns-row:last-child { border-bottom: none; }
  .campaigns-row:hover { background: #1a1f2840; }

  .campaigns-table td {
    padding: 13px 20px;
    color: #8a94a6;
    vertical-align: middle;
  }

  .campaigns-name {
    color: #e8edf5 !important;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
  }

  .campaigns-num {
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 12px !important;
  }

  .campaigns-time {
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 11px !important;
    color: #4a5568 !important;
  }

  .campaign-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 400;
    white-space: nowrap;
  }

  .badge-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    animation: sb-pulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* ── Mobile: hide secondary columns ── */
  @media (max-width: 600px) {
    .campaigns-table th:nth-child(4),
    .campaigns-table th:nth-child(5),
    .campaigns-table th:nth-child(6),
    .campaigns-table td:nth-child(4),
    .campaigns-table td:nth-child(5),
    .campaigns-table td:nth-child(6) { display: none; }

    .campaigns-table th,
    .campaigns-table td { padding: 11px 12px; }

    .campaigns-title { font-size: 11px; }
  }
`
