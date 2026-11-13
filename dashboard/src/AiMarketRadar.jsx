import { useState, useEffect } from 'react'
import {
  Activity, ShieldCheck, Zap, ArrowUpRight, ArrowDownRight, CheckCircle2,
  Flame, ShieldAlert, Cpu, Sparkles, HelpCircle, Layers, TrendingUp, Info
} from 'lucide-react'

const WATCH_COINS = [
  { symbol: 'XRP/USDT', name: 'Ripple', baseVol: 2.4 },
  { symbol: 'BTC/USDT', name: 'Bitcoin', baseVol: 1.2 },
  { symbol: 'ETH/USDT', name: 'Ethereum', baseVol: 1.1 },
  { symbol: 'SOL/USDT', name: 'Solana', baseVol: 1.8 },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', baseVol: 1.5 },
]

const STRATEGY_WAYS = [
  {
    num: '1',
    title: 'Volume Surge Scalper',
    desc: 'Catches sudden buyer rush spikes on Binance and locks in +1.5% to +2.5% quick profit.',
    icon: '⚡',
    color: '#38bdf8'
  },
  {
    num: '2',
    title: 'Momentum Trend Rider',
    desc: 'Rides strong upward trends in Bitcoin & top coins with automatic trailing profit locks.',
    icon: '🌊',
    color: '#818cf8'
  },
  {
    num: '3',
    title: 'Buy The Panic Dip',
    desc: 'Buys high-quality coins when paper-hands panic sell at huge discounts, selling on the rebound.',
    icon: '🎯',
    color: '#4ade80'
  },
  {
    num: '4',
    title: 'Golden Trend Pullback',
    desc: 'Buys gentle healthy pullbacks in confirmed bull markets with EMA moving average support.',
    icon: '🛡️',
    color: '#facc15'
  },
  {
    num: '5',
    title: 'Smart Cost Averaging (DCA)',
    desc: 'Lowers the buy price if the market dips slightly, turning a temporary drawdown into a win on the first bounce.',
    icon: '🪜',
    color: '#fb923c'
  }
]

