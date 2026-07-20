import SwiftUI

struct KPICard: View {
    let title: String
    let value: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.system(size: 9.5, weight: .semibold))
                .foregroundStyle(.secondary)
                .tracking(0.4)
            Text(value)
                .font(.system(size: 16, weight: .bold, design: .monospaced))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(subtitle)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .tbCard()
    }
}
