import Foundation

/// Shape returned by `GET /api/usage/summary?tz=...`. Token totals travel as
/// strings (bigint-as-string, matching every other TokenBoard read endpoint)
/// so we parse defensively rather than assume they fit a JS-safe integer.
struct UsageSummary: Decodable {
    struct Totals: Decodable {
        let today: String
        let week: String
        let month: String
        let total: String
    }

    let tz: String
    let totals: Totals

    var todayTokens: Int64 { Int64(totals.today) ?? 0 }
    var weekTokens: Int64 { Int64(totals.week) ?? 0 }
    var totalTokens: Int64 { Int64(totals.total) ?? 0 }
}

enum TokenFormat {
    static func full(_ v: Int64) -> String {
        let nf = NumberFormatter()
        nf.numberStyle = .decimal
        return nf.string(from: NSNumber(value: v)) ?? String(v)
    }

    static func compact(_ v: Int64) -> String {
        let absValue = v < 0 ? -v : v
        if absValue < 1_000 { return String(v) }
        if absValue < 1_000_000 { return String(format: "%.1fK", Double(v) / 1_000) }
        if absValue < 1_000_000_000 { return String(format: "%.1fM", Double(v) / 1_000_000) }
        return String(format: "%.2fB", Double(v) / 1_000_000_000)
    }
}
