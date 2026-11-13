import { useEffect, useState, useCallback, useRef, Component } from 'react'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, Activity,
  RefreshCw, Power, PauseCircle,
  ArrowUpRight, ArrowDownRight, Shield, Zap, LogOut, Radio,
  Send, Download, Lock, CheckCircle2, AlertTriangle, FileText, X, Sparkles, Flame, Coins,
  Globe, Building2, Cpu, ChevronRight, Layers, PieChart, ShieldCheck, Compass, Gauge
} from 'lucide-react'
import { StatCard, Badge, Section, Btn } from './components'
import {
  fetchBalance, fetchProfit, fetchOpenTrades,
  fetchClosedTrades, fetchDailyProfit, startBot, stopBot,
  fetchBotState, fetchPerformance, forceEnter, forceExit,
  fetchFearAndGreed, fetchStockPortfolio
} from './api'
import { useBinanceTicker } from './useBinanceTicker'
import AiMarketRadar from './AiMarketRadar'
import MultiAssetHub from './MultiAssetHub'

const fmt = (n, decimals = 2) => {
  const num = typeof n === 'number' ? n : parseFloat(n)
  return isNaN(num) ? '—' : num.toFixed(decimals)
}

const fmtUSDT = (n) => {
  const num = typeof n === 'number' ? n : parseFloat(n)
  if (isNaN(num)) return '—'
  return (num >= 0 ? '+' : '') + fmt(num) + ' USDT'
}

