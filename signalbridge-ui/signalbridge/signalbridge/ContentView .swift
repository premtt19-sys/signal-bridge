import SwiftUI

struct ContentView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        ZStack {
            T.ink.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HeaderView().padding(.bottom, 14)
                    TrialBanner()
                    TabBar().padding(.bottom, 16)

                    switch app.tab {
                    case .score:  QuickScoreView()
                    case .trends: StrongTrendsView()
                    case .watch:  WatchlistView()
                    case .read:   WeeklyReadView()
                    }

                    Text("Live · SignalBridge implements Minervini's SEPA framework. Educational, not financial advice.")
                        .font(.system(size: 10.5)).foregroundColor(T.faint)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 18)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 16)
                .frame(maxWidth: 540)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await app.loadRanked() }

            if app.showWelcome { WelcomeOverlay() }
        }
        .foregroundColor(T.text)
    }
}

// MARK: - Header

struct HeaderView: View {
    @EnvironmentObject var app: AppState
    var body: some View {
        HStack {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 2).fill(T.accent).frame(width: 10, height: 10)
                    .shadow(color: T.accent, radius: 6)
                Text("SIGNALBRIDGE").font(.system(size: 13, weight: .bold)).tracking(2)
            }
            Spacer()
            Text(app.isMember ? "PREMIUM" : "FREE")
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundColor(app.isMember ? T.accent : T.faint)
                .padding(.horizontal, 8).padding(.vertical, 2)
                .overlay(RoundedRectangle(cornerRadius: 5).stroke(app.isMember ? T.accent : T.border))
        }
    }
}

// MARK: - Trial banner

struct TrialBanner: View {
    @EnvironmentObject var app: AppState
    var body: some View {
        let urgent = app.daysLeft <= 7
        if !app.isMember && (!urgent || !app.reminderOff) {
            HStack {
                Text(urgent
                     ? "⌛ Free trial ends in \(app.daysLeft) day\(app.daysLeft == 1 ? "" : "s") — subscribe to keep Premium."
                     : "🎁 Free trial — \(app.daysLeft) days of full access left.")
                    .font(.system(size: 12.5))
                    .foregroundColor(urgent ? T.warn : T.dim)
                Spacer(minLength: 8)
                if urgent {
                    Button("Subscribe") { app.isMember = true }
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color(hex: 0x1A1400))
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(T.warn).clipShape(RoundedRectangle(cornerRadius: 6))
                    Button("×") { app.reminderOff = true }
                        .font(.system(size: 15)).foregroundColor(T.faint)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 9)
            .background(urgent ? Color(hex: 0xFBBF24, alpha: 0.12) : T.panel)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(urgent ? T.warn : T.border))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.bottom, 14)
        }
    }
}

// MARK: - Tabs

struct TabBar: View {
    @EnvironmentObject var app: AppState
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Tab.allCases, id: \.self) { t in
                    let active = app.tab == t
                    Button { app.tab = t } label: {
                        HStack(spacing: 6) { Text(t.icon); Text(t.label) }
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundColor(active ? T.text : T.dim)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(active ? T.panelHi : .clear)
                            .overlay(alignment: .bottom) {
                                if active { Rectangle().fill(T.accent).frame(height: 2) }
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
        }
    }
}

// MARK: - Welcome modal

struct WelcomeOverlay: View {
    @EnvironmentObject var app: AppState
    var body: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                Text("👋").font(.system(size: 26)).padding(.bottom, 6)
                Text("Welcome to SignalBridge").font(.system(size: 18, weight: .bold)).padding(.bottom, 8)
                (Text("You’ve got ")
                 + Text("full access free for \(TRIAL_DAYS) days").bold().foregroundColor(T.text)
                 + Text(". After that, the Premium features — the full score breakdown and Prem’s Weekly Read — need a subscription. The free verdict stays free."))
                    .font(.system(size: 13.5)).foregroundColor(T.dim).lineSpacing(4)
                    .padding(.bottom, 16)
                Button { app.showWelcome = false } label: {
                    Text("Got it").font(.system(size: 14, weight: .bold))
                        .foregroundColor(T.onAccent)
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .background(T.accent).clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(22)
            .frame(maxWidth: 360)
            .background(T.panel)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(T.border))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(20)
        }
        .foregroundColor(T.text)
    }
}
