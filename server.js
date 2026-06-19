/**
 * SignalBridge — Live Data Backend
 * Alpha Vantage + Node.js/Express
 *
 * Free tier: 25 req/day, 5 req/min
 * Premium:   set PREMIUM=true in .env (removes daily cap, 75+ req/min)
 *
 * Setup:
 *   npm install express cors dotenv
 *   cp .env.example .env   # paste your AV_KEY
 *   node server.js
 *
 * Endpoints:
 *   GET /api/scan                      → full default universe
 *   GET /api/scan?tickers=NVDA,IONQ    → specific tickers
 *   GET /api/cache                     → quota + cache status
 */

require("dotenv").config();
const express = require("express");
const cors    = require("cors");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PORT         = process.env.PORT    || 3001;
const AV_KEY       = process.env.AV_KEY  || process.env.ALPHA_VANTAGE_KEY;
const PREMIUM      = process.env.PREMIUM === "true";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;   // cache each ticker 6 hours
const DAILY_LIMIT  = PREMIUM ? Infinity : 24;
// Free tier: max 5/min → 1 every 13s to be safe
// Premium:   75/min → 1 every 900ms
const CALL_GAP_MS  = PREMIUM ? 900 : 13_500;

const DEFAULT_UNIVERSE = ["NVDA","IONQ","HIMS","IREN","OSCR","RCAT","SLNH","LUMN"];

// ─── GLOBAL SERIAL QUEUE ─────────────────────────────────────────────────────
// All AV HTTP calls run through this queue one at a time, enforcing the gap.
// This prevents concurrent requests from each spinning their own timer.
let queueTail    = Promise.resolve();
let callsToday   = 0;
let lastCallTime = 0;
let dayStamp     = todayStr();

function todayStr() { return new Date().toISOString().slice(0, 10); }

function resetDay() {
  const d = todayStr();
  if (d !== dayStamp) { callsToday = 0; dayStamp = d; }
}

// Enqueue one AV fetch — returns a Promise that resolves when it's our turn
function avFetch(url) {
  const p = queueTail.then(async () => {
    resetDay();
    if (callsToday >= DAILY_LIMIT) {
      throw new Error(`Daily quota reached (${callsToday}/${DAILY_LIMIT}). Resets at midnight UTC.`);
    }

    // Enforce gap since last real call
    const gap = CALL_GAP_MS - (Date.now() - lastCallTime);
    if (gap > 0) await new Promise(r => setTimeout(r, gap));

    lastCallTime = Date.now();
    callsToday++;

    console.log(`[AV] call ${callsToday}/${PREMIUM ? "∞" : DAILY_LIMIT} → ${url.split("?")[1].slice(0, 60)}…`);

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // AV sends rate/premium errors inside the JSON body
    const note = data["Note"] || data["Information"];
    if (note) throw new Error(note.slice(0, 160));

    return data;
  });

  // Advance the tail regardless of success/failure so the queue keeps moving
  queueTail = p.catch(() => {});
  return p;
}

// ─── IN-MEMORY CACHE ─────────────────────────────────────────────────────────
const cache = {};
function cached(sym) {
  const c = cache[sym];
  if (!c || Date.now() - c.fetchedAt > CACHE_TTL_MS) return null;
  return c.data;
}
function store(sym, data) { cache[sym] = { data, fetchedAt: Date.now() }; }

// ─── AV URL BUILDER ──────────────────────────────────────────────────────────
const AV_BASE = "https://www.alphavantage.co/query";
function av(params) {
  return AV_BASE + "?" + new URLSearchParams({ ...params, apikey: AV_KEY });
}

