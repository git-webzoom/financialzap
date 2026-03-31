/**
 * pages/Configuracoes/index.jsx
 *
 * Abas:
 *  1. Perfil    — nome, email do usuário logado
 *  2. Segurança — troca de senha
 *  3. Usuários  — lista de usuários + cadastrar novo
 *  4. Sobre     — versão, informações da plataforma
 */
import { useEffect, useState, useCallback } from 'react'
import { getMe, updateMe, listUsers, createUser, deleteUser } from '../../services/authService'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const TABS = [
  { id: 'perfil',    label: 'Perfil',    icon: IconUser  },
  { id: 'seguranca', label: 'Segurança', icon: IconLock  },
  { id: 'usuarios',  label: 'Usuários',  icon: IconUsers },
  { id: 'sobre',     label: 'Sobre',     icon: IconInfo  },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Configuracoes() {
  const [tab,       setTab]      = useState('perfil')
  const [profile,   setProfile]  = useState(null)
  const [loadError, setLoadError] = useState(null)

  const loadProfile = useCallback(async () => {
    try {
      const data = await getMe()
      setProfile(data)
      setLoadError(null)
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Erro ao carregar perfil.')
    }
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  return (
    <>
      <style>{CSS}</style>
      <div className="cfg-page">

        {/* Header */}
        <div className="cfg-header">
          <h1 className="cfg-title">Configurações</h1>
          <p className="cfg-sub">Gerencie sua conta e o sistema</p>
        </div>

        {loadError && <div className="cfg-banner cfg-banner--err">⚠ {loadError}</div>}

        {/* Tab bar */}
        <div className="cfg-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`cfg-tab${tab === t.id ? ' cfg-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="cfg-content">
          {tab === 'perfil'    && <ProfileSection   profile={profile} onUpdated={loadProfile} />}
          {tab === 'seguranca' && <PasswordSection  />}
          {tab === 'usuarios'  && <UsersSection     currentUserId={profile?.id} />}
          {tab === 'sobre'     && <AboutSection     profile={profile} />}
        </div>

      </div>
    </>
  )
}

// ─── ProfileSection ───────────────────────────────────────────────────────────

function ProfileSection({ profile, onUpdated }) {
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (profile) { setName(profile.name || ''); setEmail(profile.email || '') }
  }, [profile])

  const isDirty = profile && (name.trim() !== (profile.name || '') || email.trim() !== profile.email)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(null); setSuccess(false)
    try {
      const fields = {}
      if (name.trim()  !== (profile.name  || '')) fields.name  = name.trim()
      if (email.trim() !== profile.email)          fields.email = email.trim()
      const updated = await updateMe(fields)
      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      localStorage.setItem('user', JSON.stringify({ ...stored, name: updated.name, email: updated.email }))
      setSuccess(true)
      onUpdated()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="cfg-section">
      <div className="cfg-section-header">
        <div className="cfg-section-icon"><IconUser /></div>
        <div>
          <h2 className="cfg-section-title">Perfil</h2>
          <p className="cfg-section-desc">Seu nome e endereço de email</p>
        </div>
      </div>
      <form className="cfg-form" onSubmit={handleSave}>
        <div className="cfg-field">
          <label className="cfg-label">Nome</label>
          <input className="cfg-input" type="text" value={name}
            onChange={e => { setName(e.target.value); setSuccess(false) }}
            placeholder="Seu nome" disabled={!profile || saving} autoComplete="name" />
        </div>
        <div className="cfg-field">
          <label className="cfg-label">Email</label>
          <input className="cfg-input" type="email" value={email}
            onChange={e => { setEmail(e.target.value); setSuccess(false) }}
            placeholder="seu@email.com" disabled={!profile || saving} autoComplete="email" />
        </div>
        {error   && <div className="cfg-banner cfg-banner--err">⚠ {error}</div>}
        {success && <div className="cfg-banner cfg-banner--ok">✓ Perfil atualizado com sucesso.</div>}
        <div className="cfg-form-footer">
          <button type="submit" className="cfg-btn cfg-btn--primary"
            disabled={!isDirty || saving || !profile}>
            {saving ? <Spinner dark /> : null}
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </section>
  )
}

// ─── PasswordSection ──────────────────────────────────────────────────────────

function PasswordSection() {
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showCurr, setShowCurr] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState(null)

  const matchErr  = next && confirm && next !== confirm
  const lengthErr = next && next.length < 8

  async function handleSave(e) {
    e.preventDefault()
    if (matchErr || lengthErr || !current || !next || !confirm) return
    setSaving(true); setError(null); setSuccess(false)
    try {
      await updateMe({ currentPassword: current, newPassword: next })
      setSuccess(true); setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao alterar senha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="cfg-section">
      <div className="cfg-section-header">
        <div className="cfg-section-icon"><IconLock /></div>
        <div>
          <h2 className="cfg-section-title">Segurança</h2>
          <p className="cfg-section-desc">Altere sua senha de acesso</p>
        </div>
      </div>
      <form className="cfg-form" onSubmit={handleSave}>
        <div className="cfg-field">
          <label className="cfg-label">Senha atual</label>
          <div className="cfg-input-wrap">
            <input className="cfg-input cfg-input--pw" type={showCurr ? 'text' : 'password'}
              value={current} onChange={e => { setCurrent(e.target.value); setSuccess(false) }}
              placeholder="••••••••" autoComplete="current-password" />
            <button type="button" className="cfg-eye" onClick={() => setShowCurr(v => !v)} tabIndex={-1}>
              {showCurr ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
        </div>
        <div className="cfg-field">
          <label className="cfg-label">Nova senha</label>
          <div className="cfg-input-wrap">
            <input className={`cfg-input cfg-input--pw${lengthErr ? ' cfg-input--err' : ''}`}
              type={showNext ? 'text' : 'password'} value={next}
              onChange={e => { setNext(e.target.value); setSuccess(false) }}
              placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
            <button type="button" className="cfg-eye" onClick={() => setShowNext(v => !v)} tabIndex={-1}>
              {showNext ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          {lengthErr && <p className="cfg-field-hint cfg-field-hint--err">Mínimo 8 caracteres.</p>}
        </div>
        <div className="cfg-field">
          <label className="cfg-label">Confirmar nova senha</label>
          <div className="cfg-input-wrap">
            <input className={`cfg-input cfg-input--pw${matchErr ? ' cfg-input--err' : ''}`}
              type={showNext ? 'text' : 'password'} value={confirm}
              onChange={e => { setConfirm(e.target.value); setSuccess(false) }}
              placeholder="Repita a nova senha" autoComplete="new-password" />
          </div>
          {matchErr && <p className="cfg-field-hint cfg-field-hint--err">As senhas não coincidem.</p>}
        </div>
        {error   && <div className="cfg-banner cfg-banner--err">⚠ {error}</div>}
        {success && <div className="cfg-banner cfg-banner--ok">✓ Senha alterada com sucesso.</div>}
        <div className="cfg-form-footer">
          <button type="submit" className="cfg-btn cfg-btn--primary"
            disabled={saving || !current || !next || !confirm || !!matchErr || !!lengthErr}>
            {saving ? <Spinner dark /> : null}
            {saving ? 'Alterando…' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </section>
  )
}

// ─── UsersSection ─────────────────────────────────────────────────────────────

function UsersSection({ currentUserId }) {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState(null) // userId being deleted

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await listUsers()
      setUsers(data.users)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(user) {
    if (!window.confirm(`Excluir o usuário "${user.name || user.email}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(user.id)
    try {
      await deleteUser(user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir usuário.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section className="cfg-section">
      <div className="cfg-section-header">
        <div className="cfg-section-icon"><IconUsers /></div>
        <div style={{ flex: 1 }}>
          <h2 className="cfg-section-title">Usuários</h2>
          <p className="cfg-section-desc">Gerencie os usuários com acesso ao sistema</p>
        </div>
        <button className="cfg-btn cfg-btn--primary" onClick={() => setShowForm(v => !v)}
          style={{ flexShrink: 0 }}>
          <IconPlus />
          {showForm ? 'Cancelar' : 'Novo usuário'}
        </button>
      </div>

      {/* New user form */}
      {showForm && (
        <NewUserForm onCreated={() => { setShowForm(false); load() }} />
      )}

      {/* Error */}
      {error && <div className="cfg-banner cfg-banner--err" style={{ margin: '0 22px 4px' }}>⚠ {error}</div>}

      {/* Users list */}
      <div className="cfg-users-list">
        {loading ? (
          <div className="cfg-users-empty"><Spinner /> Carregando…</div>
        ) : users.length === 0 ? (
          <div className="cfg-users-empty">Nenhum usuário encontrado.</div>
        ) : (
          users.map(u => (
            <div key={u.id} className="cfg-user-row">
              <div className="cfg-user-avatar">
                {(u.name || u.email).charAt(0).toUpperCase()}
              </div>
              <div className="cfg-user-info">
                <span className="cfg-user-name">{u.name || '(sem nome)'}</span>
                <span className="cfg-user-email">{u.email}</span>
              </div>
              <div className="cfg-user-meta">
                <span className="cfg-user-date">Desde {fmtDate(u.created_at)}</span>
                {u.id === currentUserId && (
                  <span className="cfg-user-badge">Você</span>
                )}
              </div>
              {u.id !== currentUserId && (
                <button
                  className="cfg-user-del"
                  onClick={() => handleDelete(u)}
                  disabled={deleting === u.id}
                  title="Excluir usuário"
                >
                  {deleting === u.id ? <Spinner /> : <IconTrash />}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function NewUserForm({ onCreated }) {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)

  const lengthErr = password && password.length < 8

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password || lengthErr) return
    setSaving(true); setError(null)
    try {
      await createUser({ name: name.trim(), email: email.trim(), password })
      onCreated()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar usuário.')
      setSaving(false)
    }
  }

  return (
    <form className="cfg-new-user-form" onSubmit={handleSubmit}>
      <div className="cfg-new-user-title">
        <IconPlus /> Novo usuário
      </div>
      <div className="cfg-new-user-fields">
        <div className="cfg-field">
          <label className="cfg-label">Nome</label>
          <input className="cfg-input" type="text" value={name}
            onChange={e => { setName(e.target.value); setError(null) }}
            placeholder="Nome completo" autoComplete="off" disabled={saving} />
        </div>
        <div className="cfg-field">
          <label className="cfg-label">Email</label>
          <input className="cfg-input" type="email" value={email}
            onChange={e => { setEmail(e.target.value); setError(null) }}
            placeholder="usuario@email.com" autoComplete="off" disabled={saving} />
        </div>
        <div className="cfg-field">
          <label className="cfg-label">Senha</label>
          <div className="cfg-input-wrap">
            <input className={`cfg-input cfg-input--pw${lengthErr ? ' cfg-input--err' : ''}`}
              type={showPw ? 'text' : 'password'} value={password}
              onChange={e => { setPassword(e.target.value); setError(null) }}
              placeholder="Mínimo 8 caracteres" autoComplete="new-password" disabled={saving} />
            <button type="button" className="cfg-eye" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
              {showPw ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          {lengthErr && <p className="cfg-field-hint cfg-field-hint--err">Mínimo 8 caracteres.</p>}
        </div>
      </div>
      {error && <div className="cfg-banner cfg-banner--err">⚠ {error}</div>}
      <div className="cfg-form-footer">
        <button type="submit" className="cfg-btn cfg-btn--primary"
          disabled={saving || !name.trim() || !email.trim() || !password || !!lengthErr}>
          {saving ? <Spinner dark /> : <IconPlus />}
          {saving ? 'Criando…' : 'Criar usuário'}
        </button>
      </div>
    </form>
  )
}

// ─── AboutSection ─────────────────────────────────────────────────────────────

function AboutSection({ profile }) {
  return (
    <section className="cfg-section">
      <div className="cfg-section-header">
        <div className="cfg-section-icon"><IconInfo /></div>
        <div>
          <h2 className="cfg-section-title">Sobre</h2>
          <p className="cfg-section-desc">Informações da plataforma</p>
        </div>
      </div>
      <div className="cfg-about-grid">
        <AboutRow label="Plataforma"    value="FinancialZap" />
        <AboutRow label="Versão"        value="1.0.0" />
        <AboutRow label="API"           value="Meta WhatsApp Business Cloud API" />
        <AboutRow label="Conta criada"  value={profile ? fmtDate(profile.created_at) : '…'} />
        <AboutRow label="ID da conta"   value={profile ? `#${profile.id}` : '…'} mono />
      </div>
    </section>
  )
}

function AboutRow({ label, value, mono }) {
  return (
    <div className="cfg-about-row">
      <span className="cfg-about-label">{label}</span>
      <span className={`cfg-about-value${mono ? ' cfg-about-value--mono' : ''}`}>{value}</span>
    </div>
  )
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Spinner({ dark }) {
  return <span className={`cfg-spinner${dark ? ' cfg-spinner--dark' : ''}`} />
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconUser() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7" r="3" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M1 17c0-2.761 2.91-5 6.5-5s6.5 2.239 6.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="14.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M17 16c0-2.209-1.567-4-3.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.5" y="9" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="10" cy="13.5" r="1.2" fill="currentColor"/>
    </svg>
  )
}

function IconInfo() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="10" cy="6.5" r="0.9" fill="currentColor"/>
    </svg>
  )
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 3l14 14M8.5 8.6A2.5 2.5 0 0012.4 12M6.5 5.6C4.3 6.9 2.5 9 1 10c1.5 1 4.5 5 9 5a8.5 8.5 0 004.5-1.4M9 5.1A8.5 8.5 0 0119 10c-.8.6-2 1.7-3.5 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 6h14M8 6V4h4v2M5 6l1 12h8l1-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .cfg-page {
    display: flex; flex-direction: column; gap: 20px;
    max-width: 720px;
  }

  .cfg-header { display: flex; flex-direction: column; gap: 4px; }
  .cfg-title {
    font-family: 'DM Sans', sans-serif; font-size: 22px;
    font-weight: 600; color: #e8edf5; letter-spacing: -0.3px; margin: 0;
  }
  .cfg-sub { font-size: 13px; color: #4a5568; font-family: 'DM Sans', sans-serif; margin: 0; }

  /* ── Banners ── */
  .cfg-banner {
    padding: 10px 14px; border-radius: 8px;
    font-size: 13px; font-family: 'DM Sans', sans-serif;
  }
  .cfg-banner--err { background: #ef444412; border: 1px solid #ef444430; color: #fca5a5; }
  .cfg-banner--ok  { background: #22c55e12; border: 1px solid #22c55e30; color: #86efac; }

  /* ── Tabs ── */
  .cfg-tabs {
    display: flex; gap: 2px;
    background: #0c0f13; border: 1px solid #1a1f28;
    border-radius: 10px; padding: 4px;
    width: fit-content; flex-wrap: wrap;
  }
  .cfg-tab {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 7px; border: none;
    background: transparent; color: #4a5568;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }
  .cfg-tab:hover { color: #8a94a6; background: #1a1f2850; }
  .cfg-tab--active {
    background: #1a1f28; color: #e8edf5;
    box-shadow: 0 1px 3px #00000040;
  }

  /* ── Section card ── */
  .cfg-content { display: flex; flex-direction: column; gap: 0; }

  .cfg-section {
    background: #0f1215; border: 1px solid #1a1f28;
    border-radius: 14px; overflow: hidden;
  }

  .cfg-section-header {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 22px; border-bottom: 1px solid #1a1f28;
  }
  .cfg-section-icon {
    width: 36px; height: 36px;
    background: #22c55e12; border: 1px solid #22c55e25;
    border-radius: 9px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    color: #22c55e;
  }
  .cfg-section-title {
    font-family: 'DM Sans', sans-serif; font-size: 15px;
    font-weight: 600; color: #e8edf5; margin: 0;
  }
  .cfg-section-desc {
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    color: #4a5568; margin: 2px 0 0;
  }

  /* ── Form ── */
  .cfg-form { display: flex; flex-direction: column; gap: 18px; padding: 20px 22px; }
  .cfg-field { display: flex; flex-direction: column; gap: 6px; }
  .cfg-label {
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    font-weight: 600; color: #8a94a6; text-transform: uppercase; letter-spacing: 0.4px;
  }
  .cfg-input-wrap { position: relative; }
  .cfg-input {
    width: 100%; padding: 10px 14px;
    background: #0c0f13; border: 1px solid #252c38;
    border-radius: 9px; color: #e8edf5;
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    outline: none; transition: border-color 0.15s; box-sizing: border-box;
  }
  .cfg-input::placeholder { color: #2d3748; }
  .cfg-input:focus  { border-color: #22c55e60; }
  .cfg-input:disabled { opacity: 0.4; cursor: not-allowed; }
  .cfg-input--err   { border-color: #ef444460 !important; }
  .cfg-input--pw    { padding-right: 42px; }
  .cfg-eye {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: #4a5568; cursor: pointer;
    padding: 4px; display: flex; align-items: center; transition: color 0.15s;
  }
  .cfg-eye:hover { color: #8a94a6; }
  .cfg-field-hint { font-family: 'DM Sans', sans-serif; font-size: 12px; margin: 0; }
  .cfg-field-hint--err { color: #fca5a5; }
  .cfg-form-footer { display: flex; justify-content: flex-end; padding-top: 4px; }

  /* ── Buttons ── */
  .cfg-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: opacity 0.15s, background 0.15s;
  }
  .cfg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .cfg-btn--primary { background: #22c55e; color: #000; }
  .cfg-btn--primary:hover:not(:disabled) { background: #16a34a; }

  /* ── Spinner ── */
  .cfg-spinner {
    display: inline-block; width: 13px; height: 13px;
    border: 2px solid #ffffff30; border-top-color: #fff;
    border-radius: 50%; animation: cfg-spin 0.7s linear infinite;
  }
  .cfg-spinner--dark {
    border-color: #00000030; border-top-color: #000;
  }
  @keyframes cfg-spin { to { transform: rotate(360deg); } }

  /* ── About ── */
  .cfg-about-grid { display: flex; flex-direction: column; padding: 4px 22px 20px; }
  .cfg-about-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 0; border-bottom: 1px solid #1a1f28; gap: 12px;
  }
  .cfg-about-row:last-child { border-bottom: none; }
  .cfg-about-label { font-family: 'DM Sans', sans-serif; font-size: 13px; color: #4a5568; }
  .cfg-about-value { font-family: 'DM Sans', sans-serif; font-size: 13px; color: #e8edf5; text-align: right; }
  .cfg-about-value--mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8a94a6; }

  /* ── Users list ── */
  .cfg-users-list { display: flex; flex-direction: column; }
  .cfg-users-empty {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 32px 22px; font-family: 'DM Sans', sans-serif;
    font-size: 13px; color: #4a5568;
  }
  .cfg-user-row {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 22px; border-bottom: 1px solid #1a1f28;
    transition: background 0.12s;
  }
  .cfg-user-row:last-child { border-bottom: none; }
  .cfg-user-row:hover { background: #1a1f2830; }
  .cfg-user-avatar {
    width: 36px; height: 36px; flex-shrink: 0;
    background: #22c55e18; border: 1px solid #22c55e25;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700;
    color: #22c55e;
  }
  .cfg-user-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .cfg-user-name {
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    font-weight: 500; color: #e8edf5;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cfg-user-email {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #4a5568;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cfg-user-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .cfg-user-date { font-family: 'DM Sans', sans-serif; font-size: 12px; color: #4a5568; }
  .cfg-user-badge {
    padding: 2px 8px; border-radius: 999px;
    background: #22c55e15; border: 1px solid #22c55e30;
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600;
    color: #22c55e;
  }
  .cfg-user-del {
    width: 32px; height: 32px; flex-shrink: 0;
    background: none; border: 1px solid transparent;
    border-radius: 7px; color: #4a5568; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .cfg-user-del:hover:not(:disabled) {
    background: #ef444415; border-color: #ef444430; color: #f87171;
  }
  .cfg-user-del:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── New user form ── */
  .cfg-new-user-form {
    display: flex; flex-direction: column; gap: 16px;
    padding: 18px 22px;
    border-bottom: 1px solid #1a1f28;
    background: #22c55e06;
  }
  .cfg-new-user-title {
    display: flex; align-items: center; gap: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    font-weight: 600; color: #22c55e;
  }
  .cfg-new-user-fields {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;
  }

  @media (max-width: 700px) {
    .cfg-new-user-fields { grid-template-columns: 1fr; }
    .cfg-tabs { width: 100%; }
    .cfg-tab  { flex: 1; justify-content: center; padding: 8px 10px; }
    .cfg-form { padding: 16px; }
    .cfg-section-header { padding: 14px 16px; }
    .cfg-about-grid { padding: 4px 16px 16px; }
    .cfg-new-user-form { padding: 14px 16px; }
    .cfg-user-row { padding: 12px 16px; }
  }
`
