/**
 * ProgressoDisparo.jsx
 * Shows real-time progress for a running campaign.
 * Polls GET /api/campanhas/:id/status every 3 s while status is 'running' or 'scheduled'.
 */
import { useEffect, useRef, useState } from 'react'
import { getCampanhaStatus } from '../../services/campanhaService'

const POLL_INTERVAL = 3000

const STATUS_LABEL = {
  pending:          'Pendente',
  queuing:          'Enfileirando…',
  running:          'Em andamento',
  scheduled:        'Agendado',
  done:             'Concluído',
  done_with_errors: 'Concluído com erros',
  failed:           'Falhou',
  cancelled:        'Cancelado',
}

const STATUS_COLOR = {
  pending:          '#4a5568',
  queuing:          '#8b5cf6',
  running:          '#3b82f6',
  scheduled:        '#f59e0b',
  done:             '#22c55e',
  done_with_errors: '#f97316',
  failed:           '#ef4444',
  cancelled:        '#6b7280',
}

/**
 * @param {object} props
 * @param {number} props.campaignId
 * @param {boolean} [props.compact=false]  — compact inline variant (no labels row)
 */
export default function ProgressoDisparo({ campaignId, compact = false, onStatusChange }) {
  const [data, setData]       = useState(null)
  const [error, setError]     = useState(null)
  const timerRef              = useRef(null)
  const prevStatusRef         = useRef(null)

  const isActive    = (s) => ['running', 'pending', 'queuing', 'scheduled'].includes(s)
  const isPulsating = (s) => ['running', 'pending', 'queuing'].includes(s)

  async function poll() {
    try {
      const res = await getCampanhaStatus(campaignId)
      setData(res)

      // Notifica o pai quando o status muda (ex: scheduled → done_with_errors)
      if (prevStatusRef.current !== null && prevStatusRef.current !== res.status) {
        if (onStatusChange) onStatusChange(res.status)
      }
      prevStatusRef.current = res.status

      if (isActive(res.status)) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL)
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  useEffect(() => {
    poll()
    return () => clearTimeout(timerRef.current)
  }, [campaignId]) // eslint-disable-line

  if (error) return <span style={{ fontSize: 12, color: '#ef4444' }}>Erro: {error}</span>
  if (!data)  return <span style={{ fontSize: 12, color: '#4a5568' }}>Carregando…</span>

  const total     = Number(data.total_contacts) || 1
  const sent      = Number(data.sent)        || 0
  const failed    = Number(data.failed)      || 0
  const delivered = Number(data.delivered)   || 0
  const read      = Number(data.read_count)  || 0
  const settled   = sent + failed
  const pct       = Math.min(100, Math.round((settled / total) * 100))

  const color = STATUS_COLOR[data.status] || '#4a5568'

  return (
    <>
      <style>{CSS}</style>
      <div className="pd-root">
        {/* Status badge + percent */}
        <div className="pd-header">
          <span className="pd-badge" style={{ background: color + '20', color }}>
            {isPulsating(data.status) && <span className="pd-dot" style={{ background: color }} />}
            {STATUS_LABEL[data.status] || data.status}
          </span>
          <span className="pd-pct">{pct}%</span>
        </div>

        {/* Progress bar */}
        <div className="pd-track">
          <div
            className="pd-fill"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>

        {/* Stats row */}
        {!compact && (
          <div className="pd-stats">
            <Stat label="Total"      value={total}     />
            <Stat label="Enviados"   value={sent}      color="#22c55e" />
            <Stat label="Entregues"  value={delivered} color="#3b82f6" />
            <Stat label="Lidas"      value={read}      color="#8b5cf6" />
            <Stat label="Falhas"     value={failed}    color="#ef4444" />
          </div>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="pd-stat">
      <span className="pd-stat-val" style={color ? { color } : undefined}>{value}</span>
      <span className="pd-stat-lbl">{label}</span>
    </div>
  )
}

const CSS = `
  .pd-root { display: flex; flex-direction: column; gap: 8px; width: 100%; }

  .pd-header {
    display: flex; align-items: center; justify-content: space-between;
  }
  .pd-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: 999px;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
  }
  .pd-dot {
    width: 6px; height: 6px; border-radius: 50%;
    animation: pd-pulse 1.4s ease-in-out infinite;
  }
  @keyframes pd-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  .pd-pct {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #4a5568;
  }

  .pd-track {
    width: 100%; height: 6px; background: #1a1f28;
    border-radius: 999px; overflow: hidden;
  }
  .pd-fill {
    height: 100%; border-radius: 999px;
    transition: width 0.4s ease;
  }

  .pd-stats {
    display: flex; gap: 16px; flex-wrap: wrap;
  }
  .pd-stat { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
  .pd-stat-val {
    font-family: 'JetBrains Mono', monospace; font-size: 14px;
    font-weight: 600; color: #e8edf5;
  }
  .pd-stat-lbl {
    font-family: 'DM Sans', sans-serif; font-size: 11px; color: #4a5568;
  }
`
