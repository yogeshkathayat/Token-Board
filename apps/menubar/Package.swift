// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "TokenBoardBar",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "TokenBoardBar", targets: ["TokenBoardBar"]),
    ],
    targets: [
        .executableTarget(
            name: "TokenBoardBar",
            path: "Sources/TokenBoardBar"
        ),
    ]
)
