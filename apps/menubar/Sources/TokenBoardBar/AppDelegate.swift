import AppKit
import SwiftUI

/// Minimal NSStatusItem-backed app. The status bar shows the current "today"
/// token count with a small icon. Clicking opens a SwiftUI popover with the
/// fuller summary view.
@main
@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!
    private var refreshTimer: Timer?
    private let viewModel = UsageViewModel()

    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            button.image = Self.barIcon()
            button.image?.isTemplate = true
            button.imagePosition = .imageLeading
            button.action = #selector(togglePopover(_:))
            button.target = self
            button.title = "  …"
        }

        popover = NSPopover()
        popover.behavior = .transient
        popover.animates = true
        popover.contentSize = NSSize(width: 360, height: 480)
        popover.contentViewController = NSHostingController(
            rootView: UsageView()
                .environmentObject(viewModel)
                .frame(width: 360, height: 480)
        )

        viewModel.onSummaryChange = { [weak self] summary in
            DispatchQueue.main.async {
                self?.updateBarTitle(with: summary)
            }
        }
        viewModel.start()

        // Refresh every 5 minutes so the bar number stays roughly current
        // without spamming the API. Popover opens force a manual refresh.
        // The closure is non-isolated, so hop back to MainActor explicitly.
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.viewModel.refresh() }
        }
    }

    @objc func togglePopover(_ sender: AnyObject?) {
        guard let button = statusItem.button else { return }
        if popover.isShown {
            popover.performClose(sender)
            return
        }
        viewModel.refresh()
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        popover.contentViewController?.view.window?.makeKey()
    }

    private func updateBarTitle(with summary: UsageSummary?) {
        guard let button = statusItem.button else { return }
        if let s = summary {
            // Show today's count (resets at local midnight) — matches the
            // popover's highlighted "Today" card so the user sees one number
            // they can reason about at a glance.
            button.title = "  " + Formatter.compact(s.today)
        } else {
            button.title = "  —"
        }
    }

    /// Tiny stacked-bar icon, NSImage-rendered template-style so it tints with
    /// the system status bar (dark/light auto).
    private static func barIcon() -> NSImage? {
        let size = NSSize(width: 18, height: 14)
        let image = NSImage(size: size, flipped: false) { rect in
            NSColor.labelColor.setFill()
            let bar1 = NSBezierPath(roundedRect: NSRect(x: 1, y: 0, width: 4, height: 6), xRadius: 1, yRadius: 1)
            let bar2 = NSBezierPath(roundedRect: NSRect(x: 7, y: 0, width: 4, height: 10), xRadius: 1, yRadius: 1)
            let bar3 = NSBezierPath(roundedRect: NSRect(x: 13, y: 0, width: 4, height: 14), xRadius: 1, yRadius: 1)
            bar1.fill()
            bar2.fill()
            bar3.fill()
            return true
        }
        image.isTemplate = true
        return image
    }
}
