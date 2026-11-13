import { useState, useEffect, useRef } from 'react'

const DEFAULT_STREAMS = [
  'btcusdt@ticker',
  'ethusdt@ticker',
  'solusdt@ticker',
  'xrpusdt@ticker',
  'dogeusdt@ticker',
  'suiusdt@ticker',
  'nearusdt@ticker',
  'linkusdt@ticker',
  'avaxusdt@ticker',
]

export function useBinanceTicker(extraPairs = []) {
  const [prices, setPrices] = useState({
    'BTC/USDT': { price: 0, change24h: 0, tickDirection: 'neutral' },
    'ETH/USDT': { price: 0, change24h: 0, tickDirection: 'neutral' },
    'SOL/USDT': { price: 0, change24h: 0, tickDirection: 'neutral' },
    'XRP/USDT': { price: 0, change24h: 0, tickDirection: 'neutral' },
  })
  const [isConnected, setIsConnected] = useState(false)
  const prevPrices = useRef({})
  const wsRef = useRef(null)

  useEffect(() => {
    let reconnectTimeout = null
    let isSubscribed = true

    // Build streams list
    const streamSet = new Set(DEFAULT_STREAMS)
    extraPairs.forEach((p) => {
      if (p && p.includes('/USDT')) {
        const stream = p.replace('/', '').toLowerCase() + '@ticker'
        streamSet.add(stream)
      }
    })
    const streamsQuery = Array.from(streamSet).join('/')

    function connect() {
      const url = `wss://stream.binance.com:9443/stream?streams=${streamsQuery}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (isSubscribed) setIsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          const d = payload?.data
          if (!d || !d.s) return

          // e.g. XRPUSDT -> XRP/USDT
          const pair = d.s.endsWith('USDT')
            ? `${d.s.slice(0, -4)}/USDT`
            : d.s

          const newPrice = parseFloat(d.c)
          const change24h = parseFloat(d.P)
          const oldPrice = prevPrices.current[pair] ?? newPrice

          let tickDirection = 'neutral'
          if (newPrice > oldPrice) tickDirection = 'up'
          else if (newPrice < oldPrice) tickDirection = 'down'

          prevPrices.current[pair] = newPrice

          setPrices((prev) => ({
            ...prev,
            [pair]: {
              price: newPrice,
              change24h,
              tickDirection,
            },
          }))
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        if (isSubscribed) {
          setIsConnected(false)
          reconnectTimeout = setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      isSubscribed = false
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (wsRef.current) wsRef.current.close()
    }
  }, [extraPairs.join(',')])

  return { prices, isConnected }
}
