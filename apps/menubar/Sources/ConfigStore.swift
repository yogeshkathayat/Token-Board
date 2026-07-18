import Foundation

/// Resolves the server URL and auth token from two places, in priority order:
///
/// 1. This app's own config under `~/Library/Application Support/TokenBoard/`
///    (written by the Settings window — an explicit user override always wins).
/// 2. The CLI's `~/.tokenboard/config.json` (written by `tokenboard init` /
///    `tokenboard link`) — read-only from here, never modified by the bar app.
///
/// The auth token is stored in a 0600 file rather than Keychain: every
/// unsigned dev rebuild changes the binary's on-disk identity, and macOS
/// Keychain ACLs default to "this exact binary only". A rebuild would make
/// the previous entry unreadable (errSecUserCanceled / -128). A 0600 file
/// has the same effective blast radius (readable only by this OS user)
/// without that rebuild-breaks-auth footgun.
enum ConfigStore {
    private static let appSupportDir: URL = {
        let dir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/TokenBoard", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private static var localConfigPath: URL { appSupportDir.appendingPathComponent("config.json") }
    private static var tokenPath: URL { appSupportDir.appendingPathComponent("token") }

    private static var cliConfigPath: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".tokenboard/config.json")
    }

    /// The local usage summary written by `tokenboard sync` (CLI location wins; the app's own
    /// support dir is a fallback). This is the sole data source for the menu bar — no network,
    /// no auth. The dashboard/leaderboard remain server-backed.
    private static var cliSummaryPath: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".tokenboard/summary.json")
    }
    private static var localSummaryPath: URL { appSupportDir.appendingPathComponent("summary.json") }

    static func readSummaryData() -> Data? {
        if let d = try? Data(contentsOf: cliSummaryPath) { return d }
        if let d = try? Data(contentsOf: localSummaryPath) { return d }
        return nil
    }

    private struct LocalConfig: Codable {
        var baseUrl: String?
    }

    /// Matches the CLI's on-disk shape (apps/cli/src/lib/config.js CONFIG_KEYS):
    /// camelCase keys, `deviceToken` is the long-lived device credential.
    private struct CLIConfig: Decodable {
        let baseUrl: String?
        let deviceToken: String?
    }

    private static func readLocalConfig() -> LocalConfig {
        guard let data = try? Data(contentsOf: localConfigPath),
              let cfg = try? JSONDecoder().decode(LocalConfig.self, from: data) else {
            return LocalConfig(baseUrl: nil)
        }
        return cfg
    }

    private static func readCLIConfig() -> CLIConfig? {
        guard let data = try? Data(contentsOf: cliConfigPath) else { return nil }
        return try? JSONDecoder().decode(CLIConfig.self, from: data)
    }

    static var baseURLString: String {
        let local = readLocalConfig()
        if let url = local.baseUrl, !url.isEmpty { return url }
        if let cli = readCLIConfig(), let url = cli.baseUrl, !url.isEmpty { return url }
        return "http://localhost:3000"
    }

    static func setBaseURL(_ url: String) {
        var cfg = readLocalConfig()
        cfg.baseUrl = url
        writeLocalConfig(cfg)
    }

    private static func writeLocalConfig(_ cfg: LocalConfig) {
        guard let data = try? JSONEncoder().encode(cfg) else { return }
        FileManager.default.createFile(
            atPath: localConfigPath.path, contents: data, attributes: [.posixPermissions: 0o600]
        )
    }

    /// Resolution order: user-pasted token (Settings) > CLI's device token.
    static var authToken: String? {
        if let pasted = readPastedToken(), !pasted.isEmpty { return pasted }
        if let cli = readCLIConfig(), let token = cli.deviceToken, !token.isEmpty { return token }
        return nil
    }

    private static func readPastedToken() -> String? {
        // Don't trust a token file that is group/world-accessible — another
        // local user may have written or read it. Treat it as absent.
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: tokenPath.path),
              let perms = (attrs[.posixPermissions] as? NSNumber)?.intValue else {
            return nil
        }
        if (perms & 0o077) != 0 {
            FileHandle.standardError.write(
                Data("[tokenboard] token file has unsafe permissions (\(String(perms, radix: 8))); ignoring\n".utf8))
            return nil
        }
        guard let data = try? Data(contentsOf: tokenPath),
              let s = String(data: data, encoding: .utf8) else { return nil }
        let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    static func setAuthToken(_ token: String) {
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        // Create with 0600 from the start so the token is never briefly
        // world-readable between write and chmod.
        FileManager.default.createFile(
            atPath: tokenPath.path, contents: Data(trimmed.utf8), attributes: [.posixPermissions: 0o600]
        )
    }

    static func clearAuthToken() {
        try? FileManager.default.removeItem(at: tokenPath)
    }
}
