import SwiftUI

struct UsageView: View {
    @EnvironmentObject var vm: UsageViewModel
    @State private var showSettings: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
            if showSettings {
                SettingsView(showSettings: $showSettings)
                    .padding(16)
            } else if vm.summary == nil {
                ConnectPrompt(error: vm.lastError, onSettings: { showSettings = true }, onRetry: { vm.refresh() })
                    .padding(16)
            } else {
                contentView
            }
            Spacer(minLength: 0)
            Divider()
            footer
        }
        .background(Color(NSColor.windowBackgroundColor))
    }

    private var header: some View {
        HStack {
            Text("Token Board")
                .font(.system(size: 14, weight: .semibold))
            Spacer()
            if vm.loading {
                ProgressView().scaleEffect(0.5).frame(width: 14, height: 14)
            } else {
                Button(action: { vm.refresh() }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 11, weight: .medium))
                }
                .buttonStyle(.borderless)
                .help("Refresh")
            }
            Button(action: { showSettings.toggle() }) {
                Image(systemName: "gearshape")
                    .font(.system(size: 12))
            }
            .buttonStyle(.borderless)
            .help("Settings")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var contentView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let s = vm.summary {
                    statsGrid(s: s)
                    if !s.sources.isEmpty {
                        sourcesSection(s: s)
                    }
                    if !s.byModel.isEmpty {
                        modelsSection(s: s)
                    }
                    if let err = vm.lastError {
                        Text(err).font(.caption).foregroundStyle(.red)
                    }
                }
            }
            .padding(14)
        }
    }

    private func statsGrid(s: UsageSummary) -> some View {
        let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]
        return LazyVGrid(columns: columns, spacing: 8) {
            statCard("TODAY", value: s.today, accent: true)
            statCard("7-DAY", value: s.sevenDay, hint: "\(s.activeDays7) active days")
            statCard("30-DAY", value: s.thirtyDay)
            statCard("TOTAL", value: s.total, hint: "all time")
        }
    }

    private func statCard(_ label: String, value: Int64, accent: Bool = false, hint: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .tracking(1)
                .foregroundStyle(.secondary)
            Text(Formatter.compact(value))
                .font(.system(size: 18, weight: .bold, design: .monospaced))
                .foregroundStyle(accent ? AnyShapeStyle(LinearGradient(colors: [.purple, .cyan], startPoint: .leading, endPoint: .trailing)) : AnyShapeStyle(.primary))
            if let hint = hint {
                Text(hint).font(.system(size: 9)).foregroundStyle(.tertiary)
            } else {
                Text(" ").font(.system(size: 9))
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(accent ? Color.accentColor.opacity(0.08) : Color.gray.opacity(0.06))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(accent ? Color.accentColor.opacity(0.25) : Color.gray.opacity(0.18), lineWidth: 0.5)
        )
    }

    private func sourcesSection(s: UsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("SOURCES (30-DAY)")
                .font(.system(size: 9, weight: .bold))
                .tracking(1)
                .foregroundStyle(.secondary)
            ForEach(s.sources, id: \.source) { row in
                HStack(spacing: 8) {
                    Text(displayName(for: row.source))
                        .font(.system(size: 12))
                    Spacer()
                    Text(Formatter.full(row.tokens))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func modelsSection(s: UsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("TOP MODELS (30-DAY)")
                .font(.system(size: 9, weight: .bold))
                .tracking(1)
                .foregroundStyle(.secondary)
            ForEach(s.byModel.prefix(5), id: \.model) { row in
                HStack(spacing: 8) {
                    Text(row.model)
                        .font(.system(size: 11))
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    Text(Formatter.compact(row.tokens))
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var footer: some View {
        HStack {
            if let url = Settings.shared.baseURL {
                Button(action: {
                    NSWorkspace.shared.open(url)
                }) {
                    Label("Open dashboard", systemImage: "safari")
                        .font(.system(size: 11))
                }
                .buttonStyle(.borderless)
            }
            Spacer()
            Button("Quit") { NSApp.terminate(nil) }
                .font(.system(size: 11))
                .buttonStyle(.borderless)
                .keyboardShortcut("q")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private func displayName(for source: String) -> String {
        switch source {
        case "claude": return "Claude"
        case "codex": return "Codex"
        case "gemini": return "Gemini"
        case "opencode": return "OpenCode"
        case "kiro": return "Kiro"
        case "cursor": return "Cursor"
        case "copilot": return "Copilot"
        case "openrouter": return "OpenRouter"
        default: return source
        }
    }
}

struct ConnectPrompt: View {
    var error: String?
    var onSettings: () -> Void
    var onRetry: () -> Void

    private var hasConfig: Bool {
        Settings.shared.baseURL != nil && (Settings.shared.userToken?.isEmpty == false)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(hasConfig ? "Couldn't reach Token Board" : "Not connected")
                .font(.system(size: 13, weight: .semibold))
            if hasConfig {
                if let err = error {
                    Text(err)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.red)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color.red.opacity(0.1)))
                } else {
                    Text("No data yet. Try refreshing.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                Text("Server: \(Settings.shared.baseURL?.absoluteString ?? "(unset)")")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.tertiary)
                HStack {
                    Button("Retry", action: onRetry)
                        .buttonStyle(.borderedProminent)
                    Button("Open Settings", action: onSettings)
                        .buttonStyle(.bordered)
                }
            } else {
                Text("Paste your Token Board personal access token in Settings to start showing usage. The token is stored in your macOS Keychain.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                Button("Open Settings", action: onSettings)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.regular)
            }
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var vm: UsageViewModel
    @Binding var showSettings: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Settings").font(.system(size: 13, weight: .semibold))
                Spacer()
                Button("Done") {
                    vm.saveCredentials()
                    showSettings = false
                }
                .keyboardShortcut(.return)
                .controlSize(.regular)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Server URL").font(.caption)
                TextField("https://usage.your-company.com", text: $vm.baseURLInput)
                    .textFieldStyle(.roundedBorder)
                Text("Pre-filled from ~/.tokenboard/config.json if you've run `tokenboard init`.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text("Personal access token").font(.caption)
                    Spacer()
                    if vm.hasStoredToken {
                        Text("token stored ✓")
                            .font(.caption)
                            .foregroundStyle(.green)
                        Button(action: { vm.clearToken() }) {
                            Text("clear").font(.caption2)
                        }
                        .buttonStyle(.borderless)
                    }
                }
                SecureField(vm.hasStoredToken ? "paste a new token to replace" : "paste token", text: $vm.tokenInput)
                    .textFieldStyle(.roundedBorder)
                Text("Paste a JWT from `POST /api/v1/auth/login`. Stored in Keychain.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            if let err = vm.lastError {
                Text(err)
                    .font(.system(size: 11))
                    .foregroundStyle(.red)
                    .padding(.top, 4)
            }
        }
    }
}
