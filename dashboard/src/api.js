import axios from 'axios'

const BASE = '/api'
const TOKEN_KEY = 'ft_jwt_token'

// Initialize token from localStorage if available
let token = localStorage.getItem(TOKEN_KEY)
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export function hasValidSession() {
  return !!localStorage.getItem(TOKEN_KEY)
}

export function logout() {
  token = null
  localStorage.removeItem(TOKEN_KEY)
  delete axios.defaults.headers.common['Authorization']
}

/** ── Auth ─────────────────────────────────────────────────────────────── */
export async function login(username = 'freqtrade', password = 'SuperTradingBot2026!') {
  const credentials = btoa(`${username}:${password}`)
  const { data } = await axios.post(
    `${BASE}/token/login`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  )
  token = data.access_token
  localStorage.setItem(TOKEN_KEY, token)
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  return token
}

// ── Silent Auto-Reauth Interceptor on 401 (Process restart / token expiry) ──
let isRefreshingAuth = false
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/token/login') &&
      !isRefreshingAuth
    ) {
      originalRequest._retry = true
      isRefreshingAuth = true
      try {
        const newToken = await login('freqtrade', 'SuperTradingBot2026!')
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
        isRefreshingAuth = false
        return axios(originalRequest)
      } catch (e) {
        isRefreshingAuth = false
        logout()
        return Promise.reject(e)
      }
    }
    return Promise.reject(error)
  }
)

/** ── Fast Bot Status & Balance ────────────────────────────────────────── */
export async function fetchStatus() {
  const { data } = await axios.get(`${BASE}/status`)
  return data
}

export async function fetchBalance() {
  const { data } = await axios.get(`${BASE}/balance`)
  return data
}

export async function fetchProfit() {
  const { data } = await axios.get(`${BASE}/profit`)
  return data
}

export async function fetchOpenTrades() {
  const { data } = await axios.get(`${BASE}/status`)
  return Array.isArray(data) ? data : []
}

export async function fetchBotState() {
  const { data } = await axios.get(`${BASE}/show_config`)
  return { state: data?.state ?? 'running' }
}

/** ── Slower Analytics & History ───────────────────────────────────────── */
export async function fetchDailyProfit(days = 30) {
  const { data } = await axios.get(`${BASE}/daily?days=${days}`)
  return data
}

export async function fetchClosedTrades(limit = 50) {
  const { data } = await axios.get(`${BASE}/trades?limit=${limit}`)
  return data?.trades ?? []
}

export async function fetchPerformance() {
  const { data } = await axios.get(`${BASE}/performance`)
  return data
}

export async function fetchStats() {
  const { data } = await axios.get(`${BASE}/stats`)
  return data
}

/** ── Bot Controls ─────────────────────────────────────────────────────── */
export async function startBot() {
  const { data } = await axios.post(`${BASE}/start`)
  return data
}

export async function stopBot() {
  const { data } = await axios.post(`${BASE}/stop`)
  return data
}

export async function forceEnter(pair = 'BTC/USDT', side = 'long') {
  const { data } = await axios.post(`${BASE}/forceenter`, { pair, side })
  return data
}

export async function forceExit(tradeId) {
  const { data } = await axios.post(`${BASE}/forceexit`, { tradeid: String(tradeId) })
  return data
}

/** ── AI Sentiment & Intelligence (Fear & Greed) ──────────────────────── */
export async function fetchFearAndGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!res.ok) throw new Error('Network error')
    const json = await res.json()
    const item = json?.data?.[0]
    return {
      value: parseInt(item?.value ?? '50', 10),
      classification: item?.value_classification ?? 'Neutral',
      timestamp: item?.timestamp,
    }
  } catch (e) {
    // Resilient fallback if external API is rate-limited
    return { value: 64, classification: 'Greed', timestamp: Date.now() }
  }
}

/** ── Stock Trading & Autonomous Brokerage API ─────────────────────────── */
const STOCK_BASE = '/stock-api'

export async function fetchStockFxRate() {
  try {
    const { data } = await axios.get(`${STOCK_BASE}/fx-rate`, { timeout: 3000 })
    return data
  } catch (err) {
    try {
      const { data } = await axios.get('http://127.0.0.1:8085/api/stock/fx-rate', { timeout: 3000 })
      return data
    } catch {
      return { usd_to_inr: 95.05 }
    }
  }
}

