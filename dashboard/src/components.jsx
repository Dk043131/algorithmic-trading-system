import { clsx } from 'clsx'

/** Reusable stat card */
export function StatCard({ label, value, sub, color = 'text', icon: Icon, glow }) {
  const colorMap = {
    green: { val: '#22c55e', bg: '#16a34a22' },
    red:   { val: '#ef4444', bg: '#dc262622' },
    blue:  { val: '#3b82f6', bg: '#2563eb22' },
    yellow:{ val: '#eab308', bg: '#ca8a0422' },
    text:  { val: '#e8eaf6', bg: '#25253022' },
  }
  const c = colorMap[color] ?? colorMap.text

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${glow ? c.val + '55' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: glow ? `0 0 24px ${c.val}22` : 'none',
      transition: 'box-shadow 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && (
          <div style={{ background: c.bg, borderRadius: 8, padding: 6, display: 'flex' }}>
            <Icon size={16} color={c.val} />
          </div>
        )}
        <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c.val, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

/** Status badge pill */
export function Badge({ text, color = 'blue' }) {
  const map = {
    running: { bg: '#16a34a22', col: '#22c55e', label: '● Running' },
    stopped: { bg: '#dc262622', col: '#ef4444', label: '● Stopped' },
    paused:  { bg: '#ca8a0422', col: '#eab308', label: '● Paused'  },
    blue:    { bg: '#2563eb22', col: '#3b82f6', label: text        },
    green:   { bg: '#16a34a22', col: '#22c55e', label: text        },
    red:     { bg: '#dc262622', col: '#ef4444', label: text        },
    yellow:  { bg: '#ca8a0422', col: '#eab308', label: text        },
  }
  const s = map[text?.toLowerCase()] ?? map[color]
  return (
    <span style={{
      background: s.bg,
      color: s.col,
      padding: '3px 10px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
    }}>
      {s.label}
    </span>
  )
}

/** Section wrapper */
export function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

/** Primary button */
export function Btn({ children, onClick, variant = 'primary', disabled, small }) {
  const vars = {
    primary:  { bg: 'var(--accent)', hover: '#4f52d8', col: '#fff' },
    danger:   { bg: '#dc2626',        hover: '#b91c1c', col: '#fff' },
    ghost:    { bg: 'var(--surface2)',hover: 'var(--border)', col: 'var(--text)' },
  }
  const v = vars[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'var(--border)' : v.bg,
        color: disabled ? 'var(--muted)' : v.col,
        border: 'none',
        borderRadius: 8,
        padding: small ? '6px 14px' : '10px 20px',
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}
