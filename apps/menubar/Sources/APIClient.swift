import Foundation

enum APIError: Error, LocalizedError {
    case notConfigured
    case insecureTransport
    case http(Int)
    case decode

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Not connected"
        case .insecureTransport: return "Refusing to send the token over plain HTTP to a remote host"
        case .http(let code): return "HTTP \(code)"
        case .decode: return "Bad response from server"
        }
    }
}

/// A device/user token may travel in cleartext only to this machine. For any
/// remote host we require https so the long-lived credential isn't exposed
/// on the wire.
private func isTransportAllowed(_ url: URL) -> Bool {
    if url.scheme == "https" { return true }
    let host = url.host?.lowercased() ?? ""
    return host == "localhost" || host == "127.0.0.1" || host == "::1" || host.hasSuffix(".local")
}

enum APIClient {
    static func fetchUsageSummary() async throws -> UsageSummary {
        guard let token = ConfigStore.authToken, !token.isEmpty else {
            throw APIError.notConfigured
        }
        guard let base = URL(string: ConfigStore.baseURLString) else {
            throw APIError.notConfigured
        }
        guard isTransportAllowed(base) else {
            throw APIError.insecureTransport
        }

        guard var comps = URLComponents(
            url: base.appendingPathComponent("api/usage/summary"),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.notConfigured
        }
        comps.queryItems = [URLQueryItem(name: "tz", value: TimeZone.current.identifier)]
        guard let url = comps.url else { throw APIError.notConfigured }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        // Bound the request — URLSession.shared's default 60s/7-day timeouts
        // would hang the always-running background refresh on a dead host.
        request.timeoutInterval = 15
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.http(0)
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.http(http.statusCode)
        }
        guard let summary = try? JSONDecoder().decode(UsageSummary.self, from: data) else {
            throw APIError.decode
        }
        return summary
    }
}