export async function fetchStockPortfolio() {
  try {
    const { data } = await axios.get(`${STOCK_BASE}/portfolio`, { timeout: 3000 })
    return data
  } catch (err) {
    // Fallback direct localhost if vite proxy isn't reloaded yet
    try {
      const { data } = await axios.get('http://127.0.0.1:8085/api/stock/portfolio', { timeout: 3000 })
      return data
    } catch {
      return null
    }
  }
}

export async function buyStock(symbol, shares = null, amount_usd = null, strategy = 'Manual Quick Execution') {
  try {
    const { data } = await axios.post(`${STOCK_BASE}/buy`, { symbol, shares, amount_usd, strategy }, { timeout: 4000 })
    return data
  } catch (err) {
    const { data } = await axios.post('http://127.0.0.1:8085/api/stock/buy', { symbol, shares, amount_usd, strategy }, { timeout: 4000 })
    return data
  }
}

export async function sellStock(position_id, reason = 'Manual Exit') {
  try {
    const { data } = await axios.post(`${STOCK_BASE}/sell`, { position_id, reason }, { timeout: 4000 })
    return data
  } catch (err) {
    const { data } = await axios.post('http://127.0.0.1:8085/api/stock/sell', { position_id, reason }, { timeout: 4000 })
    return data
  }
}

export async function toggleStockAutoTrade(enabled) {
  try {
    const { data } = await axios.post(`${STOCK_BASE}/toggle-autotrade`, { enabled }, { timeout: 4000 })
    return data
  } catch (err) {
    const { data } = await axios.post('http://127.0.0.1:8085/api/stock/toggle-autotrade', { enabled }, { timeout: 4000 })
    return data
  }
}

export async function triggerStockCycle() {
  try {
    const { data } = await axios.post(`${STOCK_BASE}/trigger-cycle`, {}, { timeout: 4000 })
    return data
  } catch (err) {
    const { data } = await axios.post('http://127.0.0.1:8085/api/stock/trigger-cycle', {}, { timeout: 4000 })
    return data
  }
}

export async function fetchStockCandles(symbol = 'NVDA', timeframe = '5m', count = 40) {
  try {
    const { data } = await axios.get(`${STOCK_BASE}/candles?symbol=${symbol}&timeframe=${timeframe}&count=${count}`, { timeout: 4000 })
    return data
  } catch (err) {
    const { data } = await axios.get(`http://127.0.0.1:8085/api/stock/candles?symbol=${symbol}&timeframe=${timeframe}&count=${count}`, { timeout: 4000 })
    return data
  }
}

export async function resetStockChallenge(deposit = 0.0) {
  try {
    const { data } = await axios.post(`${STOCK_BASE}/clear-all`, { deposit }, { timeout: 4000 })
    return data
  } catch (err) {
    const { data } = await axios.post('http://127.0.0.1:8085/api/stock/clear-all', { deposit }, { timeout: 4000 })
    return data
  }
}

export async function triggerDeepThinkingScan(preferredTechnique = null) {
  try {
    const { data } = await axios.post(`${STOCK_BASE}/deep-think-scan`, { preferred_technique: preferredTechnique }, { timeout: 5000 })
    return data
  } catch (err) {
    const { data } = await axios.post('http://127.0.0.1:8085/api/stock/deep-think-scan', { preferred_technique: preferredTechnique }, { timeout: 5000 })
    return data
  }
}

export async function analyzeCustomStock(symbol) {
  try {
    const { data } = await axios.post(`${STOCK_BASE}/analyze`, { symbol }, { timeout: 4000 })
    return data
  } catch (err) {
    const { data } = await axios.post('http://127.0.0.1:8085/api/stock/analyze', { symbol }, { timeout: 4000 })
    return data
  }
}

export async function fetchModelMetrics() {
  try {
    const { data } = await axios.get(`${STOCK_BASE}/metrics`, { timeout: 4000 })
    return data
  } catch (err) {
    const { data } = await axios.get('http://127.0.0.1:8085/api/stock/metrics', { timeout: 4000 })
    return data
  }
}

export async function triggerRetrainModel() {
  try {
    const { data } = await axios.post(`${STOCK_BASE}/retrain`, {}, { timeout: 60000 })
    return data
  } catch (err) {
    const { data } = await axios.post('http://127.0.0.1:8085/api/stock/retrain', {}, { timeout: 60000 })
    return data
  }
}



export async function updateGrowwToken(api_key, api_secret) {
  try {
    const { data } = await axios.post(`${STOCK_BASE}/update-token`, { api_key, api_secret }, { timeout: 8000 })
    return data
  } catch (err) {
    const { data } = await axios.post('http://127.0.0.1:8085/api/stock/update-token', { api_key, api_secret }, { timeout: 8000 })
    return data
  }
}
