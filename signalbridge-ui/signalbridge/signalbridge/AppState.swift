import SwiftUI
import Combine

struct WatchItem: Codable, Identifiable {
    let id: Double
    let sym: String
    let overall: Int
    let grade: String
    let passed: Int      // stored instead of a color; the dot is recomputed from it
}

let SAMPLE_READ = "Leaders are holding their Stage 2 trends while the weak names roll over — exactly the separation you want to see. I'm keeping the watchlist tight and stops tighter, and I'm not touching anything extended. Patience pays here.\n\nWatching, not chasing. 👀"

enum Tab: String, CaseIterable {
    case score, trends, watch, read
    var icon: String { ["score": "📊", "trends": "🔥", "watch": "⭐", "read": "🧠"][rawValue]! }
    var label: String { ["score": "Quick Score", "trends": "Strong Trends", "watch": "Watchlist", "read": "Weekly Read"][rawValue]! }
}

/// All the state the React component held in useState, plus its logic.
@MainActor
final class AppState: ObservableObject {
    @Published var tab: Tab = .score
    @Published var ticker = ""
    @Published var timeframe: Timeframe = .daily
    @Published var result: ScoreResult?
    @Published var error = ""
    @Published var loading = false

    @Published var ranked: [ScoreResult] = []
    @Published var rankedLoading = true
    @Published var rankedError = ""

    @Published var watchlist: [WatchItem] = []
    @Published var isMember = false
    @Published var read = SAMPLE_READ
    @Published var editing = false
    @Published var daysLeft = TRIAL_DAYS
    @Published var showWelcome = false
    @Published var reminderOff = false

    private let defaults = UserDefaults.standard

    init() {
        // Replaces localStorage.
        if let data = defaults.data(forKey: "app_watchlist"),
           let list = try? JSONDecoder().decode([WatchItem].self, from: data) {
            watchlist = list
        }
        if let r = defaults.string(forKey: "app_read") { read = r }

        let start: Double
        if defaults.object(forKey: "trial_start") != nil {
            start = defaults.double(forKey: "trial_start")
        } else {
            start = Date().timeIntervalSince1970
            defaults.set(start, forKey: "trial_start")
            showWelcome = true
        }
        let days = Int((Date().timeIntervalSince1970 - start) / 86400)
        daysLeft = max(0, TRIAL_DAYS - days)

        Task { await loadRanked() }
    }

    // MARK: Strong Trends

    func loadRanked() async {
        rankedLoading = true
        rankedError = ""
        do {
            let rows = try await fetchTickers(DEFAULT_UNIVERSE)
            ranked = rows.compactMap { r in
                guard r.error == nil, r.price != nil, let sym = r.ticker,
                      let d = try? r.toData() else { return nil }
                return score(sym, d)
            }.sorted { $0.overall > $1.overall }
        } catch {
            rankedError = error.localizedDescription
            ranked = DEFAULT_UNIVERSE.compactMap { sym in
                demoData(sym, .daily).map { score(sym, $0) }
            }.sorted { $0.overall > $1.overall }
        }
        rankedLoading = false
    }

    // MARK: Quick Score

    func scoreSymbol(_ raw: String) async {
        let sym = raw.trimmingCharacters(in: .whitespaces).uppercased()
        error = ""
        guard !sym.isEmpty else { error = "Type a ticker."; return }

        loading = true
        result = nil
        defer { loading = false }

        do {
            let rows = try await fetchTickers([sym])
            guard let row = rows.first(where: { ($0.ticker ?? "").uppercased() == sym }) ?? rows.first else {
                throw ScanError.message("No data for \(sym)")
            }
            let d: StockData
            if timeframe == .weekly, let demo = demoData(sym, .weekly) { d = demo }
            else { d = try row.toData() }
            result = score(sym, d)
        } catch {
            let msg = error.localizedDescription
            if timeframe == .weekly, let demo = demoData(sym, .weekly) {
                result = score(sym, demo)
            } else if hasDemo(sym), msg.contains("FMP_API_KEY"), let demo = demoData(sym, timeframe) {
                result = score(sym, demo)
                self.error = "Live data unavailable — showing demo scores. Add FMP_API_KEY to .env.local"
            } else {
                self.error = msg
            }
        }
    }

    func openFromTrends(_ sym: String) {
        ticker = sym
        tab = .score
        Task { await scoreSymbol(sym) }
    }

    // MARK: Watchlist / Read persistence

    func persistWatch(_ list: [WatchItem]) {
        watchlist = list
        if let data = try? JSONEncoder().encode(list) { defaults.set(data, forKey: "app_watchlist") }
    }

    func saveToWatch() {
        guard let r = result else { return }
        let e = WatchItem(id: Date().timeIntervalSince1970, sym: r.sym, overall: r.overall,
                          grade: r.grade, passed: r.passed)
        persistWatch(([e] + watchlist.filter { $0.sym != e.sym }).sorted { $0.overall > $1.overall })
    }

    func removeWatch(_ item: WatchItem) {
        persistWatch(watchlist.filter { $0.id != item.id })
    }

    func saveRead(_ v: String) {
        read = v
        defaults.set(v, forKey: "app_read")
    }
}
