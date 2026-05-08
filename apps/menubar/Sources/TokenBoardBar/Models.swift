import Foundation

/// What the bar app needs from the server, all in one struct.
struct UsageSummary: Equatable {
    var today: Int64
    var sevenDay: Int64
    var thirtyDay: Int64
    var total: Int64
    var byModel: [(model: String, tokens: Int64)]
    var sources: [(source: String, tokens: Int64)]
    var activeDays7: Int
    var lastSyncAt: Date?

    static func == (lhs: UsageSummary, rhs: UsageSummary) -> Bool {
        lhs.today == rhs.today
            && lhs.sevenDay == rhs.sevenDay
            && lhs.thirtyDay == rhs.thirtyDay
            && lhs.total == rhs.total
            && lhs.activeDays7 == rhs.activeDays7
    }
}

/// On-disk config written by the CLI's `tokenboard init` flow.
struct CLIConfig: Decodable {
    let base_url: String
    let device_id: String?
    let device_token: String?
    let user: User?

    struct User: Decodable {
        let id: String?
    }

    static func load() -> CLIConfig? {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let path = home.appendingPathComponent(".tokenboard").appendingPathComponent("config.json")
        guard let data = try? Data(contentsOf: path) else { return nil }
        return try? JSONDecoder().decode(CLIConfig.self, from: data)
    }
}

// --- API response shapes -----------------------------------------------------

struct SummaryResponse: Decodable {
    struct Totals: Decodable {
        let total_tokens: String
    }
    let totals: Totals
}

struct DailyResponse: Decodable {
    struct Row: Decodable {
        let day: String
        let total_tokens: String
    }
    let data: [Row]
}

struct ModelBreakdownResponse: Decodable {
    struct Source: Decodable {
        let source: String
        struct Totals: Decodable { let total_tokens: String }
        let totals: Totals
        struct Model: Decodable {
            let source: String
            let model: String
            let total_tokens: String
        }
        let models: [Model]
    }
    let sources: [Source]
}
