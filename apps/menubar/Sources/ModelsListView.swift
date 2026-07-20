import SwiftUI

struct ModelsListView: View {
    let models: [UsageSummary.ModelUsage]

    private static let palette: [Color] = [.blue, .purple, .pink, .orange, .green, .teal, .indigo, .yellow]

    var body: some View {
        VStack(spacing: 10) {
            if models.isEmpty {
                Text("No model data yet")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForEach(Array(models.prefix(8).enumerated()), id: \.element.id) { index, model in
                    row(model, color: Self.palette[index % Self.palette.count])
                }
            }
        }
    }

    private func row(_ model: UsageSummary.ModelUsage, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(model.model)
                    .font(.system(size: 11.5, weight: .medium))
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 8)
                Text(TokenFormat.compact(model.tokens))
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.secondary)
                Text(String(format: "%.0f%%", model.pct))
                    .font(.system(size: 10.5))
                    .foregroundStyle(.secondary)
                    .frame(width: 32, alignment: .trailing)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.07))
                    Capsule()
                        .fill(color.opacity(0.8))
                        .frame(width: max(3, geo.size.width * CGFloat(min(max(model.pct, 0), 100) / 100)))
                }
            }
            .frame(height: 5)
        }
    }
}
