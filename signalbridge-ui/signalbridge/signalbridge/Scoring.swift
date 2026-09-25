import SwiftUI

// MARK: - Inputs

struct StockData {
    var price: Double, high52: Double, low52: Double
    var rsi: Double, volRatio: Double, accumDays: Double, atrPct: Double, sectorRS: Double
    var sma50: Double, sma150: Double, sma200: Double
    var rs: Double, trendUp: Bool
}

// MARK: - Outputs

struct TrendQuality { let dot: Color; let label: String }

struct ScoreResult: Identifiable {
    var id: String { sym }
    let sym: String
    let passed: Int, trend: Int, momentum: Int, volume: Int, risk: Int, market: Int, overall: Int
    var grade: String { gradeOf(overall) }
    var tq: TrendQuality { trendQuality(passed) }
}

// MARK: - Constants (mirror the web app)

let MARKET_TREND: Double = 82
let TRIAL_DAYS = 60
let DEFAULT_UNIVERSE = ["NVDA", "IONQ", "HIMS", "IREN", "OSCR", "RCAT", "SLNH", "LUMN"]

enum Timeframe: String, CaseIterable {
    case daily, weekly
    var label: String { self == .daily ? "Daily · swing/position" : "Weekly · long-term" }
    var tag: String {
        self == .daily ? "Swing / position — days to months"
                       : "Long-term position — weekly view uses daily indicators for now"
    }
}

// MARK: - Scoring (1:1 port of trendChecks / pillars)

func clamp(_ n: Double) -> Int { max(0, min(100, Int(n.rounded()))) }

func trendChecks(_ d: StockData) -> [Bool] {
    let pctLow = (d.price - d.low52) / d.low52 * 100
    let pctHigh = (d.high52 - d.price) / d.high52 * 100
    return [
        d.price > d.sma150 && d.price > d.sma200,
        d.sma150 > d.sma200,
        d.trendUp,
        d.sma50 > d.sma150 && d.sma50 > d.sma200,
        d.price > d.sma50,
        pctLow >= 30,
        pctHigh <= 25,
        d.rs >= 70,
    ]
}

func rsiHealth(_ r: Double) -> Double {
    if r >= 55 && r <= 72 { return 100 }
    if r > 72 { return Double(clamp(100 - (r - 72) * 2.5)) }
    if r >= 45 { return Double(clamp(60 + (r - 45) * 4)) }
    return Double(clamp(r / 45 * 60))
}

func score(_ sym: String, _ d: StockData) -> ScoreResult {
    let passed = trendChecks(d).filter { $0 }.count
    let trend = clamp(Double(passed) / 8 * 100)
    let momentum = clamp(0.55 * d.rs + 0.45 * rsiHealth(d.rsi))
    let volume = clamp(50 + d.accumDays * 7 + (d.volRatio - 1) * 60)
    let risk = clamp(100 - (d.atrPct - 2) * 12)
    let market = clamp(0.5 * MARKET_TREND + 0.5 * d.sectorRS)
    let overall = clamp(0.3 * Double(trend) + 0.25 * Double(momentum) + 0.15 * Double(volume)
                        + 0.1 * Double(risk) + 0.2 * Double(market))
    return ScoreResult(sym: sym, passed: passed, trend: trend, momentum: momentum,
                       volume: volume, risk: risk, market: market, overall: overall)
}

func gradeOf(_ s: Int) -> String {
    s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 40 ? "D" : "F"
}

func gradeColor(_ g: String) -> Color {
    switch g {
    case "A": return T.pass
    case "B": return Color(hex: 0x86E0B0)
    case "C": return T.warn
    case "D": return Color(hex: 0xF0A35E)
    default:  return T.fail
    }
}

func gradeLabel(_ g: String) -> String {
    switch g {
    case "A": return "Elite Trend"
    case "B": return "Strong Trend"
    case "C": return "Neutral"
    case "D": return "Weak"
    default:  return "Failing Trend"
    }
}

func trendQuality(_ p: Int) -> TrendQuality {
    p >= 8 ? TrendQuality(dot: T.pass, label: "Strong Trend")
  : p >= 6 ? TrendQuality(dot: T.warn, label: "Watchlist")
  :          TrendQuality(dot: T.fail, label: "Weak Trend")
}

// MARK: - Demo fallback data

private struct Demo {
    let price, high52, low52, rsi, volRatio, accumDays, atrPct, sectorRS: Double
    let daily: (Double, Double, Double, Double, Bool)   // sma50, sma150, sma200, rs, trendUp
    let weekly: (Double, Double, Double, Double, Bool)
}

private let DEMO: [String: Demo] = [
    "NVDA": Demo(price: 171.4, high52: 180, low52: 98, rsi: 63, volRatio: 1.35, accumDays: 4, atrPct: 2.4, sectorRS: 90, daily: (158, 140, 128, 94, true), weekly: (150, 120, 105, 96, true)),
    "IONQ": Demo(price: 44.2, high52: 47, low52: 18, rsi: 66, volRatio: 1.5, accumDays: 3, atrPct: 5.5, sectorRS: 85, daily: (39, 31, 27, 91, true), weekly: (36, 28, 24, 90, true)),
    "HIMS": Demo(price: 58.9, high52: 63, low52: 31, rsi: 58, volRatio: 1.1, accumDays: 2, atrPct: 4.0, sectorRS: 72, daily: (52, 44, 38, 88, true), weekly: (50, 42, 39, 84, false)),
    "IREN": Demo(price: 18.7, high52: 20, low52: 7.4, rsi: 61, volRatio: 1.25, accumDays: 3, atrPct: 6.0, sectorRS: 80, daily: (16.2, 13, 11.2, 86, true), weekly: (15, 12, 10, 88, true)),
    "OSCR": Demo(price: 22.6, high52: 24, low52: 13.4, rsi: 54, volRatio: 0.95, accumDays: 1, atrPct: 3.5, sectorRS: 65, daily: (20.1, 17.5, 16.2, 76, true), weekly: (19, 16, 15, 78, true)),
    "RCAT": Demo(price: 12.1, high52: 13.5, low52: 4.9, rsi: 49, volRatio: 1.05, accumDays: 0, atrPct: 7.0, sectorRS: 60, daily: (10.4, 8.2, 7.1, 82, true), weekly: (9.5, 8.0, 8.4, 74, false)),
    "SLNH": Demo(price: 9.8, high52: 14, low52: 6.2, rsi: 42, volRatio: 0.85, accumDays: -2, atrPct: 6.5, sectorRS: 45, daily: (9.1, 8.7, 8.9, 64, false), weekly: (9.4, 9.6, 9.9, 58, false)),
    "LUMN": Demo(price: 4.9, high52: 9.5, low52: 4.1, rsi: 35, volRatio: 0.8, accumDays: -4, atrPct: 5.0, sectorRS: 30, daily: (5.2, 5.6, 6.0, 33, false), weekly: (5.3, 5.8, 6.2, 30, false)),
]

func hasDemo(_ sym: String) -> Bool { DEMO[sym] != nil }

func demoData(_ sym: String, _ tf: Timeframe) -> StockData? {
    guard let d = DEMO[sym] else { return nil }
    let t = tf == .daily ? d.daily : d.weekly
    return StockData(price: d.price, high52: d.high52, low52: d.low52, rsi: d.rsi,
                     volRatio: d.volRatio, accumDays: d.accumDays, atrPct: d.atrPct,
                     sectorRS: d.sectorRS, sma50: t.0, sma150: t.1, sma200: t.2,
                     rs: t.3, trendUp: t.4)
}
