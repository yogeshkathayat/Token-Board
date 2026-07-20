import AppKit
import SwiftUI

/// Shared, observable state for the popover. `StatusBarController` owns one
/// instance, mutates it on refresh, and wires the action callbacks; the
/// SwiftUI tree just observes and reacts.
@MainActor
final class PopoverModel: ObservableObject {
    @Published var summary: UsageSummary?
    @Published var errorText: String?

    var onRefresh: () -> Void = {}
    var onOpenDashboard: () -> Void = {}
    var onOpenSettings: () -> Void = {}
    var onQuit: () -> Void = {}
}

struct PopoverView: View {
    @ObservedObject var model: PopoverModel

    private static let headerLogo: NSImage? = {
        guard let url = Bundle.main.url(forResource: "logomark", withExtension: "svg"),
              let img = NSImage(contentsOf: url) else { return nil }
        img.size = NSSize(width: 22, height: 22)
        return img
    }()

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    if let summary = model.summary {
                        kpiRow(summary)
                        activitySection(summary)
                        Divider().opacity(0.5)
                        TrendChartView(daily: summary.daily)
                        Divider().opacity(0.5)
                        modelsSection(summary)
                    } else {
                        emptyState
                    }
                }
                .padding(16)
            }
            Divider()
            footer
        }
        .frame(width: 400)
        .frame(maxHeight: 620)
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            if let img = Self.headerLogo {
                Image(nsImage: img).resizable().frame(width: 22, height: 22)
            } else {
                Circle()
                    .fill(TBTheme.accent.opacity(0.2))
                    .frame(width: 22, height: 22)
                    .overlay(Text("TB").font(.system(size: 8, weight: .bold)).foregroundStyle(TBTheme.accent))
            }

            if let summary = model.summary {
                Text(statusPillText(summary))
                    .font(.system(size: 11, weight: .medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Color.primary.opacity(0.06)))
                    .lineLimit(1)
            } else {
                Text("Token Board")
                    .font(.system(size: 13, weight: .semibold))
            }

            Spacer()

            Button(action: { model.onRefresh() }) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 11, weight: .semibold))
                    .frame(width: 24, height: 24)
                    .background(Circle().fill(Color.primary.opacity(0.06)))
            }
            .buttonStyle(.plain)
        }
    }

    private func statusPillText(_ summary: UsageSummary) -> String {
        let d7 = summary.d7Tokens
        if d7 <= 0 { return "\u{1F4A4} No recent usage" }
        return "\u{1F680} \(TokenFormat.compact(d7)) in the last 7 days"
    }

    // MARK: - KPI row

    private func kpiRow(_ s: UsageSummary) -> some View {
        HStack(spacing: 8) {
            KPICard(title: "7-Day", value: TokenFormat.compact(s.d7Tokens), subtitle: "\(s.activeDays7) active days")
            KPICard(title: "30-Day", value: TokenFormat.compact(s.d30Tokens), subtitle: "~\(TokenFormat.compact(s.avgPerDay30Tokens))/day")
            KPICard(title: "Total", value: TokenFormat.compact(s.totalTokens), subtitle: TokenFormat.cost(s.cost.total))
        }
    }

    // MARK: - Activity

    private func activitySection(_ s: UsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("ACTIVITY").tbSectionHeader()
                Spacer()
                Text("\(s.activeDaysTotal) active days")
                    .font(.system(size: 10.5))
                    .foregroundStyle(.secondary)
            }
            HeatmapView(daily: s.daily)
        }
    }

    // MARK: - Models

    private func modelsSection(_ s: UsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("MODELS").tbSectionHeader()
            ModelsListView(models: s.byModel)
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "tray")
                .font(.system(size: 26))
                .foregroundStyle(.secondary)
            Text(model.errorText ?? "No local usage yet")
                .font(.system(size: 12, weight: .medium))
            Text("Run `tokenboard sync` to collect usage from this machine.")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 34)
    }

    // MARK: - Footer

    private var footer: some View {
        HStack(spacing: 0) {
            footerButton("Open Dashboard") { model.onOpenDashboard() }
            Divider().frame(height: 14)
            footerButton("Settings\u{2026}") { model.onOpenSettings() }
            Divider().frame(height: 14)
            footerButton("Quit", destructive: true) { model.onQuit() }
        }
        .padding(.vertical, 6)
    }

    private func footerButton(_ title: String, destructive: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 11.5))
                .foregroundStyle(destructive ? Color.red : Color.primary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
    }
}