// ─── FETCH ONE TICKER (free-tier endpoints only) ─────────────────────────────
// Calls used per ticker: 4
//   1. TIME_SERIES_DAILY (prices, vol — free)
//   2. SMA 150           (free)
//   3. SMA 200           (free)
//   4. RSI 14            (free)
//
// NOT used (premium on free key):
//   TIME_SERIES_DAILY_ADJUSTED, ATR, GLOBAL_QUOTE with full fields
//
// atrPct approximated from daily range; sma50 computed from series.
async function fetchTicker(sym) {
  // ── 1. Daily price series ────────────────────────────────────────────────
  const daily = await avFetch(av({
    function: "TIME_SERIES_DAILY",
    symbol: sym,
    outputsize: "compact",   // 100 bars — free endpoint
  }));

  const ts    = daily["Time Series (Daily)"] || {};
  const dates = Object.keys(ts).sort().reverse(); // newest first
  if (dates.length < 20) throw new Error(`Too little history for ${sym}`);

  const bar0   = ts[dates[0]];
  const price  = parseFloat(bar0["4. close"]);
  const vol    = parseFloat(bar0["5. volume"]);

  // 20-day avg volume
  const vols20  = dates.slice(0, 20).map(d => parseFloat(ts[d]["5. volume"]));
  const avgVol  = vols20.reduce((a, b) => a + b, 0) / vols20.length;
  const volRatio = vol / avgVol;

  // Accumulation proxy: up-volume days in last 20 sessions
  let accumDays = 0;
  for (let i = 0; i < Math.min(20, dates.length - 1); i++) {
    const c  = parseFloat(ts[dates[i]]["4. close"]);
    const p  = parseFloat(ts[dates[i+1]]["4. close"]);
    const v  = parseFloat(ts[dates[i]]["5. volume"]);
    if (c > p && v > avgVol) accumDays++;
  }

  // 52-week high/low
  const yr     = dates.slice(0, Math.min(252, dates.length));
  const high52 = Math.max(...yr.map(d => parseFloat(ts[d]["2. high"])));
  const low52  = Math.min(...yr.map(d => parseFloat(ts[d]["3. low"])));

  // SMA 50 from series
  const closes50 = dates.slice(0, 50).map(d => parseFloat(ts[d]["4. close"]));
  const sma50    = closes50.reduce((a, b) => a + b, 0) / closes50.length;

  // ATR approximation from daily ranges (no extra API call needed)
  const ranges = dates.slice(0, 14).map(d => parseFloat(ts[d]["2. high"]) - parseFloat(ts[d]["3. low"]));
  const atr    = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const atrPct = price ? (atr / price) * 100 : null;

  // ── 2. SMA 150 ───────────────────────────────────────────────────────────
  const s150 = await avFetch(av({ function: "SMA", symbol: sym, interval: "daily", time_period: 150, series_type: "close" }));
  const s150v = Object.values(s150["Technical Analysis: SMA"] || {});
  const sma150 = s150v.length ? parseFloat(s150v[0]["SMA"]) : null;

  // ── 3. SMA 200 (+ prior month for trendUp) ───────────────────────────────
  const s200 = await avFetch(av({ function: "SMA", symbol: sym, interval: "daily", time_period: 200, series_type: "close" }));
  const s200e = Object.entries(s200["Technical Analysis: SMA"] || {}).sort((a, b) => b[0].localeCompare(a[0]));
  const sma200  = s200e.length      ? parseFloat(s200e[0][1]["SMA"])  : null;
  const sma200m = s200e.length > 21 ? parseFloat(s200e[21][1]["SMA"]) : null;
  const trendUp = sma200 && sma200m ? sma200 > sma200m : false;

  // ── 4. RSI 14 ────────────────────────────────────────────────────────────
  const rsiD = await avFetch(av({ function: "RSI", symbol: sym, interval: "daily", time_period: 14, series_type: "close" }));
  const rsiV  = Object.values(rsiD["Technical Analysis: RSI"] || {});
  const rsi   = rsiV.length ? parseFloat(rsiV[0]["RSI"]) : null;

  return { ticker: sym, price, sma50, sma150, sma200, high52, low52, trendUp, rsi, atrPct, volRatio, accumDays, sectorRS: 60 };
}

// ─── SPY 3-MONTH CHANGE (for RS calc) ───────────────────────────────────────
async function fetchSpy3M() {
  const d = await avFetch(av({ function: "TIME_SERIES_DAILY", symbol: "SPY", outputsize: "compact" }));
  const ts    = d["Time Series (Daily)"] || {};
  const dates = Object.keys(ts).sort().reverse();
  const now   = parseFloat(ts[dates[0]]["4. close"]);
  const ago   = dates.length > 63 ? parseFloat(ts[dates[63]]["4. close"]) : now;
  return ((now - ago) / ago) * 100;
}

