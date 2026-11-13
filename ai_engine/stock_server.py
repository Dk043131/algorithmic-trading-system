"""
DK's TRADE - Universal Market Stock Trading & Deep Thinking Server
==================================================================
FastAPI REST API server running on port 8085.
Provides real-time endpoints for the React dashboard and runs background
autonomous Deep Thinking trading cycles for the $1,000 Challenge.
"""

import asyncio
import json
import logging
import os
import sys
import time
import socket

# Force IPv4 so Groww API requests always match the registered static IP
_orig_getaddrinfo = socket.getaddrinfo
def _force_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = _force_ipv4_getaddrinfo

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

try:
    from ai_engine.stock_trader import stock_engine, MARKET_UNIVERSE, get_live_usd_inr, compute_real_indicators
    from ai_engine.live_broker_adapter import live_broker
    from ai_engine.consensus_committee import investment_committee
    from ai_engine.skills.tradesync.tradesync_engine import tradesync
    from ai_engine.groww_fee_engine import GrowwFeeCalculator
except ImportError:
    from stock_trader import stock_engine, MARKET_UNIVERSE, get_live_usd_inr, compute_real_indicators
    from live_broker_adapter import live_broker
    from consensus_committee import investment_committee
    from skills.tradesync.tradesync_engine import tradesync
    from groww_fee_engine import GrowwFeeCalculator

logger = logging.getLogger("DKsStockServer")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="DK's TRADE Stock Deep Thinking Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BuyRequest(BaseModel):
    symbol: str
    shares: Optional[float] = None
    amount_usd: Optional[float] = None
    strategy: Optional[str] = "Deep Thinking Intraday Breakout"

class SellRequest(BaseModel):
    position_id: str
    reason: Optional[str] = "Manual Dashboard Exit"

class ToggleAutoRequest(BaseModel):
    enabled: bool

class ResetChallengeRequest(BaseModel):
    deposit: Optional[float] = 1000.0

class AnalyzeRequest(BaseModel):
    symbol: str
    preferred_technique: Optional[str] = None

class UpdateTokenRequest(BaseModel):
    api_key: str
    api_secret: Optional[str] = None