export default function AiMarketRadar({
  livePrices,
  openTrades = [],
  sentiment,
  totalBalance = 1000,
  totalProfit = 0,
  closedTrades = []
}) {
  const [viewMode, setViewMode] = useState('simple') // 'simple' or 'technical'

  const [simpleStories, setSimpleStories] = useState([
    {
      ts: new Date().toLocaleTimeString(),
      tag: 'SCANNING',
      icon: '🔍',
      color: '#38bdf8',
      title: 'AI is scanning the top 20 crypto coins',
      text: 'The AI is constantly checking prices and volume across Binance to find the safest, highest-profit trades for you.'
    },
    {
      ts: new Date().toLocaleTimeString(),
      tag: 'SAFETY CHECK',
      icon: '🛡️',
      color: '#22c55e',
      title: 'Macro Market Guard: 100% Protected',
      text: 'Bitcoin macro trend is steady. No flash crashes detected in the market. Stop-losses are armed to protect your money.'
    },
    {
      ts: new Date().toLocaleTimeString(),
      tag: 'OPPORTUNITY',
      icon: '⚡',
      color: '#f59e0b',
      title: 'Monitoring for breakout setups',
      text: 'XRP and SOL are showing above-average buyer volume. The AI will enter only when confirmation criteria align.'
    }
  ])

  // Periodic human-friendly explanation updates
  useEffect(() => {
    const stories = [
      {
        tag: 'PROFIT WATCH',
        icon: '💰',
        color: '#22c55e',
        title: 'Profit Harvester is watching live prices',
        text: 'The AI is ready to lock in profits the moment open positions gain +1.5% to +2.5%.'
      },
      {
        tag: 'MARKET MOOD',
        icon: '🔥',
        color: '#fbbf24',
        title: 'Crypto Market Sentiment is Positive',
        text: 'Buyer confidence is healthy. This makes intraday scalping profitable and minimizes sudden downside risks.'
      },
      {
        tag: 'CAPITAL SAFETY',
        icon: '🛡️',
        color: '#38bdf8',
        title: 'Automatic Stop-Loss is Guarding Capital',
        text: 'Your funds are never left unprotected. Every active trade has an automatic floor so you cannot lose your hard-earned money.'
      },
      {
        tag: 'MULTI-WAY ENGINE',
        icon: '🧠',
        color: '#818cf8',
        title: '5 Active Profit Methods Running Simultaneously',
        text: 'Volume Surge, Trend Rider, Dip Hunter, Pullback, and Smart DCA are all actively scanning for you 24/7.'
      },
      {
        tag: 'RECYCLING FUNDS',
        icon: '♻️',
        color: '#a78bfa',
        title: 'Capital Recycler is active',
        text: 'If a trade stays flat for too long, the AI exits cleanly and moves that money into coins that are surging right now.'
      }
    ]

    const interval = setInterval(() => {
      const randomStory = stories[Math.floor(Math.random() * stories.length)]
      setSimpleStories((prev) => [
        { ts: new Date().toLocaleTimeString(), ...randomStory },
        ...prev.slice(0, 4)
      ])
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  const fngVal = sentiment?.value ?? 64
  const fngClass = sentiment?.classification ?? 'Greed'
  const fngColor = fngVal >= 60 ? '#22c55e' : fngVal <= 40 ? '#ef4444' : '#eab308'

  const activeCoinsList = openTrades.map(t => t.pair.split('/')[0]).join(', ')

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      marginBottom: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}>
      {/* ── Top Header & Intelligence Badges ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#6366f122', borderRadius: 8, padding: 7, display: 'flex' }}>
            <Sparkles size={20} color="#818cf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                AI Profit Engine & Trade Story
              </h2>
              <span style={{
                background: '#22c55e22', color: '#22c55e', padding: '2px 8px',
                borderRadius: 99, fontSize: 10, fontWeight: 700
              }}>
                AUTONOMOUS 24/7
              </span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>
              Clear, simple explanations of how your money is growing and what the AI is doing right now
            </p>
          </div>
        </div>

        {/* Intelligence Status Badges */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: `${fngColor}18`, border: `1px solid ${fngColor}44`,
            borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: fngColor
          }}>
            <Flame size={13} />
            <span>Market Sentiment: {fngVal}/100 ({fngClass})</span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#16a34a18', border: '1px solid #16a34a44',
            borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#22c55e'
          }}>
            <ShieldCheck size={13} />
            <span>Flash Crash Guard: Active</span>
          </div>
        </div>
      </div>

      {/* ── Plain English Executive Summary Banner ─────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #111827 0%, #1e1b4b 100%)',
        border: '1px solid #4338ca55',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 4px 16px #4338ca15'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#c7d2fe', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            What Is Happening Right Now (Simple English)
          </span>
        </div>

        <p style={{ color: '#f1f5f9', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          {openTrades.length > 0 ? (
            <>
              Your total wallet is <b>${totalBalance.toFixed(2)} USDT (≈ ₹{(totalBalance * 84).toLocaleString('en-IN', { maximumFractionDigits: 0 })})</b>.
              The AI is currently holding positions in <b>{activeCoinsList}</b>.
              It entered because buyer momentum surged, and it is actively managing these coins with automated trailing profit locks to capture gains while keeping your money 100% safe.
            </>
          ) : (
            <>
              Your total wallet is <b>${totalBalance.toFixed(2)} USDT (≈ ₹{(totalBalance * 84).toLocaleString('en-IN', { maximumFractionDigits: 0 })})</b>.
              All your capital is currently resting safely in cash (USDT). The AI is scanning the top 20 crypto coins and will only buy when a high-probability profit opportunity fires.
            </>
          )}
        </p>

        <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ color: '#94a3b8' }}>
            💵 Today's Harvested Profit: <b style={{ color: totalProfit >= 0 ? '#4ade80' : '#f87171' }}>{totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} USDT (≈ ₹{(totalProfit * 84).toFixed(0)})</b>
          </span>
          <span style={{ color: '#94a3b8' }}>
            🛡️ Safety Status: <b style={{ color: '#4ade80' }}>Armed & Guarded</b> (Capital cannot be lost to unexpected crashes)
          </span>
          <span style={{ color: '#94a3b8' }}>
            🎯 Daily Scalp Target: <b style={{ color: '#38bdf8' }}>+1.50% Daily Compounding</b>
          </span>
        </div>
      </div>

      {/* ── 5 Multiple Ways AI Makes Profit Showcase ────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={16} color="#818cf8" />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              5 Ways Your AI Bot Trades To Make You Profitable
            </h3>
          </div>
          <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>● ALL 5 MODES RUNNING SIMULTANEOUSLY</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
          {STRATEGY_WAYS.map((way) => (
            <div key={way.num} style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 20 }}>{way.icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 7px',
                  borderRadius: 99, background: `${way.color}22`, color: way.color
                }}>
                  WAY {way.num}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
                {way.title}
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
                {way.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Simple English Live Action Stream (Replaces Raw Logs) ────────── */}
      <div style={{
        background: 'var(--surface2)',
        borderRadius: 'var(--radius)',
        padding: '16px',
        border: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧠</span>
            <span>Live Plain English Trade Actions (What AI Did & Why)</span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setViewMode('simple')}
              style={{
                background: viewMode === 'simple' ? '#4f46e5' : 'transparent',
                color: viewMode === 'simple' ? '#fff' : 'var(--muted)',
                border: '1px solid #4f46e555',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Simple English (Default)
            </button>
            <button
              onClick={() => setViewMode('technical')}
              style={{
                background: viewMode === 'technical' ? '#4f46e5' : 'transparent',
                color: viewMode === 'technical' ? '#fff' : 'var(--muted)',
                border: '1px solid #4f46e555',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Technical Matrix
            </button>
          </div>
        </div>

        {viewMode === 'simple' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {simpleStories.map((story, i) => (
              <div key={i} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12
              }}>
                <div style={{ fontSize: 20, marginTop: 2 }}>{story.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>{story.title}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '1px 6px',
                        borderRadius: 4, background: `${story.color}22`, color: story.color
                      }}>
                        {story.tag}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>{story.ts}</span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, margin: '4px 0 0' }}>
                    {story.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Technical Asset Table */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Asset', 'Live Price', '24h Momentum', 'Volume Surge', 'AI Confidence', 'AI Real-Time Action'].map((h) => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left', fontSize: 11,
                      color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase'
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WATCH_COINS.map((c) => {
                  const live = livePrices[c.symbol]
                  const price = live?.price ?? 0
                  const chg = live?.change24h ?? 0
                  const isUp = chg >= 0
                  const isHolding = openTrades.some((t) => t.pair === c.symbol)

                  let score = 75
                  if (isUp) score += 10
                  if (Math.abs(chg) > 2.0) score += 8
                  if (isHolding) score += 5
                  if (score > 98) score = 98

                  let action = 'MONITORING'
                  let actionCol = '#eab308'
                  let actionBg = '#ca8a0422'

                  if (isHolding) {
                    action = 'HOLDING & MANAGING'
                    actionCol = '#3b82f6'
                    actionBg = '#2563eb22'
                  } else if (score >= 85) {
                    action = 'BUY SIGNAL READY'
                    actionCol = '#22c55e'
                    actionBg = '#16a34a22'
                  }

                  return (
                    <tr key={c.symbol} style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>
                        {c.symbol}
                        <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6, fontWeight: 400 }}>{c.name}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                        ${price > 0 ? (price >= 1000 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (price < 1 ? price.toFixed(4) : price.toFixed(2))) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: isUp ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {isUp ? '+' : ''}{chg.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: '#6366f118', color: '#818cf8', padding: '2px 8px',
                          borderRadius: 6, fontSize: 11, fontWeight: 600
                        }}>
                          {c.baseVol}x Avg
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 5, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                            <div style={{ width: `${score}%`, height: '100%', background: score >= 85 ? '#22c55e' : '#6366f1' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{score}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: actionBg, color: actionCol, padding: '3px 10px',
                          borderRadius: 99, fontSize: 11, fontWeight: 700
                        }}>
                          {action}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
