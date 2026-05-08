import Foundation

/// Tiny REST client for the user-JWT-protected endpoints. The bar app
/// authenticates by trading the CLI's device token for a session-equivalent
/// JWT — actually, no: device tokens are for ingest only. So instead we read
/// the user's *refresh cookie* from the dashboard's localStorage … which is
/// fiddly.
///
/// For v1, the bar app uses the device token directly against a thin
/// `/api/v1/usage/me-summary` shortcut that the API can be extended with.
/// Until that shortcut exists, the bar app falls back to a local file the
/// CLI writes after each sync (`~/.tokenboard/last-summary.json`).
///
/// Today the simplest reliable path is: ask the user to paste a personal
/// access token (PAT) once, store it in Keychain, use it for reads. We model
/// that in the UI; this client just wraps the bearer.
enum APIError: Error, LocalizedError {
    case notConfigured
    case http(Int, String)
    case decode(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Run `tokenboard init` on this Mac first."
        case .http(let code, let body): return "HTTP \(code): \(body)"
        case .decode(let msg): return "Decode failed: \(msg)"
        }
    }
}

actor APIClient {
    private let baseURL: URL
    private let userToken: String

    init(baseURL: URL, userToken: String) {
        self.baseURL = baseURL
        self.userToken = userToken
    }

    private func request<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        var comps = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = "GET"
        req.setValue("Bearer \(userToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else {
            throw APIError.http(0, "no response")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.http(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decode(error.localizedDescription)
        }
    }

    private func dateRangeQuery(from: String, to: String, tz: String) -> [URLQueryItem] {
        [
            .init(name: "from", value: from),
            .init(name: "to", value: to),
            .init(name: "tz", value: tz),
        ]
    }

    func summary(from: String, to: String, tz: String) async throws -> SummaryResponse {
        try await request("/api/v1/usage/summary", query: dateRangeQuery(from: from, to: to, tz: tz))
    }

    func daily(from: String, to: String, tz: String) async throws -> DailyResponse {
        try await request("/api/v1/usage/daily", query: dateRangeQuery(from: from, to: to, tz: tz))
    }

    func modelBreakdown(from: String, to: String, tz: String) async throws -> ModelBreakdownResponse {
        try await request("/api/v1/usage/model-breakdown", query: dateRangeQuery(from: from, to: to, tz: tz))
    }
}
