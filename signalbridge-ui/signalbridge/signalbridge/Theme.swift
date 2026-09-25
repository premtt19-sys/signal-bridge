import SwiftUI

// Same palette as the web app's `T` object.
enum T {
    static let ink     = Color(hex: 0x0E141B)
    static let panel   = Color(hex: 0x151E29)
    static let panelHi = Color(hex: 0x1B2734)
    static let border  = Color(hex: 0x26333F)
    static let text    = Color(hex: 0xE7EEF5)
    static let dim     = Color(hex: 0x8294A6)
    static let faint   = Color(hex: 0x5A6A7A)
    static let accent  = Color(hex: 0x2DD4BF)
    static let pass    = Color(hex: 0x34D399)
    static let warn    = Color(hex: 0xFBBF24)
    static let fail    = Color(hex: 0xF87171)
    static let onAccent = Color(hex: 0x04241F)
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: alpha)
    }
}

extension Font {
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
}

/// Equivalent of the web `<Card>` component.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(T.panel)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(T.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

struct Dot: View {
    let color: Color
    var size: CGFloat = 8
    var glow = false
    var body: some View {
        Circle().fill(color).frame(width: size, height: size)
            .shadow(color: glow ? color : .clear, radius: glow ? 6 : 0)
    }
}
