import React, { Component } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Fatal Root Error Caught:', error, errorInfo)
  }

  handleReset = () => {
    localStorage.removeItem('ft_jwt_token')
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0d0f14',
          color: '#e8eaf6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Inter, -apple-system, sans-serif'
        }}>
          <div style={{
            background: '#141720',
            border: '1px solid #252a3a',
            borderRadius: 16,
            maxWidth: 520,
            width: '100%',
            padding: 32,
            textAlign: 'center',
            boxShadow: '0 20px 40px #00000066'
          }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>⚡</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              DK's TRADE Dashboard
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              A UI rendering refresh was required. Click below to instantly restore the live dashboard.
            </p>
            <div style={{
              background: '#1b1f2e',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: 12,
              color: '#f87171',
              fontSize: 12,
              fontFamily: 'monospace',
              marginBottom: 20,
              textAlign: 'left',
              maxHeight: 120,
              overflowY: 'auto'
            }}>
              {this.state.error?.message || 'Unknown render exception'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh Dashboard
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  background: '#334155',
                  color: '#cbd5e1',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reset Session & Login
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
)

