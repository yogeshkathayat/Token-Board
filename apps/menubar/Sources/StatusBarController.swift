import AppKit
import SwiftUI

@MainActor
final class StatusBarController: NSObject {
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var refreshTimer: Timer?
    private var settingsWindowController: SettingsWindowController?

    private let popover = NSPopover()
    private let popoverModel = PopoverModel()

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

        popoverModel.onRefresh = { [weak self] in Task { await self?.refresh() } }
        popoverModel.onOpenDashboard = { [weak self] in self?.openDashboard() }
        popoverModel.onOpenSettings = { [weak self] in self?.openSettingsWindow() }
        popoverModel.onQuit = { NSApp.terminate(nil) }

        popover.behavior = .transient
        popover.contentViewController = NSHostingController(rootView: PopoverView(model: popoverModel))

        if let button = statusItem.button {
            applyLogo(to: button)
            button.title = logoImage != nil ? " —" : "TB —"
            button.action = #selector(togglePopover)
            button.target = self
        }

        Task { await refresh() }

        // Refresh every ~60s so the bar number stays roughly current without
        // spamming the file system. Opening the popover also forces a fresh read.
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.refresh() }
        }
    }

    // MARK: - Data

    private func refresh() async {
        do {
            let summary = try await APIClient.fetchUsageSummary()
            popoverModel.summary = summary
            popoverModel.errorText = nil
        } catch let error as APIError {
            popoverModel.summary = nil
            popoverModel.errorText = error.errorDescription ?? "No local data"
        } catch {
            popoverModel.summary = nil
            popoverModel.errorText = "No local data"
        }
        updateStatusTitle()
    }

    private func updateStatusTitle() {
        guard let button = statusItem.button else { return }
        applyLogo(to: button)
        let prefix = logoImage != nil ? " " : "TB "
        if let summary = popoverModel.summary {
            button.title = "\(prefix)\(TokenFormat.compact(summary.d7Tokens))"
        } else {
            button.title = "\(prefix)—"
        }
    }

    // MARK: - Popover

    @objc private func togglePopover() {
        if popover.isShown {
            popover.performClose(nil)
            return
        }
        Task { await refresh() }
        guard let button = statusItem.button else { return }
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - Actions

    private func openDashboard() {
        guard let base = URL(string: ConfigStore.baseURLString) else { return }
        NSWorkspace.shared.open(base.appendingPathComponent("dashboard"))
    }

    private func openSettingsWindow() {
        let controller = settingsWindowController ?? SettingsWindowController(onSave: { [weak self] in
            Task { await self?.refresh() }
        })
        settingsWindowController = controller
        controller.show()
    }
}
