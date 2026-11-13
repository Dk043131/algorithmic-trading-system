import { useState, useEffect, useRef } from 'react'
import {
  TrendingUp, TrendingDown, Maximize2, RefreshCw, BarChart2,
  Layers, Zap, Clock, Shield, Target, Crosshair
} from 'lucide-react'
import { fetchStockCandles } from './api'

export default function StockCandleChart({
  symbol = 'NVDA',
  activePosition = null,
  onSelectSymbol = null
}) {
  const [candles, setCandles] = useState([])
  const [timeframe, setTimeframe] = useState('5m')
  const [loading, setLoading] = useState(true)
  const [hoveredCandle, setHoveredCandle] = useState(null)
  const [selectedSym, setSelectedSym] = useState(symbol)
  const [customInput, setCustomInput] = useState('')

  useEffect(() => {
    setSelectedSym(symbol)
  }, [symbol])

  const handleCustomSubmit = (e) => {
    e?.preventDefault()
    if (!customInput.trim()) return
    const cleanSym = customInput.trim().toUpperCase()
    setSelectedSym(cleanSym)
    if (onSelectSymbol) onSelectSymbol(cleanSym)
    setCustomInput('')
  }

  const loadCandles = async (sym = selectedSym, tf = timeframe) => {
    try {
      const data = await fetchStockCandles(sym, tf, 45)
      if (data?.candles && Array.isArray(data.candles)) {
        setCandles(data.candles)
      }
    } catch (err) {
      console.error('Error fetching candles:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadCandles(selectedSym, timeframe)
    const interval = setInterval(() => {
      loadCandles(selectedSym, timeframe)
    }, 1200)
    return () => clearInterval(interval)
  }, [selectedSym, timeframe])

  // Chart dimensions & scaling calculations
  const width = 850
  const height = 360
  const padding = { top: 30, right: 75, bottom: 45, left: 15 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const volumeH = 60

  const safeCandles = Array.isArray(candles) ? candles : []
  const prices = safeCandles.flatMap((c) => [Number(c?.high), Number(c?.low)].filter((v) => !isNaN(v) && v > 0))
  if (activePosition) {
    const ep = Number(activePosition.entry_price)
    const tp = Number(activePosition.target_price)
    const sl = Number(activePosition.stop_loss)
    if (!isNaN(ep) && ep > 0) prices.push(ep)
    if (!isNaN(tp) && tp > 0) prices.push(tp)
    if (!isNaN(sl) && sl > 0) prices.push(sl)
  }

  const minPrice = prices.length ? Math.min(...prices) * 0.998 : 100
  const maxPrice = prices.length ? Math.max(...prices) * 1.002 : 110
  const priceRange = maxPrice > minPrice ? (maxPrice - minPrice) : 1

  const getY = (price) => {
    const p = Number(price)
    const validPrice = isNaN(p) || p <= 0 ? minPrice : p
    const safeRange = priceRange > 0 && !isNaN(priceRange) ? priceRange : 1
    const normalized = Math.min(1, Math.max(0, (validPrice - minPrice) / safeRange))
    const res = padding.top + (chartH - volumeH) * (1 - normalized)
    return isNaN(res) ? padding.top : res
  }

  const maxVol = safeCandles.length ? Math.max(...safeCandles.map((c) => Number(c?.volume) || 1)) : 1000
  const candleCount = safeCandles.length || 1
  const candleW = Math.max(3, Math.floor(chartW / candleCount) - 3)

  const latestCandle = safeCandles.length > 0 ? safeCandles[safeCandles.length - 1] : null
  const currentPrice = Number(latestCandle?.close ?? 0)
  const firstCandle = safeCandles.length > 0 ? safeCandles[0] : null
  const firstOpen = Number(firstCandle?.open || 0)
  const sessionChangePct = firstOpen > 0 ? (((currentPrice - firstOpen) / firstOpen) * 100).toFixed(2) : '0.00'
  const isUp = parseFloat(sessionChangePct) >= 0
  const isNS = Boolean(selectedSym && selectedSym.includes('.NS'))

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '18px 20px',
      marginBottom: 20,
      position: 'relative',
      boxShadow: '0 4px 20px #00000033'
    }}>
      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: isUp ? '#10b98122' : '#ef444422',
            padding: 8, borderRadius: 8, display: 'flex'
          }}>
            <BarChart2 size={20} color={isUp ? '#10b981' : '#ef4444'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>
                {selectedSym}
              </span>
              <span style={{
                fontSize: 18, fontWeight: 800, fontFamily: 'monospace',
                color: isUp ? '#4ade80' : '#f87171'
              }}>
                {isNS ? `₹${currentPrice > 0 ? currentPrice.toLocaleString('en-IN') : '—'}` : `$${currentPrice > 0 ? currentPrice.toFixed(2) : '—'}`}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                background: isUp ? '#10b98122' : '#ef444422',
                color: isUp ? '#4ade80' : '#f87171'
              }}>
                {isUp ? '+' : ''}{sessionChangePct}%
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Real-Time High-Resolution Candlestick Stream · Intraday OHLC
            </div>
          </div>
        </div>

        {/* Timeframe & Symbol Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Custom Stock Search Input */}
          <form onSubmit={handleCustomSubmit} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="text"
              placeholder="Search ticker (e.g. TSLA, TCS.NS)..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                color: '#fff',
                width: 170,
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '4px 9px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Go
            </button>
          </form>

          {/* Quick Ticker pills */}
          <div style={{ display: 'flex', background: 'var(--surface)', padding: 3, borderRadius: 8, border: '1px solid var(--border)', gap: 3, flexWrap: 'wrap' }}>
            {['NVDA', 'TSLA', 'AAPL', 'MSFT', 'PLTR', 'RELIANCE.NS', 'TCS.NS', 'MARUTI.NS', 'HDFCBANK.NS'].map((sym) => (
              <button
                key={sym}
                onClick={() => {
                  setSelectedSym(sym)
                  if (onSelectSymbol) onSelectSymbol(sym)
                }}
                style={{
                  background: selectedSym === sym ? '#4f46e5' : 'transparent',
                  color: selectedSym === sym ? '#fff' : 'var(--muted)',
                  border: 'none', borderRadius: 6, padding: '3px 7px', fontSize: 10,
                  fontWeight: 800, cursor: 'pointer'
                }}
              >
                {sym.replace('.NS', '')}
              </button>
            ))}
          </div>

          {/* Timeframe pills */}
          <div style={{ display: 'flex', background: 'var(--surface)', padding: 3, borderRadius: 8, border: '1px solid var(--border)', gap: 3 }}>
            {['1m', '5m', '15m', '1h'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? '#2563eb' : 'transparent',
                  color: timeframe === tf ? '#fff' : 'var(--muted)',
                  border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11,
                  fontWeight: 700, cursor: 'pointer'
                }}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadCandles()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 10px', color: 'var(--muted)', cursor: 'pointer'
            }}
            title="Refresh Candles"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Active Trade Overlay HUD ──────────────────────────────────── */}
      {activePosition && (
        <div style={{
          background: '#04785715',
          border: '1px solid #10b98155',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#4ade80' }}>
              🎯 ACTIVE POSITION HOLDING: {activePosition.shares} shares
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Entry: <b>{activePosition.currency === 'INR' ? '₹' : '$'}{activePosition.entry_price}</b>
            </span>
            <span style={{ fontSize: 11, color: '#4ade80' }}>
              TP: <b>{activePosition.currency === 'INR' ? '₹' : '$'}{activePosition.target_price} (+{activePosition.target_gain_pct}%)</b>
            </span>
            <span style={{ fontSize: 11, color: '#f87171' }}>
              SL: <b>{activePosition.currency === 'INR' ? '₹' : '$'}{activePosition.stop_loss} (-{activePosition.stop_loss_pct}%)</b>
            </span>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 800, fontFamily: 'monospace',
            color: (activePosition.unrealized_pnl_usd ?? 0) >= 0 ? '#4ade80' : '#f87171'
          }}>
            Floating P&L: {(activePosition.unrealized_pnl_usd ?? 0) >= 0 ? '+' : ''}${activePosition.unrealized_pnl_usd} ({activePosition.unrealized_pnl_pct}%)
          </div>
        </div>
      )}

      {/* ── Hovered Candle Telemetry Bar ───────────────────────────────── */}
      <div style={{
        fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)',
        marginBottom: 8, display: 'flex', gap: 14, flexWrap: 'wrap', minHeight: 18
      }}>
        {hoveredCandle ? (
          <>
            <span>TIME: <b style={{ color: '#fff' }}>{hoveredCandle.time_str}</b></span>
            <span>OPEN: <b style={{ color: '#fff' }}>${hoveredCandle.open}</b></span>
            <span>HIGH: <b style={{ color: '#4ade80' }}>${hoveredCandle.high}</b></span>
            <span>LOW: <b style={{ color: '#f87171' }}>${hoveredCandle.low}</b></span>
            <span>CLOSE: <b style={{ color: hoveredCandle.close >= hoveredCandle.open ? '#4ade80' : '#f87171' }}>${hoveredCandle.close}</b></span>
            <span>VOL: <b style={{ color: '#38bdf8' }}>{hoveredCandle.volume?.toLocaleString()}</b></span>
          </>
        ) : (
          <span>Hover over any candle to inspect sub-second OHLC values</span>
        )}
      </div>

      {/* ── SVG CANDLESTICK CANVAS ─────────────────────────────────────── */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', background: '#090d16', borderRadius: 8 }}
          onMouseLeave={() => setHoveredCandle(null)}
        >
          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const priceVal = minPrice + (maxPrice - minPrice) * (1 - pct)
            const y = padding.top + (chartH - volumeH) * pct
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
                <text
                  x={width - padding.right + 8}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {selectedSym.includes('.NS') ? `₹${priceVal.toFixed(0)}` : `$${priceVal.toFixed(2)}`}
                </text>
              </g>
            )
          })}

          {/* Active Position Overlay Lines */}
          {activePosition && (
            <>
              {/* Take-Profit Target Line */}
              <g>
                <line
                  x1={padding.left}
                  y1={getY(activePosition.target_price)}
                  x2={width - padding.right}
                  y2={getY(activePosition.target_price)}
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <rect
                  x={width - padding.right + 4}
                  y={getY(activePosition.target_price) - 8}
                  width="68"
                  height="16"
                  fill="#10b981"
                  rx="3"
                />
                <text
                  x={width - padding.right + 8}
                  y={getY(activePosition.target_price) + 4}
                  fill="#fff"
                  fontSize="9"
                  fontWeight="bold"
                >
                  TP ${activePosition.target_price}
                </text>
              </g>

              {/* Stop-Loss Line */}
              <g>
                <line
                  x1={padding.left}
                  y1={getY(activePosition.stop_loss)}
                  x2={width - padding.right}
                  y2={getY(activePosition.stop_loss)}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <rect
                  x={width - padding.right + 4}
                  y={getY(activePosition.stop_loss) - 8}
                  width="68"
                  height="16"
                  fill="#ef4444"
                  rx="3"
                />
                <text
                  x={width - padding.right + 8}
                  y={getY(activePosition.stop_loss) + 4}
                  fill="#fff"
                  fontSize="9"
                  fontWeight="bold"
                >
                  SL ${activePosition.stop_loss}
                </text>
              </g>

              {/* Entry Price Line */}
              <g>
                <line
                  x1={padding.left}
                  y1={getY(activePosition.entry_price)}
                  x2={width - padding.right}
                  y2={getY(activePosition.entry_price)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
                <text
                  x={width - padding.right + 8}
                  y={getY(activePosition.entry_price) + 3}
                  fill="#38bdf8"
                  fontSize="9"
                  fontWeight="bold"
                >
                  ENTRY ${activePosition.entry_price}
                </text>
              </g>
            </>
          )}

          {/* Current Live Price Line Marker */}
          <line
            x1={padding.left}
            y1={getY(currentPrice)}
            x2={width - padding.right}
            y2={getY(currentPrice)}
            stroke="#fbbf24"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.8"
          />

          {/* Volume Separator Line */}
          <line
            x1={padding.left}
            y1={height - padding.bottom - volumeH}
            x2={width - padding.right}
            y2={height - padding.bottom - volumeH}
            stroke="#1e293b"
          />
          <text
            x={padding.left + 4}
            y={height - padding.bottom - volumeH + 12}
            fill="#475569"
            fontSize="9"
            fontFamily="monospace"
          >
            VOLUME
          </text>

          {/* Candlesticks & Volume Bars */}
          {safeCandles.length === 0 ? (
            <text x={width / 2} y={height / 2 - 10} fill="#64748b" textAnchor="middle" fontSize="13" fontFamily="sans-serif">
              Loading {selectedSym} Candlestick Data...
            </text>
          ) : (
            safeCandles.map((c, i) => {
              const x = padding.left + i * (chartW / (safeCandles.length || 1)) + ((chartW / (safeCandles.length || 1)) - candleW) / 2
              const openVal = Number(c?.open || 0)
              const closeVal = Number(c?.close || 0)
              const highVal = Number(c?.high || 0)
              const lowVal = Number(c?.low || 0)
              const volVal = Number(c?.volume || 0)

              const isBullish = closeVal >= openVal
              const candleColor = isBullish ? '#10b981' : '#ef4444'

              const yOpen = getY(openVal)
              const yClose = getY(closeVal)
              const yHigh = getY(highVal)
              const yLow = getY(lowVal)

              const bodyY = Math.min(yOpen, yClose)
              const bodyH = Math.max(2, Math.abs(yClose - yOpen))

              // Volume bar calculation
              const volBarH = (volVal / (maxVol || 1)) * volumeH
              const volY = height - padding.bottom - volBarH

              const isHovered = hoveredCandle === c

              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredCandle(c)}
                  style={{ cursor: 'crosshair' }}
                >
                  {/* Volume bar */}
                  <rect
                    x={x}
                    y={volY}
                    width={candleW}
                    height={volBarH}
                    fill={candleColor}
                    opacity={isHovered ? 0.8 : 0.3}
                  />

                  {/* Upper and lower wick */}
                  <line
                    x1={x + candleW / 2}
                    y1={yHigh}
                    x2={x + candleW / 2}
                    y2={yLow}
                    stroke={candleColor}
                    strokeWidth={isHovered ? '2' : '1.2'}
                  />

                  {/* Candle body */}
                  <rect
                    x={x}
                    y={bodyY}
                    width={candleW}
                    height={bodyH}
                    fill={candleColor}
                    rx="1"
                    stroke={isHovered ? '#fff' : 'none'}
                    strokeWidth={isHovered ? 1 : 0}
                  />

                  {/* Time Axis labels (every 8 candles) */}
                  {i % 8 === 0 && (
                    <text
                      x={x + candleW / 2}
                      y={height - padding.bottom + 16}
                      fill="#64748b"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {c.time_str || ''}
                    </text>
                  )}
                </g>
              )
            })
          )}
        </svg>
      </div>
    </div>
  )
}
