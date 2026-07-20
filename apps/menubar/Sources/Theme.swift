import SwiftUI

enum TBTheme {
    static let accent = Color(red: 0.36, green: 0.58, blue: 0.98)
}

extension View {
    func tbSectionHeader() -> some View {
        self
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.secondary)
            .tracking(0.6)
    }

    func tbCard() -> some View {
        self
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Color.primary.opacity(0.04)))
            .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(Color.primary.opacity(0.07), lineWidth: 1))
    }
}
