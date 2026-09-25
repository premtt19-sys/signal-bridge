import Foundation

// ┌─────────────────────────────────────────────────────────────────────┐
// │ Point this at your Next.js backend. The web app used a relative     │
// │ path ("/api/scan"); a phone needs the full URL.                      │
// │  • Simulator + `npm run dev` on the same Mac: http://localhost:3000  │
// │  • Real iPhone on same Wi-Fi: http://<your-Mac-LAN-IP>:3000          │
// │  • Production: https://your-deployed-domain.com                      │
// └─────────────────────────────────────────────────────────────────────┘
enum API {
    static var baseURL = URL(string: "Prems-Mac-Studio.local:3001")!
    static let scanPath = "/api/scan"
}

/// One row from /api/scan — same fields `rowToData` reads on the web.
struct ScanRow: Decodable {
    let ticker: String?
    let price: Double?
    let high52: Double?
    let low52: Double?
    let rsi: Double?
    let volRatio: Double?
    let accumDays: Double?
    let atrPct: Double?
    let sectorRS: Double?
    let sma50: Double?
    let sma150: Double?
    let sma200: Double?
    let rs: Double?
    let trendUp: Bool?
    let error: String?

    /// Port of `rowToData` with the same defaults.
    func toData() throws -> StockData {
        if let error { throw ScanError.message(error) }
        guard let price, let high52, let low52, let sma50, let sma150, let sma200 else {
            throw ScanError.message("Incomplete data for \(ticker ?? "ticker")")
        }
        return StockData(price: price, high52: high52, low52: low52,
                         rsi: rsi ?? 50, volRatio: volRatio ?? 1, accumDays: accumDays ?? 0,
                         atrPct: atrPct ?? 3, sectorRS: sectorRS ?? 60,
                         sma50: sma50, sma150: sma150, sma200: sma200,
                         rs: rs ?? 50, trendUp: trendUp ?? false)
    }
}

private struct ScanResponse: Decodable {
    let results: [ScanRow]?
    let error: String?
}

enum ScanError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let m) = self { return m }; return nil }
}

/// Port of `fetchTickers`.
func fetchTickers(_ tickers: [String]) async throws -> [ScanRow] {
    var comps = URLComponents(url: API.baseURL.appendingPathComponent(API.scanPath),
                              resolvingAgainstBaseURL: false)!
    let list = tickers.map { $0.trimmingCharacters(in: .whitespaces).uppercased() }.joined(separator: ",")
    comps.queryItems = [URLQueryItem(name: "tickers", value: list)]

    let (data, response) = try await URLSession.shared.data(from: comps.url!)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    let json = try? JSONDecoder().decode(ScanResponse.self, from: data)

    guard (200..<300).contains(status) else {
        throw ScanError.message(json?.error ?? "Scan failed")
    }
    return json?.results ?? []
}