@app.post("/api/stock/update-token")
async def update_groww_token(req: UpdateTokenRequest):
    """Update Groww API token and reconnect live broker. Call this after getting new token from Groww."""
    import re
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    try:
        clean_key = req.api_key.strip()
        clean_secret = (req.api_secret or "").strip()
        with open(env_path, "r") as f:
            content = f.read()
        content = re.sub(r"^GROWW_API_KEY=.*$", f"GROWW_API_KEY={clean_key}", content, flags=re.MULTILINE)
        content = re.sub(r"^GROWW_API_SECRET=.*$", f"GROWW_API_SECRET={clean_secret}", content, flags=re.MULTILINE)
        with open(env_path, "w") as f:
            f.write(content)
        os.environ["GROWW_API_KEY"] = clean_key
        os.environ["GROWW_API_SECRET"] = clean_secret
        # Force reconnect with new credentials immediately
        live_broker._last_token_refresh = 0
        live_broker._last_init_attempt = 0
        live_broker._backoff_seconds = 0
        live_broker._cached_balance = None
        live_broker._last_balance_time = 0
        live_broker.groww_client = None
        live_broker._init_groww_client(force=True)
        bal = live_broker.get_live_balance()
        ucc = bal.get("ucc") or (live_broker.groww_profile.get("ucc") if live_broker.groww_profile else "N/A")
        return {
            "success": True,
            "connected": bal.get("connected"),
            "ucc": ucc,
            "clear_cash_inr": bal.get("clear_cash_inr", 0.0),
            "available_cash_inr": bal.get("available_cash_inr", 0.0),
            "message": f"Groww connection established! UCC={ucc}, Balance=₹{bal.get('clear_cash_inr', 0.0)}"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/stock/fx-rate")
async def get_fx_rate():
    rate = get_live_usd_inr()
    return {"success": True, "usd_to_inr": rate, "source": "interbank_live"}

@app.get("/api/stock/portfolio")
async def get_portfolio():
    return await asyncio.to_thread(stock_engine.get_portfolio_summary)

@app.get("/api/stock/candles")
async def get_candles(
    symbol: str = Query("NVDA", description="Stock Symbol"),
    timeframe: str = Query("5m", description="Candle timeframe: 1m, 5m, 15m, 1h"),
    count: int = Query(40, description="Number of candles")
):
    candles = await asyncio.to_thread(stock_engine.generate_candlesticks, symbol, timeframe, count)
    live_price = await asyncio.to_thread(stock_engine.get_live_price, symbol)
    meta = MARKET_UNIVERSE.get(symbol, {})
    return {
        "symbol": symbol,
        "name": meta.get("name", symbol),
        "currency": meta.get("currency", "USD"),
        "timeframe": timeframe,
        "live_price": live_price,
        "candles": candles
    }

@app.post("/api/stock/deep-think-scan")
async def trigger_deep_think_scan():
    report = stock_engine.evaluate_deep_thinking()
    return {"success": True, "report": report, "portfolio": stock_engine.get_portfolio_summary()}

@app.post("/api/stock/analyze")
async def analyze_stock_endpoint(req: AnalyzeRequest):
    analysis = stock_engine.analyze_custom_stock(req.symbol)
    return {"success": True, "analysis": analysis}

@app.post("/api/stock/buy")
async def buy_stock_endpoint(req: BuyRequest):
    result = stock_engine.buy_stock(
        symbol=req.symbol,
        shares=req.shares,
        amount_usd=req.amount_usd,
        strategy=req.strategy,
        auto=False
    )
    return result

@app.post("/api/stock/sell")
async def sell_stock_endpoint(req: SellRequest):
    result = stock_engine.sell_stock(
        position_id=req.position_id,
        reason=req.reason
    )
    return result

@app.post("/api/stock/toggle-autotrade")
async def toggle_autotrade(req: ToggleAutoRequest):
    stock_engine.state["auto_trade_enabled"] = req.enabled
    stock_engine.save_state()
    return {"success": True, "auto_trade_enabled": req.enabled}

@app.post("/api/stock/reset-challenge")
async def reset_challenge_endpoint(req: ResetChallengeRequest):
    summary = stock_engine.reset_to_challenge()
    return {"success": True, "summary": summary}

@app.post("/api/stock/trigger-cycle")
async def trigger_cycle():
    actions = stock_engine.run_auto_cycle()
    return {"success": True, "actions": actions, "portfolio": stock_engine.get_portfolio_summary()}

@app.get("/api/stock/metrics")
async def get_metrics():
    metrics_path = os.path.join(os.path.dirname(__file__), "model_metrics.json")
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read model_metrics.json: {e}")
    return {"status": "ready"}

@app.post("/api/stock/retrain")
async def retrain_model_endpoint():
    try:
        from ai_engine.model_trainer import train_master_model
        metrics = await asyncio.to_thread(train_master_model)
        return {"success": True, "metrics": metrics}
    except Exception as e:
        logger.error(f"Retrain endpoint failed: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/stock/live-status")
async def get_live_status():
    mode = live_broker.get_execution_mode()
    creds = live_broker.verify_api_credentials()
    return {"success": True, "execution_mode": mode, "credentials": creds}

@app.post("/api/stock/clear-all")
async def clear_all_positions(req: Optional[ResetChallengeRequest] = None):
    """Clean slate: removes all previous test trades and resets state for live trading."""
    summary = stock_engine.reset_challenge()
    return {
        "success": True,
        "message": "All positions and trade history cleared. Ready for live trading.",
        "portfolio": summary
    }

@app.post("/api/stock/emergency-stop")
async def emergency_stop():
    """Emergency Circuit Breaker kill-switch."""
    stock_engine.state["auto_trade_enabled"] = False
    stock_engine.save_state()
    res = live_broker.emergency_stop_all()
    return {"success": True, "kill_switch": res, "auto_trade_enabled": False}

@app.get("/api/tradesync/signals")
async def get_tradesync_signals(limit: int = Query(20, description="Max signals to return")):
    """Returns recent TradeSync broadcasted signals and audit events."""
    signals = tradesync.get_recent_signals(limit)
    return {"success": True, "count": len(signals), "signals": signals}

@app.get("/api/committee/consensus")
async def get_committee_consensus(symbol: str = Query("PNB.NS", description="Stock Symbol")):
    """Runs the HKUDS 4-agent investment committee debate on the given symbol."""
    price = stock_engine.get_live_price(symbol)
    ind = compute_real_indicators(symbol) or {}
    meta = MARKET_UNIVERSE.get(symbol, {})
    bal = live_broker.get_live_balance()
    available_inr = bal.get("available_cash_inr", 2500.0)
    shares = max(1, int(2500.0 // price)) if price > 0 else 1
    consensus = investment_committee.evaluate_investment_candidate(
        symbol=symbol,
        price=price,
        shares=shares,
        indicators=ind,
        sector=meta.get("sector", "Banking"),
        catalyst=meta.get("catalyst", "Institutional Setup"),
        available_balance_inr=available_inr,
        target_net_pct=5.0
    )
    return {"success": True, "symbol": symbol, "consensus": consensus}

@app.get("/api/groww/fee-target")
async def solve_fee_target(
    buy_price: float = Query(..., description="Entry Buy Price in INR"),
    shares: float = Query(..., description="Quantity of shares"),
    target_net_pct: float = Query(5.0, description="Target NET profit in % (default: 5.0%)")
):
    """Calculates exact Target Sell Price and Breakeven price under Groww & statutory charges."""
    target_sol = GrowwFeeCalculator.solve_target_price_for_net_profit(
        buy_price=buy_price,
        shares=shares,
        target_net_pct=target_net_pct,
        product="CNC"
    )
    be_sol = GrowwFeeCalculator.solve_breakeven_price(
        buy_price=buy_price,
        shares=shares,
        product="CNC"
    )
    return {
        "success": True,
        "target": target_sol,
        "breakeven": be_sol
    }


# Background Autonomous Deep Thinking Loop (24/7 Engine)
async def stock_auto_pilot_loop():
    logger.info("Universal Stock Deep Thinking Loop initialized — 24/7 LIVE REAL TRADING via Groww...")
    await asyncio.sleep(2)
    # Perform initial Deep Thinking scan
    stock_engine.evaluate_deep_thinking()

    cycle_count = 0
    last_heartbeat_time = time.time()

    while True:
        try:
            await asyncio.sleep(8)
            cycle_count += 1
            await asyncio.to_thread(stock_engine.run_auto_cycle)

            # 24/7 Telegram Heartbeat Broadcast every 30 minutes (1800s)
            now = time.time()
            if now - last_heartbeat_time >= 1800:
                last_heartbeat_time = now
                summary = stock_engine.get_portfolio_summary()
                thinking = summary.get("latest_thinking_log", {})
                top = thinking.get("top_candidate") or {}
                nse_status = thinking.get("nse_market_status", "ACTIVE")
                open_pos = summary.get("open_positions", [])
                pos_str = f"{len(open_pos)} active" if open_pos else "None (Cash Ready)"
                groww_bal = summary.get("broker", {}).get("clear_cash_inr", 0.0)

                heartbeat_msg = (
                    f"📡 *[DK's TRADE — 24/7 MARKET RADAR]*\n"
                    f"────────────────────────────\n"
                    f"• *NSE Status:* {nse_status}\n"
                    f"• *Groww Balance:* *₹{groww_bal:.2f} INR*\n"
                    f"• *Active Positions:* {pos_str}\n"
                    f"• *AI Top Watch:* *{top.get('symbol', 'N/A')}* ({top.get('technique', 'N/A')})\n"
                    f"• *Score:* *{top.get('score', 0)}/100* | RSI: {top.get('rsi', 'N/A')} | Vol: {top.get('volume_surge', 'N/A')}\n"
                    f"• *Engine Status:* 🟢 *24/7 Deep Thinking Active*"
                )
                from ai_engine.stock_trader import send_telegram_alert
                send_telegram_alert(heartbeat_msg)

        except Exception as e:
            logger.error(f"Error in stock auto-pilot loop: {e}")
            await asyncio.sleep(8)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(stock_auto_pilot_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_engine.stock_server:app", host="127.0.0.1", port=8085, reload=False)
