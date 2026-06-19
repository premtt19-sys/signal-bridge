"use client";
import React, { useState, useEffect } from "react";

// Browser persistence (replaces Claude's window.storage in the real app).
const store = {
  get: (k) => { try { const v = localStorage.getItem(k); return v == null ? null : { value: v }; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const T = {
  ink: "#0E141B", panel: "#151E29", panelHi: "#1B2734", border: "#26333F",
  text: "#E7EEF5", dim: "#8294A6", faint: "#5A6A7A", accent: "#2DD4BF",
  pass: "#34D399", warn: "#FBBF24", fail: "#F87171",
};
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const MARKET_TREND = 82;

const TF = {
  daily: { label: "Daily · swing/position", tag: "Swing / position — days to months" },
  weekly: { label: "Weekly · long-term", tag: "Long-term position — weeks to months" },
};

// Demo tickers. base = timeframe-agnostic metrics; daily/weekly = trend inputs,
// so a name can look strong on the daily yet unconfirmed on the weekly.
const DEMO = {
  NVDA: { price: 171.4, high52: 180, low52: 98, rsi: 63, volRatio: 1.35, accumDays: 4, atrPct: 2.4, sectorRS: 90, daily: { sma50: 158, sma150: 140, sma200: 128, rs: 94, trendUp: true }, weekly: { sma50: 150, sma150: 120, sma200: 105, rs: 96, trendUp: true } },
  IONQ: { price: 44.2, high52: 47, low52: 18, rsi: 66, volRatio: 1.5, accumDays: 3, atrPct: 5.5, sectorRS: 85, daily: { sma50: 39, sma150: 31, sma200: 27, rs: 91, trendUp: true }, weekly: { sma50: 36, sma150: 28, sma200: 24, rs: 90, trendUp: true } },
  HIMS: { price: 58.9, high52: 63, low52: 31, rsi: 58, volRatio: 1.1, accumDays: 2, atrPct: 4.0, sectorRS: 72, daily: { sma50: 52, sma150: 44, sma200: 38, rs: 88, trendUp: true }, weekly: { sma50: 50, sma150: 42, sma200: 39, rs: 84, trendUp: false } },
  IREN: { price: 18.7, high52: 20, low52: 7.4, rsi: 61, volRatio: 1.25, accumDays: 3, atrPct: 6.0, sectorRS: 80, daily: { sma50: 16.2, sma150: 13, sma200: 11.2, rs: 86, trendUp: true }, weekly: { sma50: 15, sma150: 12, sma200: 10, rs: 88, trendUp: true } },
  OSCR: { price: 22.6, high52: 24, low52: 13.4, rsi: 54, volRatio: 0.95, accumDays: 1, atrPct: 3.5, sectorRS: 65, daily: { sma50: 20.1, sma150: 17.5, sma200: 16.2, rs: 76, trendUp: true }, weekly: { sma50: 19, sma150: 16, sma200: 15, rs: 78, trendUp: true } },
  RCAT: { price: 12.1, high52: 13.5, low52: 4.9, rsi: 49, volRatio: 1.05, accumDays: 0, atrPct: 7.0, sectorRS: 60, daily: { sma50: 10.4, sma150: 8.2, sma200: 7.1, rs: 82, trendUp: true }, weekly: { sma50: 9.5, sma150: 8.0, sma200: 8.4, rs: 74, trendUp: false } },
  SLNH: { price: 9.8, high52: 14, low52: 6.2, rsi: 42, volRatio: 0.85, accumDays: -2, atrPct: 6.5, sectorRS: 45, daily: { sma50: 9.1, sma150: 8.7, sma200: 8.9, rs: 64, trendUp: false }, weekly: { sma50: 9.4, sma150: 9.6, sma200: 9.9, rs: 58, trendUp: false } },
  LUMN: { price: 4.9, high52: 9.5, low52: 4.1, rsi: 35, volRatio: 0.8, accumDays: -4, atrPct: 5.0, sectorRS: 30, daily: { sma50: 5.2, sma150: 5.6, sma200: 6.0, rs: 33, trendUp: false }, weekly: { sma50: 5.3, sma150: 5.8, sma200: 6.2, rs: 30, trendUp: false } },
};
const dataFor = (sym, tf) => ({ ...DEMO[sym], ...DEMO[sym][tf] });

function trendChecks(d) {
  const pctLow = ((d.price - d.low52) / d.low52) * 100, pctHigh = ((d.high52 - d.price) / d.high52) * 100;
  return [
    d.price > d.sma150 && d.price > d.sma200, d.sma150 > d.sma200, !!d.trendUp,
    d.sma50 > d.sma150 && d.sma50 > d.sma200, d.price > d.sma50,
    pctLow >= 30, pctHigh <= 25, d.rs >= 70,
  ];
}
const rsiHealth = (r) => r >= 55 && r <= 72 ? 100 : r > 72 ? clamp(100 - (r - 72) * 2.5) : r >= 45 ? clamp(60 + (r - 45) * 4) : clamp((r / 45) * 60);
function pillars(d) {
  const passed = trendChecks(d).filter(Boolean).length;
  const trend = clamp((passed / 8) * 100);
  const momentum = clamp(0.55 * d.rs + 0.45 * rsiHealth(d.rsi));
  const volume = clamp(50 + d.accumDays * 7 + (d.volRatio - 1) * 60);
  const risk = clamp(100 - (d.atrPct - 2) * 12);
  const market = clamp(0.5 * MARKET_TREND + 0.5 * d.sectorRS);
  const overall = clamp(0.3 * trend + 0.25 * momentum + 0.15 * volume + 0.1 * risk + 0.2 * market);
  return { passed, trend, momentum, volume, risk, market, overall };
}
const gradeOf = (s) => s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 40 ? "D" : "F";
const gradeColor = (g) => g === "A" ? T.pass : g === "B" ? "#86E0B0" : g === "C" ? T.warn : g === "D" ? "#F0A35E" : T.fail;
const gradeLabel = (g) => g === "A" ? "Elite Trend" : g === "B" ? "Strong Trend" : g === "C" ? "Neutral" : g === "D" ? "Weak" : "Failing Trend";
const trendQuality = (p) => p >= 8 ? { dot: T.pass, label: "Strong Trend", color: T.pass } : p >= 6 ? { dot: T.warn, label: "Watchlist", color: T.warn } : { dot: T.fail, label: "Weak Trend", color: T.fail };

const TRIAL_DAYS = 60;
const TABS = [["score", "📊", "Quick Score"], ["trends", "🔥", "Strong Trends"], ["watch", "⭐", "Watchlist"], ["read", "🧠", "Weekly Read"]];

const SAMPLE_READ = "Leaders are holding their Stage 2 trends while the weak names roll over — exactly the separation you want to see. I'm keeping the watchlist tight and stops tighter, and I'm not touching anything extended. Patience pays here.\n\nWatching, not chasing. 👀";

const Card = ({ children, style }) => <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, ...style }}>{children}</div>;

export default function App() {
  const [tab, setTab] = useState("score");
  const [ticker, setTicker] = useState("");
  const [timeframe, setTimeframe] = useState("daily");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [watchlist, setWatchlist] = useState([]);
  const [isMember, setIsMember] = useState(false);
  const [read, setRead] = useState(SAMPLE_READ);
  const [editing, setEditing] = useState(false);
  const [daysLeft, setDaysLeft] = useState(TRIAL_DAYS);
  const [showWelcome, setShowWelcome] = useState(false);
  const [reminderOff, setReminderOff] = useState(false);

  useEffect(() => {
    try { const r = store.get("app_watchlist"); if (r?.value) setWatchlist(JSON.parse(r.value)); } catch (e) {}
    try { const r = store.get("app_read"); if (r?.value) setRead(r.value); } catch (e) {}
    try {
      const r = store.get("trial_start");
      let start;
      if (r && r.value) start = Number(r.value);
      else { start = Date.now(); store.set("trial_start", String(start)); setShowWelcome(true); }
      setDaysLeft(Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - start) / 86400000)));
    } catch (e) {}
  }, []);
  const persistWatch = (n) => { setWatchlist(n); store.set("app_watchlist", JSON.stringify(n)); };
  const saveRead = (v) => { setRead(v); store.set("app_read", v); };

  function scoreSymbol(symRaw) {
    const sym = symRaw.trim().toUpperCase();
    setError("");
    if (!sym) return setError("Type a ticker.");
    if (!DEMO[sym]) { setResult(null); return setError(`"${sym}" isn't in the demo set (try ${Object.keys(DEMO).slice(0, 4).join(", ")}…).`); }
    const p = pillars(dataFor(sym, timeframe));
    setResult({ sym, ...p, tq: trendQuality(p.passed), grade: gradeOf(p.overall) });
  }
  function openFromTrends(sym) { setTicker(sym); scoreSymbol(sym); setTab("score"); }
  function saveToWatch() {
    if (!result) return;
    const e = { id: Date.now(), sym: result.sym, overall: result.overall, grade: result.grade, color: result.tq.dot };
    persistWatch([e, ...watchlist.filter((w) => w.sym !== e.sym)].sort((a, b) => b.overall - a.overall));
  }

  const ranked = Object.keys(DEMO).map((sym) => { const p = pillars(dataFor(sym, "daily")); return { sym, ...p, tq: trendQuality(p.passed), grade: gradeOf(p.overall) }; }).sort((a, b) => b.overall - a.overall);


  return (
    <div style={{ background: T.ink, color: T.text, minHeight: "100%", padding: "16px 14px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        {showWelcome && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, maxWidth: 360 }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>👋</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Welcome to SignalBridge</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: T.dim, margin: "0 0 16px" }}>
                You’ve got <strong style={{ color: T.text }}>full access free for {TRIAL_DAYS} days</strong>. After that, the Premium features — the full score breakdown and Prem’s Weekly Read — need a subscription. The free verdict stays free.
              </p>
              <button onClick={() => setShowWelcome(false)} style={{ background: T.accent, color: "#04241F", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}>Got it</button>
            </div>
          </div>
        )}
        {/* Header */}
        <header className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div className="flex items-center gap-2">
            <span style={{ width: 10, height: 10, borderRadius: 2, background: T.accent, boxShadow: `0 0 12px ${T.accent}` }} />
            <span style={{ fontWeight: 700, letterSpacing: "0.16em", fontSize: 13 }}>SIGNALBRIDGE</span>
          </div>
          <span style={{ fontSize: 10.5, color: isMember ? T.accent : T.faint, border: `1px solid ${isMember ? T.accent : T.border}`, borderRadius: 5, padding: "2px 8px", fontWeight: 600 }}>
            {isMember ? "PREMIUM" : "FREE"}
          </span>
        </header>

        {!isMember && (daysLeft > 7 || !reminderOff) && (
          <div className="flex items-center justify-between" style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: daysLeft <= 7 ? "rgba(251,191,36,0.12)" : T.panel, border: `1px solid ${daysLeft <= 7 ? T.warn : T.border}` }}>
            <span style={{ fontSize: 12.5, color: daysLeft <= 7 ? T.warn : T.dim }}>
              {daysLeft <= 7
                ? `⌛ Free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — subscribe to keep Premium.`
                : `🎁 Free trial — ${daysLeft} days of full access left.`}
            </span>
            {daysLeft <= 7 && (
              <span className="flex items-center gap-3">
                <button onClick={() => setIsMember(true)} style={{ background: T.warn, color: "#1a1400", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Subscribe</button>
                <button onClick={() => setReminderOff(true)} style={{ background: "transparent", border: "none", color: T.faint, cursor: "pointer", fontSize: 15 }}>×</button>
              </span>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex gap-1.5" style={{ marginBottom: 16, overflowX: "auto" }}>
          {TABS.map(([key, icon, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              border: "none", cursor: "pointer", borderRadius: 10, padding: "8px 12px", whiteSpace: "nowrap",
              fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
              background: tab === key ? T.panelHi : "transparent",
              color: tab === key ? T.text : T.dim,
              boxShadow: tab === key ? `inset 0 -2px 0 ${T.accent}` : "none",
            }}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>

        {/* ---------------- QUICK SCORE ---------------- */}
        {tab === "score" && (
          <>
            <Card style={{ marginBottom: 12 }}>
              <div className="flex items-center flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
                <div className="flex" style={{ background: T.ink, border: `1px solid ${T.border}`, borderRadius: 9, padding: 3 }}>
                  {["daily", "weekly"].map((k) => (
                    <button key={k} onClick={() => { setTimeframe(k); setResult(null); setError(""); }} style={{ border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, background: timeframe === k ? T.accent : "transparent", color: timeframe === k ? "#04241F" : T.dim }}>
                      {TF[k].label}
                    </button>
                  ))}
                </div>
                <span style={{ color: T.faint, fontSize: 12 }}>{TF[timeframe].tag}</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={ticker} onChange={(e) => setTicker(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scoreSymbol(ticker)}
                  placeholder="Enter ticker — e.g. NVDA"
                  className="rounded-md px-3 py-3 outline-none flex-1"
                  style={{ background: T.ink, border: `1px solid ${T.border}`, color: T.accent, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.1em", fontSize: 16, textTransform: "uppercase", minWidth: 0 }}
                />
                <button onClick={() => scoreSymbol(ticker)} className="rounded-md px-5" style={{ background: T.accent, color: "#04241F", fontWeight: 700, border: "none", cursor: "pointer" }}>Check</button>
              </div>
              <p style={{ color: T.faint, fontSize: 11.5, marginTop: 8 }}>Demo: {Object.keys(DEMO).join(", ")}</p>
              {error && <p style={{ color: T.fail, fontSize: 12.5, marginTop: 8 }}>{error}</p>}
            </Card>

            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, color: T.faint, letterSpacing: "0.06em", marginBottom: 8 }}>GRADE SCALE</div>
              <div className="flex flex-wrap" style={{ gap: "8px 14px" }}>
                {["A", "B", "C", "D", "F"].map((g) => (
                  <div key={g} className="flex items-center" style={{ gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: gradeColor(g) }} />
                    <span style={{ fontFamily: MONO, fontWeight: 800, color: gradeColor(g), fontSize: 12.5 }}>{g}</span>
                    <span style={{ fontSize: 12, color: T.dim }}>{gradeLabel(g)}</span>
                  </div>
                ))}
              </div>
            </Card>

            {result && (
              <Card>
                <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 14 }}>
                  <div className="flex items-center gap-3">
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: result.tq.dot, boxShadow: `0 0 10px ${result.tq.dot}` }} />
                    <div>
                      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 21, letterSpacing: "0.08em", color: T.accent }}>{result.sym}</div>
                      <div style={{ color: result.tq.color, fontSize: 12.5, fontWeight: 600 }}><span style={{ color: T.faint, fontWeight: 400 }}>Trend Quality · </span>{result.tq.label}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: MONO, fontSize: 10.5, color: T.faint }}>OVERALL</div>
                      <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: gradeColor(result.grade), lineHeight: 1 }}>{result.overall}</div>
                    </div>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: T.ink, border: `2px solid ${gradeColor(result.grade)}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 800, fontSize: 22, color: gradeColor(result.grade) }}>{result.grade}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.dim, margin: "-2px 0 14px" }}>
                  <span style={{ fontWeight: 700, color: gradeColor(result.grade) }}>Grade {result.grade}</span>
                  <span style={{ color: T.faint }}>·</span>
                  <span>{gradeLabel(result.grade)}</span>
                </div>
                {[["Trend", result.trend], ["Momentum", result.momentum], ["Volume", result.volume], ["Risk", result.risk], ["Market", result.market]].map(([n, v]) => (
                  <div key={n} style={{ marginBottom: 9 }}>
                    <div className="flex justify-between" style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{n}</span>
                      <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: gradeColor(gradeOf(v)) }}>{v}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: T.ink }}><div style={{ height: "100%", width: `${v}%`, background: gradeColor(gradeOf(v)), borderRadius: 4 }} /></div>
                  </div>
                ))}
                <button onClick={saveToWatch} className="rounded-md px-4 py-2" style={{ marginTop: 8, background: "transparent", color: T.accent, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Watchlist</button>
              </Card>
            )}
          </>
        )}

        {/* ---------------- STRONG TRENDS ---------------- */}
        {tab === "trends" && (
          <Card>
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Today's Strong Trends</h2>
              <span style={{ fontSize: 11.5, color: T.faint }}>your system · by grade</span>
            </div>
            <p style={{ color: T.faint, fontSize: 11.5, marginBottom: 6 }}>Top names on the SignalBridge grade right now. Not what's hyped — what's earning it.</p>
            {ranked.map((s, i) => (
              <button key={s.sym} onClick={() => openFromTrends(s.sym)} className="w-full flex items-center justify-between" style={{ background: "transparent", border: "none", borderTop: i === 0 ? "none" : `1px solid ${T.border}`, padding: "11px 2px", cursor: "pointer", textAlign: "left" }}>
                <div className="flex items-center gap-3">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.tq.dot }} />
                  <span style={{ fontFamily: MONO, fontWeight: 700, letterSpacing: "0.08em", width: 56 }}>{s.sym}</span>
                  <span style={{ fontSize: 12, color: s.tq.color }}>{s.tq.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: MONO, fontSize: 12, color: T.dim }}>{s.overall}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 800, color: gradeColor(s.grade), width: 16, textAlign: "center" }}>{s.grade}</span>
                  <span style={{ color: T.faint }}>›</span>
                </div>
              </button>
            ))}
          </Card>
        )}

        {/* ---------------- WATCHLIST ---------------- */}
        {tab === "watch" && (
          <Card>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Watchlist</h2>
              <span style={{ fontSize: 11.5, color: T.faint }}>{watchlist.length} saved</span>
            </div>
            {watchlist.length === 0 ? (
              <p style={{ color: T.faint, fontSize: 13 }}>Score a ticker and tap “+ Watchlist” to save it here.</p>
            ) : watchlist.map((w, i) => (
              <div key={w.id} className="flex items-center justify-between" style={{ padding: "10px 2px", borderTop: i === 0 ? "none" : `1px solid ${T.border}` }}>
                <div className="flex items-center gap-3">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: w.color }} />
                  <button onClick={() => openFromTrends(w.sym)} style={{ background: "transparent", border: "none", color: T.text, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer", padding: 0 }}>{w.sym}</button>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: MONO, fontSize: 12, color: T.dim }}>{w.overall}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 800, color: gradeColor(w.grade), width: 16, textAlign: "center" }}>{w.grade}</span>
                  <button onClick={() => persistWatch(watchlist.filter((x) => x.id !== w.id))} style={{ background: "transparent", border: "none", color: T.faint, cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* ---------------- WEEKLY READ (premium gate) ---------------- */}
        {tab === "read" && (
          <>
            <Card>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700 }}>🧠 Weekly Read by Prem</h2>
                <span style={{ fontSize: 10.5, color: T.accent, border: `1px solid ${T.accent}`, borderRadius: 5, padding: "2px 7px", fontWeight: 600 }}>PREMIUM</span>
              </div>

              {!isMember ? (
                <div style={{ position: "relative" }}>
                  <div style={{ filter: "blur(5px)", opacity: 0.5, userSelect: "none", fontSize: 13.5, lineHeight: 1.6, color: T.dim }}>
                    {SAMPLE_READ}
                  </div>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🔒</span>
                    <p style={{ fontSize: 13, color: T.text, textAlign: "center", margin: 0 }}>Prem's weekly market read is for Premium members.</p>
                    <button onClick={() => setIsMember(true)} className="rounded-md px-5 py-2" style={{ background: T.accent, color: "#04241F", fontWeight: 700, fontSize: 13.5, border: "none", cursor: "pointer" }}>Unlock Premium</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, color: T.faint }}>Week of {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <button onClick={() => setEditing((v) => !v)} style={{ background: "transparent", border: "none", color: T.dim, fontSize: 12, cursor: "pointer" }}>{editing ? "Done" : "Edit"}</button>
                  </div>
                  {editing ? (
                    <textarea value={read} onChange={(e) => saveRead(e.target.value)} rows={6} className="w-full rounded-md px-3 py-2 outline-none" style={{ background: T.ink, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, lineHeight: 1.6, resize: "vertical" }} />
                  ) : (
                    <p style={{ fontSize: 13.5, lineHeight: 1.65, color: T.text, whiteSpace: "pre-wrap", margin: 0 }}>{read}</p>
                  )}
                  <p style={{ fontSize: 12.5, color: T.accent, marginTop: 12, fontWeight: 600 }}>— Prem</p>
                </div>
              )}
            </Card>
            <p style={{ color: T.faint, fontSize: 11, marginTop: 10, textAlign: "center" }}>
              Toggle: previewing as {isMember ? "a Premium member" : "a free user"} · <button onClick={() => setIsMember((v) => !v)} style={{ background: "transparent", border: "none", color: T.dim, textDecoration: "underline", cursor: "pointer", fontSize: 11 }}>switch</button>
            </p>
          </>
        )}

        <p style={{ color: T.faint, fontSize: 10.5, marginTop: 18, textAlign: "center" }}>
          Demo · SignalBridge implements Minervini's SEPA framework. Educational, not financial advice.
        </p>
      </div>
    </div>
  );
}