function rsScore(price, sma50, spyChg) {
  const stockChg = sma50 ? ((price - sma50) / sma50) * 80 : 0;
  return Math.max(1, Math.min(99, Math.round(50 + (stockChg - spyChg) * 1.5)));
}

// ─── SCAN ─────────────────────────────────────────────────────────────────────
async function scan(tickers) {
  const uncached = tickers.filter(t => !cached(t));
  const callsNeeded = uncached.length * 4 + (uncached.length > 0 ? 1 : 0);
  resetDay();

  console.log(`[scan] ${tickers.length} tickers | ${uncached.length} uncached | ~${callsNeeded} calls needed | ${callsToday}/${PREMIUM ? "∞" : DAILY_LIMIT} used today`);

  if (!PREMIUM && uncached.length > 0 && callsToday + callsNeeded > DAILY_LIMIT) {
    console.warn(`[scan] ⚠ quota tight — only ${DAILY_LIMIT - callsToday} calls left, need ${callsNeeded}`);
  }

  // Fetch SPY once for RS calculation
  let spyChg = 0;
  if (uncached.length > 0) {
    try { spyChg = await fetchSpy3M(); }
    catch (e) { console.warn("[scan] SPY fetch failed:", e.message); }
  }

  const results = [];
  for (const sym of tickers) {
    const hit = cached(sym);
    if (hit) {
      console.log(`[cache] ${sym} ✓`);
      results.push({ ...hit, fromCache: true });
      continue;
    }
    try {
      const raw = await fetchTicker(sym);
      raw.rs = rsScore(raw.price, raw.sma50, spyChg);
      store(sym, raw);
      results.push({ ...raw, fromCache: false });
    } catch (e) {
      console.error(`[err] ${sym}: ${e.message}`);
      results.push({ ticker: sym, error: e.message });
    }
  }
  return results;
}

// ─── EXPRESS ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => res.json({ service: "SignalBridge API", premium: PREMIUM, callsToday, dailyLimit: PREMIUM ? "∞" : DAILY_LIMIT }));

app.get("/api/scan", async (req, res) => {
  if (!AV_KEY) return res.status(500).json({ error: "AV_KEY not set in .env" });
  const raw     = req.query.tickers || "";
  const tickers = raw ? raw.split(",").map(t => t.trim().toUpperCase()).filter(Boolean) : DEFAULT_UNIVERSE;
  try {
    const results = await scan(tickers);
    res.json({ date: todayStr(), callsToday, dailyLimit: PREMIUM ? "∞" : DAILY_LIMIT, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/cache", (_, res) => {
  const summary = Object.entries(cache).map(([sym, { data, fetchedAt }]) => ({
    sym, ageMin: Math.round((Date.now() - fetchedAt) / 60000), price: data.price,
  }));
  res.json({ callsToday, dailyLimit: PREMIUM ? "∞" : DAILY_LIMIT, cached: summary });
});

app.listen(PORT, () => {
  const line = "═".repeat(46);
  console.log(`\n╔${line}╗`);
  console.log(`║  SignalBridge API · port ${PORT} · ${PREMIUM ? "PREMIUM" : "free tier"}`.padEnd(47) + "║");
  console.log(`╠${line}╣`);
  console.log(`║  GET /api/scan                               ║`);
  console.log(`║  GET /api/scan?tickers=NVDA,IONQ             ║`);
  console.log(`║  GET /api/cache  (quota + cache status)      ║`);
  console.log(`╠${line}╣`);
  console.log(`║  Free: 4 calls/ticker + 1 SPY = 5/ticker    ║`);
  console.log(`║  Test with 1 ticker first: ?tickers=NVDA     ║`);
  console.log(`╚${line}╝\n`);
  if (!AV_KEY) console.warn("⚠  AV_KEY not set — set it in .env and restart.");
});
