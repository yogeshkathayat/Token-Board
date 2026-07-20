import Foundation

/// Shape written by the CLI to `~/.tokenboard/summary.json` on every
/// `tokenboard sync`. Token totals travel as strings (bigint-as-string,
/// matching every other TokenBoard read path) so we parse defensively
/// rather than assume they fit a JS-safe integer. Cost values are numbers.
struct UsageSummary: Decodable {
    struct Totals: Decodable {
        let today: String
        let d7: String
        let d30: String
        let total: String
        let week: String
        let month: String
    }

    struct Cost: Decodable {
        let today: Double
        let d7: Double
        let d30: Double
        let total: Double
    }

    struct DailyPoint: Decodable, Identifiable {
        let date: String
        let totalTokens: String

        enum CodingKeys: String, CodingKey {
            case date
            case totalTokens = "total_tokens"
        }

        var id: String { date }
        var tokens: Int64 { Int64(totalTokens) ?? 0 }
        var day: Date? { TokenFormat.isoDayFormatter.date(from: date) }
    }

    struct ModelUsage: Decodable, Identifiable {
        let model: String
        let totalTokens: String
        let pct: Double

        enum CodingKeys: String, CodingKey {
            case model
            case totalTokens = "total_tokens"
            case pct
        }

        var id: String { model }
        var tokens: Int64 { Int64(totalTokens) ?? 0 }
    }

    struct SourceUsage: Decodable {
        let source: String
        let totalTokens: String

        enum CodingKeys: String, CodingKey {
            case source
            case totalTokens = "total_tokens"
        }
    }

    let tz: String
    let generatedAt: String?
    let totals: Totals
    let cost: Cost
    let activeDaysTotal: Int
    let activeDays7: Int
    let avgPerDay30: String
    let daily: [DailyPoint]
    let byModel: [ModelUsage]
    let bySource: [SourceUsage]

    enum CodingKeys: String, CodingKey {
        case tz, totals, cost, daily
        case generatedAt = "generated_at"
        case activeDaysTotal = "active_days_total"
        case activeDays7 = "active_days_7"
        case avgPerDay30 = "avg_per_day_30"
        case byModel = "by_model"
        case bySource = "by_source"
    }

    var todayTokens: Int64 { Int64(totals.today) ?? 0 }
    var d7Tokens: Int64 { Int64(totals.d7) ?? 0 }
    var d30Tokens: Int64 { Int64(totals.d30) ?? 0 }
    var totalTokens: Int64 { Int64(totals.total) ?? 0 }
    var weekTokens: Int64 { Int64(totals.week) ?? 0 }
    var avgPerDay30Tokens: Int64 { Int64(avgPerDay30) ?? 0 }
}

enum TokenFormat {
    static let isoDayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

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

    static func cost(_ v: Double) -> String {
        String(format: "$%.2f", v)
    }
}