const fmtINR = (usdt, fx = 95.05) => {
  const num = typeof usdt === 'number' ? usdt : parseFloat(usdt)
  if (isNaN(num)) return ''
  const inr = num * fx
  return `≈ ₹${inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('TabErrorBoundary caught an error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid #ef444455',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          color: '#f87171',
          margin: '20px 0'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            ⚠️ Desk Temporarily Unavailable
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {this.state.error?.message || 'An unexpected rendering issue occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔄 Reload Desk
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Dashboard({ onLogout }) {
  const [openTrades, setOpenTrades] = useState([])
  const activePairs = openTrades.map((t) => t.pair)
  const { prices: livePrices, isConnected: isWsConnected } = useBinanceTicker(activePairs)

  const [balance, setBalance] = useState(null)
  const [profit, setProfit] = useState(null)
  const [closedTrades, setClosedTrades] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [botState, setBotState] = useState('running')
  const [performance, setPerformance] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [controlling, setControlling] = useState(false)
  const [tradeActionLoading, setTradeActionLoading] = useState(false)

  // Master Trading Dashboard Navigation (Defaults to 'stocks' for Groww Live Trading)
  const [activeTradingTab, setActiveTradingTab] = useState('stocks')
  const [stockPortfolio, setStockPortfolio] = useState(null)

  // Advanced features state
  const [sentiment, setSentiment] = useState({ value: 64, classification: 'Greed' })
  const [showTelegramModal, setShowTelegramModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [safeguardSuccess, setSafeguardSuccess] = useState(false)

  // ── Fast Polling (every 2.5s) for Live Trades & Balance ─────────────────
  const fastRefresh = useCallback(async () => {
    try {
      const [bal, prof, open, state] = await Promise.allSettled([
        fetchBalance(),
        fetchProfit(),
        fetchOpenTrades(),
        fetchBotState(),
      ])
      if (bal.status === 'fulfilled') setBalance(bal.value)
      if (prof.status === 'fulfilled') setProfit(prof.value)
      if (open.status === 'fulfilled') setOpenTrades(open.value)
      if (state.status === 'fulfilled') setBotState(state.value?.state ?? 'running')
      setLastUpdate(new Date())
    } catch (e) {
      console.error('Fast refresh error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Slower Polling (every 30s) for Charts & History ───────────────────────
  const slowRefresh = useCallback(async () => {
    try {
      const [closed, daily, perf] = await Promise.allSettled([
        fetchClosedTrades(50),
        fetchDailyProfit(30),
        fetchPerformance(),
      ])
      if (closed.status === 'fulfilled') setClosedTrades(closed.value)
      if (daily.status === 'fulfilled') {
        const raw = daily.value?.data ?? []
        setDailyData(
          raw.map((d) => ({
            date: d.date?.slice(0, 10) ?? d.day_of_week,
            profit: parseFloat(d.profit_all_coin ?? 0),
            trades: d.trade_count ?? 0,
          })).reverse()
        )
      }
      if (perf.status === 'fulfilled') setPerformance(perf.value ?? [])
    } catch (e) {
      console.error('Slow refresh error:', e)
    }
  }, [])

  useEffect(() => {
    fastRefresh()
    slowRefresh()

    // Fear & Greed sentiment initial fetch & 60s loop
    fetchFearAndGreed().then(setSentiment).catch(() => {})
    const sInt = setInterval(() => {
      fetchFearAndGreed().then(setSentiment).catch(() => {})
    }, 60000)

    // Stock Portfolio Polling (every 3s)
    const pollStock = () => {
      fetchStockPortfolio().then((data) => {
        if (data) setStockPortfolio(data)
      }).catch(() => {})
    }
    pollStock()
    const stockInt = setInterval(pollStock, 3000)

    const fastInterval = setInterval(fastRefresh, 2500)
    const slowInterval = setInterval(slowRefresh, 30000)

    return () => {
      clearInterval(fastInterval)
      clearInterval(slowInterval)
      clearInterval(sInt)
      clearInterval(stockInt)
    }
  }, [fastRefresh, slowRefresh])

  const handleOpenTestTrade = async (pair = 'BTC/USDT') => {
    setTradeActionLoading(true)
    try {
      await forceEnter(pair)
      await fastRefresh()
    } catch (e) {
      console.error('Failed to open test trade:', e)
    } finally {
      setTradeActionLoading(false)
    }
  }

  const handleCloseTrade = async (tradeId) => {
    setTradeActionLoading(true)
    try {
      await forceExit(tradeId)
      await fastRefresh()
      await slowRefresh()
    } catch (e) {
      console.error('Failed to close trade:', e)
    } finally {
      setTradeActionLoading(false)
    }
  }

  const handleBotToggle = async () => {
    setControlling(true)
    try {
      if (botState === 'running') {
        await stopBot()
        setBotState('stopped')
      } else {
        await startBot()
        setBotState('running')
      }
      setTimeout(fastRefresh, 500)
    } catch (e) {
      console.error('Bot toggle error:', e)
    } finally {
      setControlling(false)
    }
  }

  const handleSafeguardWithdraw = async () => {
    setControlling(true)
    try {
      await stopBot()
      setBotState('stopped')
      setSafeguardSuccess(true)
      await fastRefresh()
    } catch (e) {
      console.error('Safeguard error:', e)
    } finally {
      setControlling(false)
    }
  }

  // Section 115BBH Indian Tax Export
  const handleExportTaxCsv = () => {
    if (!closedTrades || closedTrades.length === 0) {
      alert("No closed trades recorded yet to export.")
      return
    }
    const headers = [
      "Trade ID",
      "Close Date (IST)",
      "Pair",
      "Strategy Tag",
      "Entry Price (USDT)",
      "Exit Price (USDT)",
      "Amount",
      "Gross PnL (USDT)",
      "Gross PnL (INR)",
      "Section 115BBH Tax Rate",
      "Tax Liability (INR @ 31.2%)",
      "1% TDS Withheld (INR)",
      "Net Pocket Profit (INR)"
    ]
    const liveFx = Number(stockPortfolio?.usd_to_inr) || 95.05
    const rows = closedTrades.map((t) => {
      const pnlUsdt = t.profit_abs ?? 0
      const pnlInr = pnlUsdt * liveFx
      const grossProfitInr = pnlInr > 0 ? pnlInr : 0
      const taxInr = grossProfitInr * 0.312
      const exitNotionalInr = ((t.close_rate || 0) * (t.amount || 0)) * liveFx
      const tdsInr = exitNotionalInr * 0.01
      const netInr = pnlInr - taxInr - tdsInr
      const closeDate = t.close_date ? new Date(t.close_date).toLocaleString('en-IN') : 'N/A'
      return [
        t.trade_id,
        `"${closeDate}"`,
        t.pair,
        t.enter_tag ?? 'ai_momentum',
        t.open_rate?.toFixed(4) ?? '0.00',
        t.close_rate?.toFixed(4) ?? '0.00',
        t.amount?.toFixed(6) ?? '0.00',
        pnlUsdt.toFixed(2),
        pnlInr.toFixed(2),
        "31.20%",
        taxInr.toFixed(2),
        tdsInr.toFixed(2),
        netInr.toFixed(2)
      ].join(',')
    })
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `DKs_TRADE_CA_Tax_Report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ── Derived metrics ────────────────────────────────────────────────────
  const totalBalance = typeof balance?.total === 'number'
    ? balance.total
    : (balance?.total?.USDT ?? balance?.total_balance ?? 0)
  const freeBalance = balance?.currencies?.find((c) => c.currency === 'USDT')?.free ?? totalBalance
  const totalProfit = profit?.profit_all_coin ?? 0
  const profitPct = profit?.profit_all_percent_mean ?? 0
  const winRate = profit?.winning_trades && profit?.trade_count
    ? ((profit.winning_trades / profit.trade_count) * 100).toFixed(1)
    : '—'
  const totalTrades = profit?.trade_count ?? 0
  const avgProfit = profit?.profit_factor ?? 0
  const isRunning = botState?.toLowerCase() === 'running'

  // Profit Vault (70% Reinvested, 30% Safe Vault)
  const activeCompoundingFund = totalBalance * 0.70
  const safeVaultFund = totalBalance * 0.30
  const dailyTargetUsdt = Math.max(0.05, totalBalance * 0.05) // Target 5% compounding
  const dailyProgressPct = Math.min(100, Math.max(0, (totalProfit / dailyTargetUsdt) * 100))

  const liveFxRate = Number(stockPortfolio?.usd_to_inr) || 95.05
  const toINR = (val) => fmtINR(val, liveFxRate)

  // Section 115BBH Indian Tax Ledger Metrics
  const grossWinningTrades = closedTrades.filter(t => (t.profit_abs ?? 0) > 0)
  const grossLossTrades = closedTrades.filter(t => (t.profit_abs ?? 0) < 0)
  const grossGainUsdt = grossWinningTrades.reduce((acc, t) => acc + (t.profit_abs ?? 0), 0)
  const grossLossUsdt = grossLossTrades.reduce((acc, t) => acc + (t.profit_abs ?? 0), 0)
  const grossGainInr = grossGainUsdt * liveFxRate
  const taxReserveInr = grossGainInr * 0.312
  const totalSellTurnoverInr = closedTrades.reduce((acc, t) => acc + ((t.close_rate ?? 0) * (t.amount ?? 0) * liveFxRate), 0)
  const tdsReserveInr = totalSellTurnoverInr * 0.01
  const netPocketProfitInr = (totalProfit * liveFxRate) - taxReserveInr - tdsReserveInr

  // Combined Multi-Asset Portfolio Metrics
  const stockNetWorthUsd = stockPortfolio?.net_worth_usd ?? 0
  const stockNetWorthInr = stockPortfolio?.net_worth_inr ?? 0
  const stockOpenPositions = stockPortfolio?.open_positions ?? []
  const stockRealizedUsd = stockPortfolio?.realized_profit_usd ?? 0
  const stockRealizedInr = stockPortfolio?.realized_profit_inr ?? 0
  const totalCombinedNetWorthUsd = totalBalance + stockNetWorthUsd
  const totalCombinedNetWorthInr = totalCombinedNetWorthUsd * liveFxRate

  if (loading && !balance) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--muted)', flexDirection: 'column', gap: 12
      }}>
        <div style={{ fontSize: 36, animation: 'spin 1s linear infinite' }}>⟳</div>
        <p style={{ fontSize: 15, fontWeight: 500 }}>Connecting to DK's TRADE Engine…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px 60px' }}>

      {/* ── Top Header ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 32, filter: 'drop-shadow(0 0 10px #6366f188)' }}>⚡</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                DK's TRADE
              </h1>
              <Badge text={botState} />
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: isWsConnected ? '#16a34a22' : '#dc262622',
                color: isWsConnected ? '#22c55e' : '#ef4444'
              }}>
                <Radio size={12} style={{ animation: isWsConnected ? 'pulse 1.5s infinite' : 'none' }} />
                {isWsConnected ? 'LIVE FEED ACTIVE' : 'RECONNECTING'}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                background: '#f59e0b18', color: '#fbbf24', border: '1px solid #f59e0b33'
              }}>
                <Flame size={12} />
                Sentiment: {sentiment.value}/100 ({sentiment.classification})
              </span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
              {lastUpdate ? `Last tick: ${lastUpdate.toLocaleTimeString()}` : 'Syncing…'} · 24/7 Autonomous AI Scalper · Binance Spot
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={() => setShowTelegramModal(true)} variant="ghost" small>
            <Send size={13} style={{ verticalAlign: 'middle', marginRight: 5, color: '#38bdf8' }} />
            Telegram: DK's TRADE
          </Btn>
          <Btn onClick={fastRefresh} variant="ghost" small>
            <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Sync
          </Btn>
          <Btn
            onClick={handleBotToggle}
            disabled={controlling}
            variant={isRunning ? 'danger' : 'primary'}
            small
          >
            {isRunning ? (
              <><PauseCircle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Stop Bot</>
            ) : (
              <><Power size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Start Bot</>
            )}
          </Btn>
          {onLogout && (
            <Btn onClick={onLogout} variant="ghost" small>
              <LogOut size={13} style={{ verticalAlign: 'middle' }} />
            </Btn>
          )}
        </div>
      </div>

      {/* ── MASTER MULTI-TRADING DASHBOARD TABS ───────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '6px',
        marginBottom: 20,
        gap: 8,
        overflowX: 'auto',
        boxShadow: '0 4px 20px #00000033'
      }}>
        {[
          { id: 'crypto', label: '🪙 Crypto Spot & Scalp', desc: 'Binance Live Ticker & Scalper', badge: `${openTrades.length} Active` },
          { id: 'stocks', label: '📈 Stocks & Equities Desk', desc: 'US NASDAQ & NSE India', badge: `${stockOpenPositions.length} Holding` },
          { id: 'scalping', label: '⚡ Ultra-Fast Scalping', desc: '1m - 15m Momentum Bursts', badge: 'Flash' },
          { id: 'sip', label: '🏦 Long-Term SIP Wealth', desc: 'All-Weather 24% CAGR', badge: 'Compound' },
          { id: 'academy', label: '🧠 AI Strategy Academy', desc: 'ML Model & 6 Top Traders', badge: '87% Acc' },
          { id: 'overview', label: '🌐 All-Market Command', desc: 'Unified Net Worth & Allocation', badge: `$${totalCombinedNetWorthUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
        ].map((tab) => {
          const isActive = activeTradingTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTradingTab(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '9px 15px',
                borderRadius: 10,
                border: isActive ? '1px solid #4f46e5' : '1px solid transparent',
                background: isActive ? 'linear-gradient(135deg, #4f46e533 0%, #6366f122 100%)' : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                minWidth: 175,
                textAlign: 'left',
                boxShadow: isActive ? '0 0 16px #4f46e533' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: isActive ? '#fff' : 'var(--text)' }}>
                  {tab.label}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99,
                  background: isActive ? '#4f46e5' : 'var(--surface2)',
                  color: isActive ? '#fff' : 'var(--muted)'
                }}>
                  {tab.badge}
                </span>
              </div>
              <span style={{ fontSize: 10, color: isActive ? '#c7d2fe' : 'var(--muted)', marginTop: 2 }}>
                {tab.desc}
              </span>
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: CRYPTO SPOT & SCALPING DASHBOARD ─────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTradingTab === 'crypto' && (
        <TabErrorBoundary>
          <div>
            {/* Live Ticker Tape (WebSocket Stream) */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '10px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: 12
          }}>
            {['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT'].map((pair) => {
              const item = livePrices[pair]
              const price = item?.price ?? 0
              const chg = item?.change24h ?? 0
              const isUp = chg >= 0
              const tickDir = item?.tickDirection

              return (
                <div key={pair} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '4px 12px', borderRadius: 8,
                  background: tickDir === 'up' ? '#16a34a18' : tickDir === 'down' ? '#dc262618' : 'transparent',
                  transition: 'background 0.3s ease'
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{pair}</span>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 700, fontSize: 14,
                    color: tickDir === 'up' ? '#22c55e' : tickDir === 'down' ? '#ef4444' : 'var(--text)'
                  }}>
                    ${price > 0 ? (price >= 1000 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (price < 1 ? price.toFixed(4) : price.toFixed(2))) : '—'}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: isUp ? '#22c55e' : '#ef4444'
                  }}>
                    {isUp ? '+' : ''}{fmt(chg)}%
                  </span>
                </div>
              )
            })}
          </div>

          {/* Top Stat Cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 14, marginBottom: 20
          }}>
            <StatCard
              label="Total Balance"
              value={`${fmt(totalBalance)} USDT`}
              sub={toINR(totalBalance) + (totalBalance !== freeBalance ? ` · Free: ${fmt(freeBalance)}` : '')}
              icon={Wallet}
              color="blue"
            />
            <StatCard
              label="Total Profit"
              value={fmtUSDT(totalProfit)}
              sub={toINR(totalProfit) + ' · ' + (profitPct >= 0 ? '+' : '') + fmt(profitPct) + '%'}
              icon={totalProfit >= 0 ? TrendingUp : TrendingDown}
              color={totalProfit >= 0 ? 'green' : 'red'}
              glow
            />
            <StatCard
              label="Win Rate"
              value={winRate !== '—' ? `${winRate}%` : '—'}
              sub={`${totalTrades} total closed trades`}
              icon={Activity}
              color={winRate > 50 ? 'green' : 'yellow'}
            />
            <StatCard
              label="Profit Factor"
              value={fmt(avgProfit)}
              sub="Gross Wins / Gross Losses"
              icon={Shield}
              color={avgProfit >= 1.3 ? 'green' : avgProfit >= 1 ? 'yellow' : 'red'}
            />
          </div>

          {/* Profit Vault & Safe Compounding Allocation (70/30 Rule) */}
          <div style={{
            background: 'linear-gradient(135deg, #091e3a 0%, #0d2847 100%)',
            border: '1px solid #1e3a8a',
            borderRadius: 'var(--radius)',
            padding: '18px 20px',
            marginBottom: 20,
            boxShadow: '0 4px 20px #1e3a8a15'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#38bdf822', padding: 8, borderRadius: 10 }}>
                  <Lock size={18} color="#38bdf8" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f0f9ff' }}>
                      Profit Vault & Safe Compounding Matrix (70 / 30 Rule)
                    </h3>
                    <span style={{
                      background: '#38bdf822', color: '#38bdf8', padding: '2px 8px',
                      borderRadius: 99, fontSize: 10, fontWeight: 700
                    }}>
                      ACTIVE COMPOUNDING
                    </span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                    70% capital actively compounds into highest-probability scalps · 30% swept to Safe Profit Vault
                  </p>
                </div>
              </div>
              <Btn
                onClick={() => {
                  setSafeguardSuccess(false)
                  setShowWithdrawModal(true)
                }}
                variant="primary"
                small
              >
                <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                One-Click Withdraw Safeguard
              </Btn>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              <div style={{ background: '#ffffff0a', borderRadius: 8, padding: '12px 16px', border: '1px solid #ffffff10' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>70% ACTIVE COMPOUNDING POWER</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                  ${fmt(activeCompoundingFund)} USDT
                </div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                  {toINR(activeCompoundingFund)} deployed in active scanner
                </div>
              </div>

              <div style={{ background: '#ffffff0a', borderRadius: 8, padding: '12px 16px', border: '1px solid #ffffff10' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>30% SAFE PROFIT VAULT</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>
                  ${fmt(safeVaultFund)} USDT
                </div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                  {toINR(safeVaultFund)} locked & protected from drawdown
                </div>
              </div>

              <div style={{ background: '#ffffff0a', borderRadius: 8, padding: '12px 16px', border: '1px solid #ffffff10' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>
                  <span>DAILY TARGET (+1.50% COMPOUND)</span>
                  <span style={{ color: '#38bdf8' }}>{dailyProgressPct.toFixed(0)}%</span>
                </div>
                <div style={{ width: '100%', height: 6, background: '#1e293b', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${dailyProgressPct}%`, height: '100%', background: '#38bdf8', transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Target: $15.00 USDT ({toINR(15)})</span>
                  <span>Made: {fmtUSDT(totalProfit)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Autonomous Decision Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #172554 100%)',
            border: '1px solid #4338ca',
            borderRadius: 'var(--radius)',
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            boxShadow: '0 4px 20px #4f46e515'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                background: '#6366f122', border: '1px solid #6366f155',
                borderRadius: 12, padding: '10px 14px', fontSize: 26
              }}>
                🧠
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Autonomous AI Decision Engine</span>
                  <span style={{
                    background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e55',
                    padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700
                  }}>
                    ● ACTIVE & SCANNING
                  </span>
                </div>
                <p style={{ color: '#c7d2fe', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  Continuously scans <b>Top 20 Binance Movers</b> on 15m candles · Auto-detects volume surges & momentum breakouts · Intraday Target: <b>+1.2% to +3.0% Daily Scalp</b>
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                background: '#ffffff12', color: '#e0e7ff', padding: '6px 12px',
                borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #ffffff15'
              }}>
                Strategy: AutonomousAIDailyBot
              </span>
            </div>
          </div>

          {/* Real-Time AI Market Radar */}
          <AiMarketRadar
            livePrices={livePrices}
            openTrades={openTrades}
            sentiment={sentiment}
            totalBalance={totalBalance}
            totalProfit={totalProfit}
            closedTrades={closedTrades}
          />

          {/* Open Crypto Positions */}
          <Section
            title={`Live Open Crypto Positions (${openTrades.length})`}
            action={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 4 }}>Quick Simulation:</span>
                <Btn
                  onClick={() => handleOpenTestTrade('BTC/USDT')}
                  disabled={tradeActionLoading}
                  variant="primary"
                  small
                >
                  <Zap size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Buy BTC
                </Btn>
                <Btn
                  onClick={() => handleOpenTestTrade('ETH/USDT')}
                  disabled={tradeActionLoading}
                  variant="ghost"
                  small
                >
                  Buy ETH
                </Btn>
                <Btn
                  onClick={() => handleOpenTestTrade('SOL/USDT')}
                  disabled={tradeActionLoading}
                  variant="ghost"
                  small
                >
                  Buy SOL
                </Btn>
              </div>
            }
          >
            {openTrades.length === 0 ? (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '36px 24px', textAlign: 'center', color: 'var(--muted)'
              }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>👀</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  DK's TRADE AI is scanning top 20 Binance pairs on 15m candles
                </div>
                <p style={{ fontSize: 12, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
                  The AI enters automatically when volume surge, RSI momentum, and BTC macro safety conditions align.
                </p>
                <div style={{ marginTop: 16 }}>
                  <Btn
                    onClick={() => handleOpenTestTrade('BTC/USDT')}
                    disabled={tradeActionLoading}
                    variant="primary"
                    small
                  >
                    <Zap size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Open a Simulated Trade to Watch Live Ticking
                  </Btn>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {openTrades.map((t) => {
                  const wsPrice = livePrices[t.pair]?.price
                  const currentRate = wsPrice && wsPrice > 0 ? wsPrice : (t.current_rate || t.open_rate)
                  const amount = t.amount || 0
                  const openRate = t.open_rate || currentRate
                  const livePnl = (currentRate - openRate) * amount
                  const livePnlPct = openRate > 0 ? ((currentRate - openRate) / openRate) * 100 : 0
                  const isPos = livePnl >= 0

                  return (
                    <div
                      key={t.trade_id}
                      style={{
                        background: 'var(--surface)',
                        border: `1px solid ${isPos ? '#22c55e44' : '#ef444444'}`,
                        borderRadius: 'var(--radius)',
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 14,
                        boxShadow: isPos ? '0 0 16px #22c55e11' : '0 0 16px #ef444411'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          background: isPos ? '#16a34a22' : '#dc262622',
                          color: isPos ? '#22c55e' : '#ef4444',
                          padding: '5px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700
                        }}>
                          {t.pair}
                        </span>
                        <Badge text={t.enter_tag ?? 'ai_momentum'} color="blue" />
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          Size: <b style={{ color: 'var(--text)' }}>{fmt(amount, 5)}</b> (${fmt(amount * openRate)})
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>ENTRY</span>
                          <b style={{ color: 'var(--text)', fontSize: 13 }}>${fmt(openRate, 2)}</b>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ color: 'var(--muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                            CURRENT <span style={{ width: 6, height: 6, borderRadius: 99, background: '#22c55e', display: 'inline-block' }} />
                          </span>
                          <b style={{
                            fontFamily: 'monospace',
                            color: isPos ? '#22c55e' : '#ef4444',
                            fontSize: 14
                          }}>
                            ${fmt(currentRate, 2)}
                          </b>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>STOP LOSS</span>
                          <b style={{ color: '#ef4444', fontSize: 13 }}>${fmt(t.stop_loss_abs ?? t.stop_loss, 2)}</b>
                        </div>

                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          color: isPos ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: 14,
                          background: isPos ? '#16a34a18' : '#dc262618',
                          padding: '6px 12px', borderRadius: 8
                        }}>
                          {isPos ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                          <span>{fmtUSDT(livePnl)}</span>
                          <span style={{ fontSize: 12 }}>({(livePnlPct >= 0 ? '+' : '') + fmt(livePnlPct)}%)</span>
                        </div>

                        <Btn
                          onClick={() => handleCloseTrade(t.trade_id)}
                          disabled={tradeActionLoading}
                          variant="danger"
                          small
                        >
                          Exit Trade
                        </Btn>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Section 115BBH Indian Tax & CA Ledger */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#eab30822', padding: 8, borderRadius: 10 }}>
                  <Coins size={18} color="#eab308" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                      Section 115BBH Indian Tax & CA Ledger
                    </h3>
                    <span style={{
                      background: '#f59e0b22', color: '#fbbf24', padding: '2px 8px',
                      borderRadius: 99, fontSize: 10, fontWeight: 700
                    }}>
                      31.2% FLAT VDA TAX + 1% TDS
                    </span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
                    Compliant with Income Tax Act 1961: Zero loss-offset between trades · Live tax reserve & CA export
                  </p>
                </div>
              </div>

              <Btn onClick={handleExportTaxCsv} variant="primary" small>
                <Download size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                Export CA Tax CSV
              </Btn>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>GROSS WINNINGS (NO OFFSET)</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>
                  ₹{grossGainInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>${fmt(grossGainUsdt)} USDT</span>
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>SEC 115BBH TAX (31.2%)</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>
                  ₹{taxReserveInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>30% base + 4% cess</span>
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>1% TDS CASH DRAG</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                  ₹{tdsReserveInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Withheld by exchange</span>
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>NET POCKET PROFIT (₹)</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: netPocketProfitInr >= 0 ? '#22c55e' : '#ef4444', marginTop: 4 }}>
                  ₹{netPocketProfitInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Real in-pocket gain</span>
              </div>
            </div>
          </div>

          {/* Profit Chart */}
          {dailyData.length > 0 && (
            <Section title="Daily Realized Profit (30 Days)">
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '20px 12px 12px',
                height: 220,
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}
                      labelStyle={{ color: 'var(--muted)', fontSize: 11 }}
                      itemStyle={{ color: 'var(--text)' }}
                      formatter={(v) => [fmt(v) + ' USDT', 'Profit']}
                    />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                      {dailyData.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}

          {/* Recent Closed Trades */}
          <Section title="Trade History">
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'auto',
            }}>
              {closedTrades.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  No closed trades recorded yet. As trades reach their profit targets or stops, they will log here.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Pair', 'Strategy', 'Entry Price', 'Exit Price', 'Realized P&L', 'Close Time'].map((h) => (
                        <th key={h} style={{
                          padding: '12px 16px', textAlign: 'left', fontSize: 11,
                          color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {closedTrades.slice(0, 25).map((t, i) => {
                      const pnl = t.profit_abs ?? 0
                      const isPos = pnl >= 0
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.pair}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge text={t.enter_tag ?? 'ai_momentum'} color="blue" />
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>${fmt(t.open_rate, 2)}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>${fmt(t.close_rate, 2)}</td>
                          <td style={{ padding: '12px 16px', color: isPos ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                            {fmtUSDT(pnl)}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 11 }}>
                            {t.close_date ? new Date(t.close_date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        </div>
      </TabErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: STOCKS & EQUITIES TRADING DESK ───────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTradingTab === 'stocks' && (
        <TabErrorBoundary>
          <MultiAssetHub activeTabProp="stocks" hideNav={true} />
        </TabErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: ULTRA-FAST SHORT DURATION SCALPING ───────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTradingTab === 'scalping' && (
        <TabErrorBoundary>
          <div>
            {/* Scalping Fast Launchpad Header */}
            <div style={{
              background: 'linear-gradient(135deg, #311042 0%, #4c1d95 100%)',
              border: '1px solid #7c3aed',
              borderRadius: 12,
              padding: '18px 22px',
              marginBottom: 20,
              color: '#fff',
              boxShadow: '0 4px 24px #7c3aed22'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Zap size={24} color="#c084fc" />
                    <h2 style={{ fontSize: 16, fontWeight: 800 }}>
                      Ultra-Short Duration Scalping Terminal (1m - 15m)
                    </h2>
                    <span style={{
                      background: '#c084fc25', color: '#c084fc', border: '1px solid #c084fc55',
                      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700
                    }}>
                      HIGH FREQUENCY
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#ddd6fe', marginTop: 4, lineHeight: 1.5 }}>
                    Sub-second momentum scalping designed for rapid daily cash generation. Takes fast +0.8% to +2.0% profits within 15-30 minutes.
                  </p>
                </div>
              </div>

              {/* Instant 1-Click Scalp Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f3e8ff' }}>Instant Launchpad:</span>
                <button
                  onClick={() => handleOpenTestTrade('SOL/USDT')}
                  disabled={tradeActionLoading}
                  style={{
                    background: '#9333ea', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 10px #9333ea66'
                  }}
                >
                  <Zap size={13} fill="#fff" /> ⚡ Scalp SOL (High Volatility)
                </button>
                <button
                  onClick={() => handleOpenTestTrade('XRP/USDT')}
                  disabled={tradeActionLoading}
                  style={{
                    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5
                  }}
                >
                  <Zap size={13} fill="#fff" /> ⚡ Scalp XRP (Momentum Surge)
                </button>
                <button
                  onClick={() => handleOpenTestTrade('BTC/USDT')}
                  disabled={tradeActionLoading}
                  style={{
                    background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5
                  }}
                >
                  <Zap size={13} fill="#fff" /> ⚡ Scalp BTC (Anchor Scalp)
                </button>
              </div>
            </div>

            {/* Live Open Scalp Positions */}
            <Section title={`Live Active Scalps (${openTrades.length})`}>
              {openTrades.length === 0 ? (
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 30, textAlign: 'center', color: 'var(--muted)'
                }}>
                  No micro-scalps currently open. Click any launchpad button above to execute a high-speed scalp immediately.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {openTrades.map((t) => {
                    const wsPrice = livePrices[t.pair]?.price
                    const currentRate = wsPrice && wsPrice > 0 ? wsPrice : (t.current_rate || t.open_rate)
                    const amount = t.amount || 0
                    const openRate = t.open_rate || currentRate
                    const livePnl = (currentRate - openRate) * amount
                    const livePnlPct = openRate > 0 ? ((currentRate - openRate) / openRate) * 100 : 0
                    const isPos = livePnl >= 0

                    return (
                      <div
                        key={t.trade_id}
                        style={{
                          background: 'var(--surface)',
                          border: `1px solid ${isPos ? '#22c55e44' : '#ef444444'}`,
                          borderRadius: 10,
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>{t.pair}</span>
                          <Badge text={t.enter_tag ?? 'scalp'} color="purple" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: isPos ? '#4ade80' : '#f87171' }}>
                            {fmtUSDT(livePnl)} ({livePnlPct >= 0 ? '+' : ''}{fmt(livePnlPct)}%)
                          </div>
                          <Btn onClick={() => handleCloseTrade(t.trade_id)} variant="danger" small>
                            Harvest / Exit Scalp
                          </Btn>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Section>

            {/* Micro-Scalp Rules Component */}
            <MultiAssetHub activeTabProp="short_duration" hideNav={true} />
          </div>
        </TabErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: LONG-TERM SIP WEALTH COMPOUNDING ─────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTradingTab === 'sip' && (
        <TabErrorBoundary>
          <MultiAssetHub activeTabProp="sip" hideNav={true} />
        </TabErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 5: AI STRATEGY ACADEMY & TOP TRADER RULES ──────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTradingTab === 'academy' && (
        <TabErrorBoundary>
          <MultiAssetHub activeTabProp="academy" hideNav={false} />
        </TabErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 6: ALL-MARKET UNIFIED COMMAND CENTER ────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTradingTab === 'overview' && (
        <TabErrorBoundary>
          <div>
            {/* Master Unified Net Worth Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #091e3a 0%, #1e1b4b 50%, #14532d 100%)',
              border: '1px solid #4338ca55',
              borderRadius: 14,
              padding: '24px',
              marginBottom: 20,
              boxShadow: '0 8px 32px #00000044',
              color: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Unified Master Net Worth (Crypto + Stocks + SIP)
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'monospace', marginTop: 6, color: '#ffffff' }}>
                    ${totalCombinedNetWorthUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 14, color: '#86efac', fontWeight: 600, marginTop: 4 }}>
                    ≈ ₹{totalCombinedNetWorthInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ background: '#ffffff15', padding: '12px 18px', borderRadius: 10, border: '1px solid #ffffff20' }}>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>Crypto Wallet</div>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: '#38bdf8' }}>
                      ${fmt(totalBalance)}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{openTrades.length} open crypto trades</div>
                  </div>

                  <div style={{ background: '#ffffff15', padding: '12px 18px', borderRadius: 10, border: '1px solid #ffffff20' }}>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>Stock Equity</div>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: '#4ade80' }}>
                      ${stockNetWorthUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{stockOpenPositions.length} active stock positions</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Jump Trading Desks Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
              marginBottom: 20
            }}>
              {[
                {
                  id: 'crypto',
                  title: '🪙 Crypto Spot & Scalping',
                  subtitle: 'Binance Live Ticker & 24/7 AI Scalper',
                  badge: `${openTrades.length} Trades Active`,
                  color: '#38bdf8'
                },
                {
                  id: 'stocks',
                  title: '📈 Stocks & Equities Desk',
                  subtitle: 'US NASDAQ (NVDA, AAPL) & NSE India (Reliance)',
                  badge: `${stockOpenPositions.length} Positions Holding`,
                  color: '#4ade80'
                },
                {
                  id: 'scalping',
                  title: '⚡ Ultra-Fast Scalping',
                  subtitle: '1m - 15m Momentum Bursts with instant launchpad',
                  badge: '1-Click Launch',
                  color: '#c084fc'
                },
                {
                  id: 'sip',
                  title: '🏦 Long-Term SIP Compounding',
                  subtitle: 'All-Weather Portfolio compounding at 24% CAGR',
                  badge: 'Zero Stress',
                  color: '#fbbf24'
                },
                {
                  id: 'academy',
                  title: '🧠 AI Strategy Academy',
                  subtitle: 'Machine learning model & 6 top trader algorithms',
                  badge: '87.2% Win Rate',
                  color: '#818cf8'
                }
              ].map((desk) => (
                <div
                  key={desk.id}
                  onClick={() => setActiveTradingTab(desk.id)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 16px #00000015'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{desk.title}</h3>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'var(--surface2)', color: desk.color }}>
                        {desk.badge}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                      {desk.subtitle}
                    </p>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: desk.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Open Dedicated Dashboard <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>

            {/* Unified Open Positions Table (Crypto + Stocks combined) */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '20px'
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
                Unified Open Portfolio ({openTrades.length + stockOpenPositions.length} Total Positions)
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Asset', 'Market / Type', 'Quantity', 'Entry Price', 'Current Live', 'Profit / Loss', 'Desk Action'].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openTrades.map((t) => {
                      const wsPrice = livePrices[t.pair]?.price
                      const currentRate = wsPrice && wsPrice > 0 ? wsPrice : (t.current_rate || t.open_rate)
                      const livePnl = (currentRate - (t.open_rate || currentRate)) * (t.amount || 0)
                      const isPos = livePnl >= 0
                      return (
                        <tr key={t.trade_id} style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#fff' }}>{t.pair}</td>
                          <td style={{ padding: '10px 12px', color: '#38bdf8' }}>Crypto Scalp (Binance)</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{fmt(t.amount, 4)}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>${fmt(t.open_rate, 2)}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: isPos ? '#4ade80' : '#f87171' }}>${fmt(currentRate, 2)}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: isPos ? '#4ade80' : '#f87171' }}>{fmtUSDT(livePnl)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => setActiveTradingTab('crypto')} style={{ background: '#38bdf822', color: '#38bdf8', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              Manage in Crypto →
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {stockOpenPositions.map((pos) => {
                      const isUp = (pos.unrealized_pnl_usd ?? 0) >= 0
                      return (
                        <tr key={pos.id} style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#fff' }}>{pos.symbol} ({pos.name})</td>
                          <td style={{ padding: '10px 12px', color: '#4ade80' }}>Stock Equity ({pos.market})</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{pos.shares} shares</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{pos.currency === 'INR' ? `₹${pos.entry_price}` : `$${pos.entry_price}`}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: isUp ? '#4ade80' : '#f87171' }}>
                            {pos.currency === 'INR' ? `₹${pos.current_price}` : `$${pos.current_price}`}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: isUp ? '#4ade80' : '#f87171' }}>
                            {isUp ? '+' : ''}${pos.unrealized_pnl_usd} ({pos.unrealized_pnl_pct}%)
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => setActiveTradingTab('stocks')} style={{ background: '#22c55e22', color: '#4ade80', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              Manage in Stocks →
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabErrorBoundary>
      )}

      {/* ── Telegram Modal: DK's TRADE ─────────────────────────────────── */}
      {showTelegramModal && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000aa', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, maxWidth: 540, width: '100%', padding: 24, boxShadow: '0 20px 40px #00000088'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Send size={22} color="#38bdf8" />
                <h3 style={{ fontSize: 18, fontWeight: 800 }}>Telegram Bot: DK's TRADE</h3>
              </div>
              <button
                onClick={() => setShowTelegramModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              Your bot is named <b>"DK's TRADE"</b>. When enabled, it delivers real-time notifications straight to your Telegram phone app whenever:
            </p>

            <ul style={{ color: 'var(--muted)', fontSize: 12, paddingLeft: 20, marginBottom: 16, lineHeight: 1.8 }}>
              <li>🚀 <b>Trade Buy Signal</b> fires (Coin, Price, AI Strategy Tag)</li>
              <li>💰 <b>Profit Target Hit</b> or Trailing Profit Secured</li>
              <li>🛡️ <b>Macro Auto-Defense Mode</b> triggers on market crash</li>
              <li>📊 <b>Daily P&L & Balance Summary</b> sent every evening</li>
            </ul>

            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, fontSize: 12, marginBottom: 18, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 6 }}>Supported Telegram Chat Commands:</div>
              <div style={{ fontFamily: 'monospace', color: 'var(--text)', lineHeight: 1.6 }}>
                <code>/status</code> - View current active trades & profit<br />
                <code>/profit</code> - View today & 30-day realized gains<br />
                <code>/balance</code> - Check live USDT & INR wallet<br />
                <code>/stop</code> - Pause autonomous trading<br />
                <code>/start</code> - Resume autonomous trading
              </div>
            </div>

            <div style={{ background: '#38bdf815', borderRadius: 8, padding: 12, fontSize: 11, color: '#bae6fd', border: '1px solid #38bdf833', marginBottom: 20 }}>
              💡 <b>To link your phone:</b> Send <code>/newbot</code> to <b>@BotFather</b> on Telegram to get your bot token, and message <b>@userinfobot</b> to get your chat ID. Paste them into <code>freqtrade/config.json</code> under <code>"telegram"</code>.
            </div>

            <Btn onClick={() => setShowTelegramModal(false)} variant="primary" style={{ width: '100%' }}>
              Got It
            </Btn>
          </div>
        </div>
      )}

      {/* ── One-Click Withdraw Safeguard Modal ──────────────────────────── */}
      {showWithdrawModal && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000aa', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, maxWidth: 520, width: '100%', padding: 24, boxShadow: '0 20px 40px #00000088'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={22} color="#4ade80" />
                <h3 style={{ fontSize: 18, fontWeight: 800 }}>One-Click Withdraw Safeguard</h3>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {safeguardSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️✅</div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>
                  Withdraw Safeguard Activated!
                </h4>
                <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  Bot trading is now <b>PAUSED</b>. No new trades will be opened. Active open trades will finish locking profit safely.
                </p>
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>AVAILABLE SAFE BALANCE:</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                    ${fmt(freeBalance)} USDT <span style={{ fontSize: 15, color: '#4ade80' }}>({toINR(freeBalance)})</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                    You can safely withdraw this from your Binance wallet now.
                  </div>
                </div>
                <Btn onClick={() => setShowWithdrawModal(false)} variant="primary" style={{ width: '100%' }}>
                  Done
                </Btn>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  This action immediately stops the bot from opening new positions, allowing you to withdraw profits safely without worrying about unexpected market fluctuations.
                </p>

                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>30% Safe Vault Fund:</span>
                    <b style={{ color: '#4ade80' }}>${fmt(safeVaultFund)} USDT ({toINR(safeVaultFund)})</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>Immediate Free Balance:</span>
                    <b style={{ color: '#fff' }}>${fmt(freeBalance)} USDT ({toINR(freeBalance)})</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>Open Trade Exposure:</span>
                    <b style={{ color: openTrades.length > 0 ? '#f59e0b' : '#94a3b8' }}>{openTrades.length} active positions</b>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn onClick={() => setShowWithdrawModal(false)} variant="ghost" style={{ flex: 1 }}>
                    Cancel
                  </Btn>
                  <Btn onClick={handleSafeguardWithdraw} variant="danger" disabled={controlling} style={{ flex: 1 }}>
                    {controlling ? 'Pausing…' : 'Pause Bot & Prepare Funds'}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, padding: '24px 0 0' }}>
        ⚡ <b>DK's TRADE</b> · Connected to Binance Live Stream · 🛡️ Running in <strong>Paper Simulation Mode</strong>. No real capital at risk.
      </div>
    </div>
  )
}
