import AppKit

@MainActor
final class StatusBarController: NSObject {
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var refreshTimer: Timer?
    private var latestSummary: UsageSummary?
    private var latestErrorText: String?
    private var settingsWindowController: SettingsWindowController?

    // The TokenBoard logomark, as a template image so it adapts to the menu-bar appearance.
    private lazy var logoImage: NSImage? = Self.loadLogo()

    private static func loadLogo() -> NSImage? {
        guard let url = Bundle.main.url(forResource: "logomark-mono", withExtension: "svg"),
              let img = NSImage(contentsOf: url) else { return nil }
        img.isTemplate = true
        img.size = NSSize(width: 15, height: 15)
        return img
    }

    private func applyLogo(to button: NSButton) {
        button.image = logoImage
        button.imagePosition = logoImage != nil ? .imageLeading : .noImage
    }

    override init() {
        super.init()
        if let button = statusItem.button {
            applyLogo(to: button)
            button.title = logoImage != nil ? " —" : "TB —"
        }
        statusItem.menu = buildMenu()

        Task { await refresh() }

        // Refresh every ~60s so the bar number stays roughly current without
        // spamming the API. Opening the menu also forces a fresh fetch.
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.refresh() }
        }
    }

    // MARK: - Networking

    private func refresh() async {
        do {
            let summary = try await APIClient.fetchUsageSummary()
            latestSummary = summary
            latestErrorText = nil
        } catch let error as APIError {
            latestSummary = nil
            latestErrorText = error.errorDescription ?? "No local data"
        } catch {
            latestSummary = nil
            latestErrorText = "No local data"
        }
        updateStatusTitle()
        statusItem.menu = buildMenu()
    }

    private func updateStatusTitle() {
        guard let button = statusItem.button else { return }
        applyLogo(to: button)
        let prefix = logoImage != nil ? " " : "TB "
        if let summary = latestSummary {
            button.title = "\(prefix)\(TokenFormat.compact(summary.todayTokens))"
        } else {
            button.title = "\(prefix)—"
        }
    }

    // MARK: - Menu

    private func buildMenu() -> NSMenu {
        let menu = NSMenu()

        if let summary = latestSummary {
            menu.addItem(disabledItem("Today: \(TokenFormat.full(summary.todayTokens)) tokens"))
            menu.addItem(disabledItem("This week: \(TokenFormat.full(summary.weekTokens)) tokens"))
            menu.addItem(disabledItem("All time: \(TokenFormat.full(summary.totalTokens)) tokens"))
        } else {
            menu.addItem(disabledItem(latestErrorText ?? "Not connected"))
        }

        menu.addItem(.separator())

        let syncItem = NSMenuItem(title: "Sync Now", action: #selector(syncNow), keyEquivalent: "r")
        syncItem.target = self
        menu.addItem(syncItem)

        let dashboardItem = NSMenuItem(title: "Open Dashboard", action: #selector(openDashboard), keyEquivalent: "d")
        dashboardItem.target = self
        menu.addItem(dashboardItem)

        // NOTE: selector must NOT be named `openSettings(_:)` — AppKit treats
        // that as the system Settings action and injects its own gear image.
        let settingsItem = NSMenuItem(title: "Settings…", action: #selector(openSettingsWindow), keyEquivalent: ",")
        settingsItem.target = self
        menu.addItem(settingsItem)

        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        return menu
    }

    private func disabledItem(_ title: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.isEnabled = false
        return item
    }

    // MARK: - Actions

    @objc private func syncNow() {
        // The CLI owns syncing (via `tokenboard sync` / its background
        // scheduler) — this just re-fetches the summary so the bar reflects
        // whatever the CLI has already uploaded.
        Task { await refresh() }
    }

    @objc private func openDashboard() {
        guard let base = URL(string: ConfigStore.baseURLString) else { return }
        NSWorkspace.shared.open(base.appendingPathComponent("dashboard"))
    }

    @objc private func openSettingsWindow() {
        let controller = settingsWindowController ?? SettingsWindowController(onSave: { [weak self] in
            Task { await self?.refresh() }
        })
        settingsWindowController = controller
        controller.show()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
