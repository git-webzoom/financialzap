import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'

const NAV = [
  { to: '/dashboard',          label: 'Dashboard',    icon: IconGrid  },
  { to: '/wabas',              label: 'WABAs',         icon: IconPhone },
  { to: '/templates',          label: 'Templates',     icon: IconDoc   },
  { to: '/disparos/novo',      label: 'Novo Disparo',  icon: IconSend  },
  { to: '/disparos/historico', label: 'Histórico',     icon: IconClock },
  { to: '/aquecimento',        label: 'Aquecimento',   icon: IconFlame },
  { to: '/configuracoes',      label: 'Configurações', icon: IconGear  },
]

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [window.location.pathname])

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      <style>{CSS}</style>

      {/* ── Mobile hamburger trigger (rendered outside sidebar, into header via portal-like btn) ── */}
      <button
        className="sb-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <span /><span /><span />
      </button>

      {/* ── Backdrop ── */}
      {mobileOpen && (
        <div className="sb-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar drawer ── */}
      <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
        {/* Mobile close button */}
        <button
          className="sb-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        >
          <IconClose />
        </button>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚡</div>
          <span className="sidebar-logo-name">FinancialZap</span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
              title={label}
            >
              <span className="sidebar-link-icon"><Icon /></span>
              <span className="sidebar-link-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom status */}
        <div className="sidebar-bottom">
          <span className="sidebar-status-dot" />
          <span className="sidebar-status-text">Online</span>
        </div>
      </aside>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  )
}

function IconPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="5" y="1.5" width="10" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="10" cy="15.5" r="1" fill="currentColor"/>
    </svg>
  )
}

function IconDoc() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M11.5 2H5a1.5 1.5 0 00-1.5 1.5v13A1.5 1.5 0 005 18h10a1.5 1.5 0 001.5-1.5V7L11.5 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M11.5 2v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M17 3L9 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M17 3L12 18 9 11 2 8 17 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 6v4l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconFlame() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 18c-3.5 0-6-2.5-6-6 0-2.5 1.5-4.5 3-5.5 0 1.5.5 2.5 1.5 3C8.5 7 9.5 3.5 12 2c0 2.5.5 4-1 6 1.5-1 2-2.5 2-2.5 2 1.5 2 4 2 5.5 0 3-2.5 5-5 5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  )
}

function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Hamburger button (visible only on mobile) ── */
  .sb-hamburger {
    display: none;
    flex-direction: column;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .sb-hamburger:hover { background: #1a1f28; }
  .sb-hamburger span {
    display: block;
    width: 20px;
    height: 2px;
    background: #8a94a6;
    border-radius: 2px;
    transition: background 0.15s;
  }

  /* ── Close button (mobile only) ── */
  .sb-close {
    display: none;
    position: absolute;
    top: 14px;
    right: 14px;
    width: 32px;
    height: 32px;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #8a94a6;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;
  }
  .sb-close:hover { color: #e8edf5; background: #252c38; }

  /* ── Backdrop (mobile only) ── */
  .sb-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: #00000070;
    backdrop-filter: blur(2px);
    z-index: 49;
  }

  /* ── Sidebar ── */
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background: #0f1215;
    border-right: 1px solid #252c38;
    display: flex;
    flex-direction: column;
    padding: 20px 0 16px;
    position: relative;
    z-index: 10;
    transition: width 0.2s ease;
  }

  /* ── Logo ── */
  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px 20px;
    margin-bottom: 8px;
    border-bottom: 1px solid #252c38;
  }

  .sidebar-logo-icon {
    width: 36px;
    height: 36px;
    background: #22c55e18;
    border: 1px solid #22c55e60;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
    box-shadow: 0 0 14px #22c55e20;
  }

  .sidebar-logo-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    color: #e8edf5;
    letter-spacing: -0.3px;
    white-space: nowrap;
    overflow: hidden;
  }

  /* ── Nav ── */
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    padding: 8px 10px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sidebar-link {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 12px;
    border-radius: 8px;
    color: #4a5568;
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
    white-space: nowrap;
    overflow: hidden;
    min-height: 44px;
  }

  .sidebar-link:hover {
    color: #8a94a6;
    background: #1a1f28;
  }

  .sidebar-link--active {
    color: #22c55e;
    background: #22c55e10;
  }

  .sidebar-link--active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 22px;
    background: #22c55e;
    border-radius: 0 2px 2px 0;
    box-shadow: 0 0 8px #22c55e80;
  }

  .sidebar-link-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .sidebar-link-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 13.5px;
    font-weight: 500;
    letter-spacing: -0.1px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Bottom ── */
  .sidebar-bottom {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 0;
    margin-top: 8px;
    border-top: 1px solid #252c38;
    overflow: hidden;
  }

  .sidebar-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
    animation: sb-pulse 2s ease-in-out infinite;
  }

  .sidebar-status-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #4a5568;
    white-space: nowrap;
    overflow: hidden;
  }

  @keyframes sb-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 5px #22c55e; }
    50%       { opacity: 0.3; box-shadow: none; }
  }

  /* ── Tablet: icon-only sidebar ── */
  @media (max-width: 900px) and (min-width: 641px) {
    .sidebar { width: 64px; }
    .sidebar-logo-name   { display: none; }
    .sidebar-link-label  { display: none; }
    .sidebar-status-text { display: none; }
    .sidebar-link        { justify-content: center; padding: 12px 0; }
    .sidebar-logo        { justify-content: center; padding: 0 0 20px; }
  }

  /* ── Mobile: full-width drawer ── */
  @media (max-width: 640px) {
    .sb-hamburger {
      display: flex;
      position: fixed;
      top: 8px;
      left: 10px;
      z-index: 60;
    }
    .sb-backdrop   { display: block; }
    .sb-close      { display: flex; }

    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 280px;
      z-index: 50;
      transform: translateX(-100%);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: none;
      padding-top: 56px;
    }

    .sidebar--open {
      transform: translateX(0);
      box-shadow: 4px 0 32px #00000060;
    }
  }
`
