// app/api/scan/route.js — SignalBridge live scan (Next.js App Router version)
// Keeps your data-API key server-side. Set FMP_API_KEY in Vercel env vars.
// Returns raw fields per ticker so the dashboard can compute all five pillars.
//
// Free tier (~250 calls/day). Verify FMP field names against current docs before charging.

const KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com/api/v3";
const UNIVERSE = ["NVDA", "IONQ", "HIMS", "IREN", "OSCR", "RCAT", "SLNH", "LUMN"];

async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function loadTicker(ticker, spyChange) {
  // quote: price, 50/200 SMA, 52-week high/low. Plus 150 SMA, 200-SMA series, RSI, ATR, change.
  const [quoteArr, sma150Arr, sma200Arr, rsiArr, atrArr, changeArr] = await Promise.all([
    j(`${BASE}/quote/${ticker}?apikey=${KEY}`),
    j(`${BASE}/technical_indicator/1day/${ticker}?type=sma&period=150&apikey=${KEY}`),
    j(`${BASE}/technical_indicator/1day/${ticker}?type=sma&period=200&apikey=${KEY}`),
    j(`${BASE}/technical_indicator/1day/${ticker}?type=rsi&period=14&apikey=${KEY}`),
    j(`${BASE}/technical_indicator/1day/${ticker}?type=atr&period=14&apikey=${KEY}`),
    j(`${BASE}/stock-price-change/${ticker}?apikey=${KEY}`),
  ]);
  const q = quoteArr[0] || {};
  const change = changeArr[0] || {};
  const spy = spyChange || {};

  // RS proxy: weighted relative performance vs SPY -> ~1–99. (True percentile = later upgrade.)
  const rel = 0.4 * ((change["3M"] ?? 0) - (spy["3M"] ?? 0)) + 0.4 * ((change["6M"] ?? 0) - (spy["6M"] ?? 0)) + 0.2 * ((change["1Y"] ?? 0) - (spy["1Y"] ?? 0));
  const rs = Math.max(1, Math.min(99, Math.round(50 + rel * 1.5)));

  const atr = atrArr[0]?.atr;
  return {
    ticker,
    price: q.price,
    sma50: q.priceAvg50,
    sma150: sma150Arr[0]?.sma,
    sma200: sma200Arr[0]?.sma,
    high52: q.yearHigh,
    low52: q.yearLow,
    rs,
    rsi: rsiArr[0]?.rsi,
    atrPct: q.price && atr ? (atr / q.price) * 100 : null,
    volRatio: q.volume && q.avgVolume ? q.volume / q.avgVolume : 1,
    accumDays: 0, // placeholder — needs up/down volume history to compute properly
    sectorRS: 60, // placeholder — needs sector ETF relative strength
    trendUp: Number.isFinite(sma200Arr[0]?.sma) && Number.isFinite(sma200Arr[21]?.sma) ? sma200Arr[0].sma > sma200Arr[21].sma : false,
  };
}

export async function GET(request) {
  if (!KEY) return Response.json({ error: "Set FMP_API_KEY in your environment." }, { status: 500 });
  try {
    const { searchParams } = new URL(request.url);
    const list = searchParams.get("tickers") ? searchParams.get("tickers").split(",") : UNIVERSE;
    const spyChange = (await j(`${BASE}/stock-price-change/SPY?apikey=${KEY}`))[0];

    const results = [];
    for (const t of list) {
      try { results.push(await loadTicker(t.trim().toUpperCase(), spyChange)); }
      catch (e) { results.push({ ticker: t, error: String(e.message) }); }
    }
    return Response.json({ date: new Date().toISOString().slice(0, 10), results });
  } catch (e) {
    return Response.json({ error: String(e.message) }, { status: 500 });
  }
}
