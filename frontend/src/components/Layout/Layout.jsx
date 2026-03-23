import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  return (
    <>
      <style>{CSS}</style>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          <Header />
          <main className="app-content">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  )
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-void:       #0a0c0f;
    --bg-panel:      #0f1215;
    --bg-card:       #141820;
    --bg-input:      #1a1f28;
    --border:        #252c38;
    --border-glow:   #22c55e40;
    --green:         #22c55e;
    --green-dim:     #16a34a;
    --green-muted:   #22c55e18;
    --text-primary:  #e8edf5;
    --text-secondary:#8a94a6;
    --text-muted:    #4a5568;
    --red:           #ef4444;
    --amber:         #f59e0b;
    --blue:          #3b82f6;
    --mono: 'JetBrains Mono', monospace;
    --sans: 'DM Sans', sans-serif;
  }

  html, body, #root {
    height: 100%;
    background: var(--bg-void);
    color: var(--text-primary);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Shell ── */
  .app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .app-content {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-void);
    padding: 28px 32px;
  }

  /* ── Scrollbar ── */
  .app-content::-webkit-scrollbar { width: 6px; }
  .app-content::-webkit-scrollbar-track { background: transparent; }
  .app-content::-webkit-scrollbar-thumb { background: #252c38; border-radius: 3px; }
  .app-content::-webkit-scrollbar-thumb:hover { background: #374151; }

  /*
   * ── Global page wrapper ──────────────────────────────────────────────────────
   * Use .page-root on every page's outermost div.
   * It ensures the page always fills the full width of app-content.
   */
  .page-root {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /*
   * ── Global card grid ─────────────────────────────────────────────────────────
   * Use .cards-grid on any grid of metric/stat cards across the system.
   * Always fills 100% width. Responsive: 1 col → 2 col → 4 col.
   */
  .cards-grid {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  @media (max-width: 1024px) {
    .cards-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 540px) {
    .cards-grid { grid-template-columns: 1fr; }
  }

  /* 2-column variant */
  .cards-grid--2 {
    grid-template-columns: repeat(2, 1fr);
  }

  /* 3-column variant */
  .cards-grid--3 {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 768px) {
    .cards-grid--2,
    .cards-grid--3 { grid-template-columns: 1fr; }
  }

  @media (max-width: 540px) {
    .app-content { padding: 20px 16px; }
  }
`
