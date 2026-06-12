import Foundation
import Combine

@MainActor
final class UsageViewModel: ObservableObject {
    @Published private(set) var summary: UsageSummary?
    @Published private(set) var loading: Bool = false
    @Published private(set) var lastError: String?
    @Published var baseURLInput: String = ""
    @Published var tokenInput: String = ""

    var onSummaryChange: ((UsageSummary?) -> Void)?

    private var bag = Set<AnyCancellable>()

    func start() {
        baseURLInput = Settings.shared.baseURL?.absoluteString ?? ""
        // Don't prefill the token field — clearer UX for paste-to-replace.
        tokenInput = ""
        $summary
            .sink { [weak self] s in self?.onSummaryChange?(s) }
            .store(in: &bag)
        refresh()
    }

    var hasStoredToken: Bool {
        (Settings.shared.userToken ?? "").isEmpty == false
    }

    func saveCredentials() {
        if let url = URL(string: baseURLInput.trimmingCharacters(in: .whitespacesAndNewlines)),
           ["http", "https"].contains(url.scheme ?? "") {
            Settings.shared.baseURL = url
        }
        let trimmed = tokenInput.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            Settings.shared.userToken = trimmed
            tokenInput = ""
        }
        refresh()
    }

    func clearToken() {
        Settings.shared.userToken = nil
        tokenInput = ""
        summary = nil
        lastError = "Token cleared. Paste a new one and tap Done."
    }

    func refresh() {
        let url = Settings.shared.baseURL
        let token = Settings.shared.userToken
        guard let url = url, let token = token, !token.isEmpty else {
            self.summary = nil
            self.lastError = "Not connected — open Settings."
            return
        }
        loading = true
        lastError = nil
        let client = APIClient(baseURL: url, userToken: token)
        Task { [weak self] in
            // Run the CLI sync first so the API has up-to-the-second data.
            // Best-effort: if `tokenboard` isn't on PATH, fall through to a
            // plain API poll (matches the old behavior).
            await Self.runCLISync()
            do {
                // Use the user's local timezone so "today" means midnight-to-
                // midnight in their wallclock, not UTC. The API uses the
                // `tz` query param to align date boundaries.
                let tz = TimeZone.current.identifier
                let today = Self.todayLocal()
                let d6 = Self.daysAgoLocal(6)
                let d29 = Self.daysAgoLocal(29)

                async let todaySum = client.summary(from: today, to: today, tz: tz)
                async let week = client.summary(from: d6, to: today, tz: tz)
                async let month = client.summary(from: d29, to: today, tz: tz)
                // The API caps date ranges at USAGE_MAX_DAYS (default 800)
                // inclusive. daysAgo(798) → 799-day inclusive range, safely
                // under the cap. ~2y2m which is "all time" for any practical
                // engineer's tool history.
                async let total = client.summary(from: Self.daysAgoLocal(798), to: today, tz: tz)
                async let weekDaily = client.daily(from: d6, to: today, tz: tz)
                async let monthBreakdown = client.modelBreakdown(from: d29, to: today, tz: tz)

                let (todayR, weekR, monthR, totalR, weekDailyR, breakdownR) = try await (
                    todaySum, week, month, total, weekDaily, monthBreakdown
                )

                let activeDays = weekDailyR.data.filter { (Int64($0.total_tokens) ?? 0) > 0 }.count

                var modelTotals: [(String, Int64)] = []
                var sourceTotals: [(String, Int64)] = []
                for src in breakdownR.sources {
                    sourceTotals.append((src.source, Int64(src.totals.total_tokens) ?? 0))
                    for m in src.models {
                        modelTotals.append((m.model, Int64(m.total_tokens) ?? 0))
                    }
                }
                modelTotals.sort { $0.1 > $1.1 }
                sourceTotals.sort { $0.1 > $1.1 }

                let s = UsageSummary(
                    today: Int64(todayR.totals.total_tokens) ?? 0,
                    sevenDay: Int64(weekR.totals.total_tokens) ?? 0,
                    thirtyDay: Int64(monthR.totals.total_tokens) ?? 0,
                    total: Int64(totalR.totals.total_tokens) ?? 0,
                    byModel: Array(modelTotals.prefix(5)),
                    sources: Array(sourceTotals.prefix(8)),
                    activeDays7: activeDays,
                    lastSyncAt: Date()
                )
                await MainActor.run {
                    self?.summary = s
                    self?.loading = false
                }
            } catch {
                let msg = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                await MainActor.run {
                    self?.lastError = msg
                    self?.loading = false
                }
            }
        }
    }

    /// Spawn `tokenboard sync --force` and wait up to ~12s for it to finish.
    /// Best-effort — failures (missing binary, throttle, network) are logged
    /// and ignored so the API poll always runs.
    private static func runCLISync() async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            DispatchQueue.global(qos: .userInitiated).async {
                let p = Process()
                // Use a login shell so $PATH includes /usr/local/bin (npm) and
                // ~/.nvm/... where users typically install `tokenboard`.
                p.launchPath = "/bin/zsh"
                p.arguments = ["-lc", "tokenboard sync --force >/dev/null 2>&1"]
                let started = Date()
                do {
                    try p.run()
                } catch {
                    FileHandle.standardError.write(Data("[tokenboard] sync spawn failed: \(error.localizedDescription)\n".utf8))
                    cont.resume()
                    return
                }
                // Hard-timeout after 12s so the UI doesn't hang on a stuck sync.
                let deadline = DispatchTime.now() + .seconds(12)
                DispatchQueue.global().asyncAfter(deadline: deadline) {
                    if p.isRunning {
                        FileHandle.standardError.write(Data("[tokenboard] sync timed out — terminating\n".utf8))
                        p.terminate()
                    }
                }
                p.waitUntilExit()
                let dur = Int(Date().timeIntervalSince(started) * 1000)
                FileHandle.standardError.write(Data("[tokenboard] sync exited code=\(p.terminationStatus) in \(dur)ms\n".utf8))
                cont.resume()
            }
        }
    }

    private static func todayLocal() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        return f.string(from: Date())
    }

    /// Local-day arithmetic: subtract whole days using calendar (handles DST
    /// changes correctly), then format in the user's local timezone.
    private static func daysAgoLocal(_ n: Int) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone.current
        let date = cal.date(byAdding: .day, value: -n, to: Date()) ?? Date()
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        return f.string(from: date)
    }
}

enum Formatter {
    static let abs = NumberFormatter()

    static func full(_ v: Int64) -> String {
        let nf = NumberFormatter()
        nf.numberStyle = .decimal
        return nf.string(from: NSNumber(value: v)) ?? String(v)
    }

    static func compact(_ v: Int64) -> String {
        let abs = v < 0 ? -v : v
        if abs < 1_000 { return String(v) }
        if abs < 1_000_000 { return String(format: "%.1fK", Double(v) / 1_000) }
        if abs < 1_000_000_000 { return String(format: "%.1fM", Double(v) / 1_000_000) }
        return String(format: "%.2fB", Double(v) / 1_000_000_000)
    }
}
