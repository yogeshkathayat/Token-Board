import AppKit
import SwiftUI

struct SettingsView: View {
    @State private var baseURL: String = ConfigStore.baseURLString
    @State private var token: String = ""
    @State private var statusMessage: String?

    var onSave: () -> Void
    var onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Token Board Settings")
                .font(.headline)

            VStack(alignment: .leading, spacing: 4) {
                Text("Server URL")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("https://tokenboard.example.com", text: $baseURL)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Auth Token")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                SecureField("Paste a device or user token", text: $token)
                    .textFieldStyle(.roundedBorder)
                Text("Leave blank to keep using the CLI's device token from ~/.tokenboard/config.json, if present.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let statusMessage {
                Text(statusMessage)
                    .font(.caption)
                    .foregroundStyle(.green)
            }

            HStack {
                Button("Clear Saved Token", role: .destructive) {
                    ConfigStore.clearAuthToken()
                    statusMessage = "Cleared."
                    onSave()
                }
                Spacer()
                Button("Cancel") { onClose() }
                Button("Save") { save() }
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 380)
    }

    private func save() {
        let trimmedURL = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedURL.isEmpty {
            ConfigStore.setBaseURL(trimmedURL)
        }
        let trimmedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedToken.isEmpty {
            ConfigStore.setAuthToken(trimmedToken)
        }
        statusMessage = "Saved."
        onSave()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { onClose() }
    }
}

@MainActor
final class SettingsWindowController: NSObject, NSWindowDelegate {
    private var window: NSWindow?
    private let onSave: () -> Void

    init(onSave: @escaping () -> Void) {
        self.onSave = onSave
    }

    func show() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let view = SettingsView(
            onSave: { [weak self] in self?.onSave() },
            onClose: { [weak self] in self?.close() }
        )
        let hosting = NSHostingController(rootView: view)
        let newWindow = NSWindow(contentViewController: hosting)
        newWindow.title = "Token Board Settings"
        newWindow.styleMask = [.titled, .closable]
        newWindow.isReleasedWhenClosed = false
        newWindow.delegate = self
        newWindow.center()
        window = newWindow

        newWindow.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func close() {
        window?.close()
    }

    func windowWillClose(_ notification: Notification) {
        window = nil
    }
}
