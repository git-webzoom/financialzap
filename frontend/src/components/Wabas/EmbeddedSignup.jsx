import { useEffect, useRef, useState } from 'react'

// Meta App ID — injected at build time via Vite env (VITE_META_APP_ID)
// Falls back to a placeholder so the button always renders in dev.
const APP_ID = import.meta.env.VITE_META_APP_ID || ''

/**
 * EmbeddedSignup
 *
 * Loads the Facebook JS SDK, opens the Embedded Signup popup when the user
 * clicks the button, and calls `onConnect({ access_token, waba_id })` with
 * the credentials the user granted.
 *
 * Props:
 *   onConnect(payload)  — called after successful OAuth
 *   disabled            — disables the button
 */
export default function EmbeddedSignup({ onConnect, disabled = false }) {
  const [sdkReady, setSdkReady]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const resolveRef = useRef(null)

  // ── Load FB SDK once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (window.FB) { setSdkReady(true); return }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId:   APP_ID,
        cookie:  true,
        xfbml:   false,
        version: 'v20.0',
      })
      setSdkReady(true)
    }

    const script = document.createElement('script')
    script.id  = 'facebook-jssdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.defer = true
    document.body.appendChild(script)

    return () => {
      // Cleanup only if we added the script
      const existing = document.getElementById('facebook-jssdk')
      if (existing) existing.remove()
      delete window.fbAsyncInit
    }
  }, [])

  // ── Handle OAuth response message from popup ───────────────────────────────
  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== 'https://www.facebook.com') return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && resolveRef.current) {
          resolveRef.current(data)
          resolveRef.current = null
        }
      } catch { /* non-JSON messages from FB — ignore */ }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── Open Embedded Signup ──────────────────────────────────────────────────
  async function handleClick() {
    if (!sdkReady) { setError('SDK do Facebook ainda não carregou. Aguarde.'); return }
    if (!APP_ID)   { setError('VITE_META_APP_ID não configurado no .env do frontend.'); return }

    setLoading(true)
    setError('')

    try {
      // Wrap FB.login in a Promise
      const loginResult = await new Promise((resolve, reject) => {
        window.FB.login(
          (response) => {
            if (response.authResponse) resolve(response)
            else reject(new Error('Usuário cancelou ou não autorizou o acesso.'))
          },
          {
            scope: 'whatsapp_business_management,whatsapp_business_messaging',
            extras: {
              feature:  'whatsapp_embedded_signup',
              setup:    {},
              sessionInfoVersion: 2,
            },
          }
        )
      })

      const { accessToken } = loginResult.authResponse

      // After login, get the list of WABAs the user authorized
      const wabaData = await new Promise((resolve, reject) => {
        window.FB.api(
          '/me/whatsapp_business_accounts',
          { access_token: accessToken },
          (res) => {
            if (res?.error) reject(new Error(res.error.message))
            else resolve(res)
          }
        )
      })

      const accounts = wabaData?.data || []
      if (!accounts.length) {
        throw new Error('Nenhuma WABA autorizada. Selecione ao menos uma conta no popup da Meta.')
      }

      // Connect each authorized WABA
      for (const account of accounts) {
        await onConnect({ access_token: accessToken, waba_id: account.id })
      }
    } catch (err) {
      setError(err.message || 'Erro ao conectar WABA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="es-wrapper">
        <button
          className="es-btn"
          onClick={handleClick}
          disabled={disabled || loading || !sdkReady}
        >
          {loading ? (
            <span className="es-spinner" />
          ) : (
            <IconMeta />
          )}
          {loading ? 'Conectando…' : 'Conectar WABA via Meta'}
        </button>

        {!sdkReady && !loading && (
          <p className="es-hint">Carregando SDK da Meta…</p>
        )}
        {error && (
          <p className="es-error" role="alert">⚠ {error}</p>
        )}
      </div>
    </>
  )
}

function IconMeta() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 7.5c.276 0 .5.224.5.5v4c0 .276-.224.5-.5.5s-.5-.224-.5-.5V10c0-.276.224-.5.5-.5zm-9 0c.276 0 .5.224.5.5v4c0 .276-.224.5-.5.5S7 14.276 7 14v-4c0-.276.224-.5.5-.5zm4.5 1c.276 0 .5.224.5.5v2c0 .276-.224.5-.5.5s-.5-.224-.5-.5v-2c0-.276.224-.5.5-.5z"/>
    </svg>
  )
}

const CSS = `
  .es-wrapper { display: flex; flex-direction: column; gap: 8px; }

  .es-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 11px 20px;
    background: #22c55e;
    border: none;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #000;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
    white-space: nowrap;
  }
  .es-btn:hover:not(:disabled) {
    background: #16a34a;
    box-shadow: 0 0 20px #22c55e30;
  }
  .es-btn:active:not(:disabled) { transform: scale(0.98); }
  .es-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .es-spinner {
    width: 16px; height: 16px;
    border: 2px solid #00000030;
    border-top-color: #000;
    border-radius: 50%;
    animation: es-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes es-spin { to { transform: rotate(360deg); } }

  .es-hint  { font-size: 12px; color: #4a5568; font-family: 'DM Sans', sans-serif; }
  .es-error { font-size: 12px; color: #fca5a5; font-family: 'DM Sans', sans-serif; }
`
