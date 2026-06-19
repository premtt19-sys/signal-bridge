# SignalBridge — Developer Brief

A handoff document for the developer taking this project forward. Read this first.

## What it is

SignalBridge is a stock-screening web app for **retail swing and position traders** who follow Mark Minervini's SEPA methodology. It scores stocks against an objective trend system and surfaces the strongest names, wrapped around the founder's (Prem's) own market commentary.

The product is layered:
- **Simple on top:** type a ticker → a Trend Quality light (Strong / Watch / Weak) + a letter grade (A–F).
- **Deep underneath:** a five-pillar score (Trend, Momentum, Volume, Risk, Market) rolling into an overall 0–100.
- **The paid hook:** "Weekly Read by Prem" — his written market take, gated for Premium members.

The screener is the hook; the founder's curation and community are the actual value. Build accordingly.

## Files provided

| File | What it is |
|---|---|
| `SignalBridgeApp.jsx` | The full React app (Quick Score, Strong Trends, Watchlist, Weekly Read + premium gate, grade legend). **Build from this.** |
| `route.js` | Next.js App Router API route — the backend scan engine (Financial Modeling Prep). |
| `index.html` | A compiled, self-contained demo build. Open it to see the target running. |
| `CREATE_APP_GUIDE.md` | Deployment steps (Next.js + Vercel). |

## Tech stack

- **Frontend:** React (single component, inline styles + a few Tailwind utilities). Theme tokens are in the `T` object.
- **Framework / hosting:** Next.js on Vercel (recommended — backend and frontend in one project).
- **Data:** a market-data API (currently Financial Modeling Prep) with the key held **server-side only**.
- **Persistence (current):** browser `localStorage`. Needs to move to a real database + auth for multi-user.

## ⚠️ Compliance rules — NON-NEGOTIABLE

These keep the business inside the "publisher's exclusion" of the U.S. Investment Advisers Act of 1940. Breaking them creates real regulatory risk for the founder. Do not "improve" the UX in ways that violate them.

1. **Never use "Buy," "Sell," or "Avoid"** — or any language instructing the user what to do. All verdicts describe the **stock's objective state** only: "Strong Trend," "Watchlist," "Weak Trend," "Failing Trend," "Trend confirmed," etc.
2. **Keep everything impersonal and educational.** Same content for every user. No advice tailored to an individual's portfolio or situation.
3. **Never take custody of funds, manage accounts, or auto-execute trades.**
4. **Alerts (when built)** must be objective, rules-based notifications ("TICKER now meets all 8 criteria"), sent to everyone — never personalized "buy now" calls.
5. **Keep the disclaimer** ("Educational tool… not financial advice. NFA.") visible.

If a feature idea touches any of these, flag it with the founder before building.

## Status: done vs. unfinished

**Done**
- Full UI/UX, four sections, responsive single-column layout.
- 8-point Minervini Trend Template (objective, in code).
- Five-pillar SEPA scoring → overall 0–100 → letter grade → Trend Quality light. Transparent, not a black box.
- Grade legend, watchlist (localStorage), Weekly Read with a Premium gate (UI only).
- Daily / weekly timeframe toggle. Demo dataset of ~8 tickers.

**Unfinished / to do**
- **Live data:** set `DATA_URL = "/api/scan"` and finish `route.js`. Verify FMP field names against current docs.
- **RS rating** is a *proxy* (relative performance vs SPY), not a true market-wide percentile. Real percentile = scan a full universe daily.
- **`accumDays` (volume accumulation) and `sectorRS` are placeholders** in `route.js` — need real up/down-volume history and sector-ETF relative strength.
- **No real auth/accounts/database** — Weekly Read and watchlist are per-device only.
- **No payments.** **No real alerts.**

## Build order (do NOT skip ahead)

1. Deploy the demo; founder validates with ~10–20 real traders.
2. Wire live market data (finish backend + API key).
3. Accounts + database (Supabase suggested) → replace localStorage, gate the Weekly Read for real.
4. Payments (Stripe subscriptions).
5. Alerts (scheduled scan + objective-trigger notifications).

## What NOT to build

No Bloomberg-style terminal, no news feeds, no pre-market movers, no in-house charting (link out to TradingView instead). Every feature should either sharpen the screener's read or carry the founder's voice. Resist commodity features that already exist for free elsewhere — they add cost and dilute focus.

## Brand

SignalBridge · dark theme, teal accent (`#2DD4BF`), monospace for all numbers. Voice: "Watching, not chasing." · "Faith · Discipline · Patience."
