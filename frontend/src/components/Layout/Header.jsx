import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // Display name: prefer name, fall back to email prefix
  const displayName = user?.name || user?.email?.split('@')[0] || 'Usuário'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <>
      <style>{CSS}</style>
      <header className="app-header">
        {/* Page title slot — filled by CSS counter trick or left empty for now */}
        <div className="header-left">
          <div className="header-breadcrumb">
            <span className="header-brand">FinancialZap</span>
            <span className="header-sep">/</span>
            <span className="header-page" id="header-page-title">Painel</span>
          </div>
        </div>

        <div className="header-right">
          {/* User chip */}
          <div className="user-chip">
            <div className="user-avatar">{initial}</div>
            <div className="user-info">
              <span className="user-name">{displayName}</span>
              {user?.email && (
                <span className="user-email">{user.email}</span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="header-divider" />

          {/* Logout */}
          <button
            className="logout-btn"
            onClick={handleLogout}
            aria-label="Sair da conta"
            title="Sair"
          >
            <LogoutIcon />
            <span>Sair</span>
          </button>
        </div>
      </header>
    </>
  )
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9.5 9.5L12 7l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 7h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

const CSS = `
  .app-header {
    height: 52px;
    flex-shrink: 0;
    background: #0f1215;
    border-bottom: 1px solid #252c38;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    gap: 16px;
  }

  .header-left { display: flex; align-items: center; }

  .header-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }

  .header-brand { color: #4a5568; }
  .header-sep   { color: #2d3748; }
  .header-page  { color: #8a94a6; }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-chip {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .user-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: #22c55e18;
    border: 1px solid #22c55e50;
    display: flex; align-items: center; justify-content: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: #22c55e;
    flex-shrink: 0;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .user-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #e8edf5;
    line-height: 1;
  }

  .user-email {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #4a5568;
    line-height: 1;
  }

  .header-divider {
    width: 1px;
    height: 20px;
    background: #252c38;
  }

  .logout-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: none;
    border: 1px solid #252c38;
    border-radius: 6px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #4a5568;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .logout-btn:hover {
    color: #ef4444;
    border-color: #ef444440;
    background: #ef444408;
  }
`
