import SwiftUI

struct HeatmapView: View {
    let daily: [UsageSummary.DailyPoint]

    private let weeksToShow = 20
    private let cellSize: CGFloat = 11
    private let cellSpacing: CGFloat = 3

    private struct Cell {
        let date: Date
        let tokens: Int64
    }

    private var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        return cal
    }

    /// Weeks oldest -> newest, each a Sunday...Saturday column. `nil` marks
    /// days that haven't happened yet (the tail end of the current week).
    private var weeks: [[Cell?]] {
        let cal = utcCalendar
        guard let lastDateString = daily.last?.date,
              let today = TokenFormat.isoDayFormatter.date(from: lastDateString) else {
            return []
        }

        var byDate: [Date: Int64] = [:]
        for point in daily {
            guard let d = TokenFormat.isoDayFormatter.date(from: point.date) else { continue }
            byDate[cal.startOfDay(for: d)] = point.tokens
        }

        let todayStart = cal.startOfDay(for: today)
        let weekday = cal.component(.weekday, from: todayStart) // 1 = Sunday
        guard let currentWeekStart = cal.date(byAdding: .day, value: -(weekday - 1), to: todayStart),
              let rangeStart = cal.date(byAdding: .day, value: -((weeksToShow - 1) * 7), to: currentWeekStart) else {
            return []
        }

        var columns: [[Cell?]] = []
        var cursor = rangeStart
        for _ in 0..<weeksToShow {
            var column: [Cell?] = []
            for _ in 0..<7 {
                if cursor > todayStart {
                    column.append(nil)
                } else {
                    column.append(Cell(date: cursor, tokens: byDate[cursor] ?? 0))
                }
                cursor = cal.date(byAdding: .day, value: 1, to: cursor) ?? cursor
            }
            columns.append(column)
        }
        return columns
    }

    private func level(_ tokens: Int64, max: Int64) -> Int {
        guard tokens > 0, max > 0 else { return 0 }
        let ratio = Double(tokens) / Double(max)
        if ratio > 0.75 { return 4 }
        if ratio > 0.5 { return 3 }
        if ratio > 0.25 { return 2 }
        return 1
    }

    private func color(for level: Int) -> Color {
        switch level {
        case 0: return Color.primary.opacity(0.06)
        case 1: return TBTheme.accent.opacity(0.28)
        case 2: return TBTheme.accent.opacity(0.5)
        case 3: return TBTheme.accent.opacity(0.75)
        default: return TBTheme.accent
        }
    }

    private func monthLabel(at index: Int, columns: [[Cell?]]) -> String? {
        guard index < columns.count, let firstCell = columns[index].compactMap({ $0 }).first else { return nil }
        let cal = utcCalendar
        let month = cal.component(.month, from: firstCell.date)
        guard index > 0, let prevCell = columns[index - 1].compactMap({ $0 }).first else {
            return shortMonthSymbol(month)
        }
        let prevMonth = cal.component(.month, from: prevCell.date)
        return month != prevMonth ? shortMonthSymbol(month) : nil
    }

    private func shortMonthSymbol(_ month: Int) -> String {
        let symbols = DateFormatter().shortMonthSymbols ?? []
        guard month >= 1, month <= symbols.count else { return "" }
        return symbols[month - 1]
    }

    var body: some View {
        let columns = weeks
        let maxTokens = columns.flatMap { $0 }.compactMap { $0?.tokens }.max() ?? 0

        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: cellSpacing) {
                ForEach(Array(columns.enumerated()), id: \.offset) { index, _ in
                    Text(monthLabel(at: index, columns: columns) ?? "")
                        .font(.system(size: 8.5))
                        .foregroundStyle(.secondary)
                        .fixedSize()
                        .frame(width: cellSize, alignment: .leading)
                }
            }

            HStack(alignment: .top, spacing: cellSpacing) {
                ForEach(Array(columns.enumerated()), id: \.offset) { _, column in
                    VStack(spacing: cellSpacing) {
                        ForEach(Array(column.enumerated()), id: \.offset) { _, cell in
                            RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                                .fill(cell != nil ? color(for: level(cell!.tokens, max: maxTokens)) : Color.clear)
                                .frame(width: cellSize, height: cellSize)
                        }
                    }
                }
            }

            HStack(spacing: 4) {
                Text("Less").font(.system(size: 9)).foregroundStyle(.secondary)
                ForEach(0..<5, id: \.self) { lvl in
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(color(for: lvl))
                        .frame(width: 8, height: 8)
                }
                Text("More").font(.system(size: 9)).foregroundStyle(.secondary)
                Spacer()
            }
        }
    }
}
