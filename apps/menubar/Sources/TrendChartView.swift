import SwiftUI
import Charts

enum TrendRange: String, CaseIterable, Identifiable {
    case day = "Day"
    case week = "Week"
    case month = "Month"
    case total = "Total"

    var id: String { rawValue }
}

struct TrendChartPoint: Identifiable {
    let id = UUID()
    let date: Date
    let tokens: Int64
}

struct TrendChartView: View {
    let daily: [UsageSummary.DailyPoint]

    @State private var range: TrendRange = .month

    private var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        return cal
    }

    private func rawPoints(_ points: [UsageSummary.DailyPoint]) -> [TrendChartPoint] {
        points.compactMap { p in
            guard let d = p.day else { return nil }
            return TrendChartPoint(date: d, tokens: p.tokens)
        }
    }

    private var points: [TrendChartPoint] {
        switch range {
        case .day:
            return rawPoints(Array(daily.suffix(14)))
        case .month:
            return rawPoints(Array(daily.suffix(30)))
        case .total:
            return rawPoints(daily)
        case .week:
            let cal = utcCalendar
            var buckets: [Date: Int64] = [:]
            for p in daily {
                guard let d = p.day, let weekStart = cal.dateInterval(of: .weekOfYear, for: d)?.start else { continue }
                buckets[weekStart, default: 0] += p.tokens
            }
            return buckets.keys.sorted().suffix(12).map { TrendChartPoint(date: $0, tokens: buckets[$0] ?? 0) }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("TREND").tbSectionHeader()
                Spacer()
                rangeSelector
            }

            if points.isEmpty {
                Text("Not enough data yet")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 110, alignment: .center)
            } else {
                Chart(points) { p in
                    AreaMark(x: .value("Date", p.date), y: .value("Tokens", p.tokens))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [TBTheme.accent.opacity(0.35), TBTheme.accent.opacity(0.02)],
                                startPoint: .top, endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.monotone)

                    LineMark(x: .value("Date", p.date), y: .value("Tokens", p.tokens))
                        .foregroundStyle(TBTheme.accent)
                        .interpolationMethod(.monotone)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                }
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                        AxisGridLine().foregroundStyle(Color.primary.opacity(0.06))
                        AxisValueLabel {
                            if let d = value.as(Double.self) {
                                Text(TokenFormat.compact(Int64(d)))
                                    .font(.system(size: 9, design: .monospaced))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                        AxisGridLine().foregroundStyle(Color.primary.opacity(0.06))
                        AxisValueLabel(format: .dateTime.month(.abbreviated).day(), centered: true)
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(height: 120)
            }
        }
    }

    private var rangeSelector: some View {
        HStack(spacing: 2) {
            ForEach(TrendRange.allCases) { r in
                Text(r.rawValue)
                    .font(.system(size: 10, weight: range == r ? .semibold : .regular))
                    .foregroundStyle(range == r ? Color.primary : Color.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(range == r ? Color.primary.opacity(0.1) : Color.clear)
                    )
                    .contentShape(Rectangle())
                    .onTapGesture { range = r }
            }
        }
        .padding(2)
        .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.primary.opacity(0.05)))
    }
}
