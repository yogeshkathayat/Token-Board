import Foundation

/// User settings persisted via UserDefaults (URL) + a 0600 file (token).
///
/// We deliberately *don't* use Keychain for the access token: macOS Keychain
/// ACLs are tied to a specific signed binary identity, so every time we
/// rebuild this unsigned dev binary the previous-version's keychain entry
/// becomes unreadable (errSecUserCanceled / -128). For an unsigned local
/// helper the practical tradeoff is: store the token in a file under
/// `~/Library/Application Support/TokenBoard/token` with mode 0600. Same
/// blast radius as keeping it in `~/.tokenboard/config.json` (which the
/// CLI already does for device tokens).
final class Settings {
    static let shared = Settings()
    private let defaults = UserDefaults.standard

    private enum Keys {
        static let baseURL = "tb.baseURL"
    }

    var baseURL: URL? {
        get {
            if let s = defaults.string(forKey: Keys.baseURL), let u = URL(string: s) { return u }
            if let cfg = CLIConfig.load(), let u = URL(string: cfg.base_url) { return u }
            return nil
        }
        set {
            if let url = newValue {
                defaults.set(url.absoluteString, forKey: Keys.baseURL)
            } else {
                defaults.removeObject(forKey: Keys.baseURL)
            }
        }
    }

    private static var tokenFile: URL {
        let dir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/TokenBoard")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("token")
    }

    var userToken: String? {
        get {
            guard let data = try? Data(contentsOf: Self.tokenFile),
                  let s = String(data: data, encoding: .utf8) else { return nil }
            let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        set {
            let url = Self.tokenFile
            if let v = newValue, !v.isEmpty {
                let data = Data(v.utf8)
                try? data.write(to: url, options: .atomic)
                // mode 0600
                try? FileManager.default.setAttributes(
                    [.posixPermissions: 0o600], ofItemAtPath: url.path
                )
            } else {
                try? FileManager.default.removeItem(at: url)
            }
        }
    }
}

private enum Keychain {
    static func write(service: String, account: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        let status = SecItemAdd(add as CFDictionary, nil)
        if status != errSecSuccess {
            FileHandle.standardError.write(Data("[tokenboard] keychain write failed: \(status)\n".utf8))
        }
    }

    static func read(service: String, account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status != errSecSuccess {
            if status != errSecItemNotFound {
                FileHandle.standardError.write(Data("[tokenboard] keychain read failed: \(status)\n".utf8))
            }
            return nil
        }
        guard let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(service: String, account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
