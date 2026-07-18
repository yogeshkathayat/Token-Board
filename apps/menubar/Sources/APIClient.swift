import Foundation

enum APIError: Error, LocalizedError {
    case noLocalData
    case decode

    var errorDescription: String? {
        switch self {
        case .noLocalData: return "No local usage yet — run: tokenboard sync"
        case .decode: return "Couldn't read local summary file"
        }
    }
}

/// Reads the local usage summary the CLI writes on every `tokenboard sync`
/// (`~/.tokenboard/summary.json`). Fully local: no server, no auth, works offline.
/// The dashboard and leaderboard remain server-backed (they need the shared DB); this
/// menu-bar widget only ever shows THIS machine's collected usage.
enum APIClient {
    static func fetchUsageSummary() async throws -> UsageSummary {
        guard let data = ConfigStore.readSummaryData() else {
            throw APIError.noLocalData
        }
        guard let summary = try? JSONDecoder().decode(UsageSummary.self, from: data) else {
            throw APIError.decode
        }
        return summary
    }
}
