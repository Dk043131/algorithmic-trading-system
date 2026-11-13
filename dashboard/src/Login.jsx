import { useState } from 'react'
import { login } from './api'

export default function Login({ onAuth }) {
  const [user, setUser] = useState('freqtrade')
  const [pass, setPass] = useState('SuperTradingBot2026!')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      await login(user, pass)
      onAuth()
    } catch (error) {
      if (error?.code === 'ERR_NETWORK' || !error.response) {
        setErr('Cannot connect to bot. Make sure "bash scripts/start_bot.sh" is running in Terminal 1.')
      } else {
        setErr('Wrong username or password. Check freqtrade/config.json.')
      }
    }
    setLoading(false)
  }

  const input = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <form onSubmit={handleLogin} style={{
        width: 360,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 36,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{
            fontSize: 36, marginBottom: 8,
            filter: 'drop-shadow(0 0 12px #6366f188)',
          }}>🤖</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>My Trading Bot</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Sign in to your dashboard</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>USERNAME</label>
          <input style={input} value={user} onChange={e => setUser(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>PASSWORD</label>
          <input style={input} type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Enter your Freqtrade API password" />
        </div>

        {err && (
          <div style={{ color: 'var(--red)', fontSize: 12, padding: '10px 14px', background: 'var(--red-dim)', borderRadius: 8 }}>
            {err}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          background: loading ? 'var(--border)' : 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '13px',
          fontWeight: 700,
          fontSize: 15,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
        }}>
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
          Default login: <code style={{ color: 'var(--accent)' }}>freqtrade</code> / <code style={{ color: 'var(--accent)' }}>SuperTradingBot2026!</code>
        </p>
      </form>
    </div>
  )
}
