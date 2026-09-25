import SwiftUI

// MARK: - 📊 Quick Score

struct QuickScoreView: View {
    @EnvironmentObject var app: AppState
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 12) {
            Card {
                // Timeframe toggle
                HStack(spacing: 0) {
                    ForEach(Timeframe.allCases, id: \.self) { k in
                        let on = app.timeframe == k
                        Button {
                            app.timeframe = k; app.result = nil; app.error = ""
                        } label: {
                            Text(k.label).font(.system(size: 12.5, weight: .semibold))
                                .lineLimit(1).minimumScaleFactor(0.8)
                                .foregroundColor(on ? T.onAccent : T.dim)
                                .padding(.horizontal, 12).padding(.vertical, 5)
                                .frame(maxWidth: .infinity)
                                .background(on ? T.accent : .clear)
                                .clipShape(RoundedRectangle(cornerRadius: 7))
                        }
                    }
                }
                .padding(3)
                .background(T.ink)
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(T.border))
                .clipShape(RoundedRectangle(cornerRadius: 9))

                Text(app.timeframe.tag).font(.system(size: 12)).foregroundColor(T.faint)
                    .padding(.top, 8).padding(.bottom, 12)

                // Ticker input + Check
                HStack(spacing: 8) {
                    TextField("", text: $app.ticker,
                              prompt: Text("Enter ticker — e.g. NVDA").foregroundColor(T.faint))
                        .font(.mono(16)).tracking(1.6)
                        .foregroundColor(T.accent)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .submitLabel(.search)
                        .focused($focused)
                        .onChange(of: app.ticker) { _, v in app.ticker = v.uppercased() }
                        .onSubmit { if !app.loading { check() } }
                        .padding(.horizontal, 12).padding(.vertical, 12)
                        .background(T.ink)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(T.border))
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                    Button(action: check) {
                        Group {
                            if app.loading { ProgressView().tint(T.onAccent) }
                            else { Text("Check").font(.system(size: 15, weight: .bold)) }
                        }
                        .foregroundColor(T.onAccent)
                        .padding(.horizontal, 20).frame(maxHeight: .infinity)
                        .background(app.loading ? T.border : T.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .disabled(app.loading)
                }
                .fixedSize(horizontal: false, vertical: true)

                Text("Live scan · try any US ticker · watchlist: \(DEFAULT_UNIVERSE.joined(separator: ", "))")
                    .font(.system(size: 11.5)).foregroundColor(T.faint).padding(.top, 8)

                if !app.error.isEmpty {
                    Text(app.error).font(.system(size: 12.5)).foregroundColor(T.fail).padding(.top, 8)
                }
            }

            GradeScaleCard()

            if let r = app.result { ResultCard(result: r) }
        }
    }

    private func check() {
        focused = false
        Task { await app.scoreSymbol(app.ticker) }
    }
}

struct GradeScaleCard: View {
    var body: some View {
        Card {
            Text("GRADE SCALE").font(.system(size: 10.5)).tracking(0.6).foregroundColor(T.faint)
                .padding(.bottom, 8)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), alignment: .leading)],
                      alignment: .leading, spacing: 8) {
                ForEach(["A", "B", "C", "D", "F"], id: \.self) { g in
                    HStack(spacing: 6) {
                        Dot(color: gradeColor(g))
                        Text(g).font(.mono(12.5, .heavy)).foregroundColor(gradeColor(g))
                        Text(gradeLabel(g)).font(.system(size: 12)).foregroundColor(T.dim)
                    }
                }
            }
        }
    }
}

struct ResultCard: View {
    @EnvironmentObject var app: AppState
    let result: ScoreResult

    var body: some View {
        let gc = gradeColor(result.grade)
        Card {
            HStack {
                HStack(spacing: 12) {
                    Dot(color: result.tq.dot, size: 14, glow: true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(result.sym).font(.mono(21)).tracking(1.7).foregroundColor(T.accent)
                        (Text("Trend Quality · ").foregroundColor(T.faint)
                         + Text(result.tq.label).fontWeight(.semibold).foregroundColor(result.tq.dot))
                            .font(.system(size: 12.5))
                    }
                }
                Spacer()
                HStack(spacing: 12) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("OVERALL").font(.mono(10.5, .regular)).foregroundColor(T.faint)
                        Text("\(result.overall)").font(.mono(24)).foregroundColor(gc)
                    }
                    Text(result.grade).font(.mono(22, .heavy)).foregroundColor(gc)
                        .frame(width: 42, height: 42)
                        .background(T.ink)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(gc, lineWidth: 2))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
            .padding(.bottom, 12)

            HStack(spacing: 6) {
                Text("Grade \(result.grade)").fontWeight(.bold).foregroundColor(gc)
                Text("·").foregroundColor(T.faint)
                Text(gradeLabel(result.grade)).foregroundColor(T.dim)
            }
            .font(.system(size: 12)).padding(.bottom, 14)

            ForEach([("Trend", result.trend), ("Momentum", result.momentum), ("Volume", result.volume),
                     ("Risk", result.risk), ("Market", result.market)], id: \.0) { name, v in
                PillarBar(name: name, value: v).padding(.bottom, 9)
            }

            Button(action: app.saveToWatch) {
                Text("+ Watchlist").font(.system(size: 13, weight: .semibold)).foregroundColor(T.accent)
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(T.accent))
            }
            .padding(.top, 8)
        }
    }
}

struct PillarBar: View {
    let name: String
    let value: Int
    var body: some View {
        let c = gradeColor(gradeOf(value))
        VStack(spacing: 3) {
            HStack {
                Text(name).font(.system(size: 12.5, weight: .semibold))
                Spacer()
                Text("\(value)").font(.mono(12.5)).foregroundColor(c)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(T.ink)
                    Capsule().fill(c).frame(width: geo.size.width * CGFloat(value) / 100)
                }
            }
            .frame(height: 6)
        }
    }
}

// MARK: - 🔥 Strong Trends

struct StrongTrendsView: View {
    @EnvironmentObject var app: AppState
    var body: some View {
        Card {
            HStack {
                Text("Today's Strong Trends").font(.system(size: 15, weight: .bold))
                Spacer()
                Text("your system · by grade").font(.system(size: 11.5)).foregroundColor(T.faint)
            }
            .padding(.bottom, 4)
            Text("Top names on the SignalBridge grade right now. Not what's hyped — what's earning it.")
                .font(.system(size: 11.5)).foregroundColor(T.faint).padding(.bottom, 6)

            if !app.rankedError.isEmpty {
                Text("\(app.rankedError) — showing demo fallback.")
                    .font(.system(size: 12)).foregroundColor(T.warn).padding(.bottom, 8)
            }

            if app.rankedLoading {
                Text("Loading live scan…").font(.system(size: 13)).foregroundColor(T.faint)
                    .padding(.vertical, 12)
            } else {
                ForEach(Array(app.ranked.enumerated()), id: \.element.sym) { i, s in
                    if i > 0 { Divider().overlay(T.border) }
                    Button { app.openFromTrends(s.sym) } label: {
                        HStack {
                            HStack(spacing: 12) {
                                Dot(color: s.tq.dot)
                                Text(s.sym).font(.mono(15)).tracking(1.2).foregroundColor(T.text)
                                    .frame(width: 64, alignment: .leading)
                                Text(s.tq.label).font(.system(size: 12)).foregroundColor(s.tq.dot)
                            }
                            Spacer()
                            HStack(spacing: 12) {
                                Text("\(s.overall)").font(.mono(12, .regular)).foregroundColor(T.dim)
                                Text(s.grade).font(.mono(15, .heavy)).foregroundColor(gradeColor(s.grade))
                                    .frame(width: 16)
                                Text("›").foregroundColor(T.faint)
                            }
                        }
                        .padding(.vertical, 11).padding(.horizontal, 2)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - ⭐ Watchlist

struct WatchlistView: View {
    @EnvironmentObject var app: AppState
    var body: some View {
        Card {
            HStack {
                Text("Watchlist").font(.system(size: 15, weight: .bold))
                Spacer()
                Text("\(app.watchlist.count) saved").font(.system(size: 11.5)).foregroundColor(T.faint)
            }
            .padding(.bottom, 10)

            if app.watchlist.isEmpty {
                Text("Score a ticker and tap “+ Watchlist” to save it here.")
                    .font(.system(size: 13)).foregroundColor(T.faint)
            } else {
                ForEach(Array(app.watchlist.enumerated()), id: \.element.id) { i, w in
                    if i > 0 { Divider().overlay(T.border) }
                    HStack {
                        HStack(spacing: 12) {
                            Dot(color: trendQuality(w.passed).dot)
                            Button(w.sym) { app.openFromTrends(w.sym) }
                                .font(.mono(15)).tracking(1.2).foregroundColor(T.text)
                        }
                        Spacer()
                        HStack(spacing: 12) {
                            Text("\(w.overall)").font(.mono(12, .regular)).foregroundColor(T.dim)
                            Text(w.grade).font(.mono(15, .heavy)).foregroundColor(gradeColor(w.grade))
                                .frame(width: 16)
                            Button("×") { app.removeWatch(w) }
                                .font(.system(size: 18)).foregroundColor(T.faint)
                        }
                    }
                    .padding(.vertical, 10).padding(.horizontal, 2)
                }
            }
        }
    }
}

// MARK: - 🧠 Weekly Read

struct WeeklyReadView: View {
    @EnvironmentObject var app: AppState

    private var weekOf: String {
        let f = DateFormatter(); f.dateFormat = "MMM d"
        return f.string(from: Date())
    }

    var body: some View {
        VStack(spacing: 10) {
            Card {
                HStack {
                    Text("🧠 Weekly Read by Prem").font(.system(size: 15, weight: .bold))
                    Spacer()
                    Text("PREMIUM").font(.system(size: 10.5, weight: .semibold)).foregroundColor(T.accent)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .overlay(RoundedRectangle(cornerRadius: 5).stroke(T.accent))
                }
                .padding(.bottom, 12)

                if !app.isMember {
                    ZStack {
                        Text(SAMPLE_READ).font(.system(size: 13.5)).foregroundColor(T.dim)
                            .lineSpacing(4).blur(radius: 5).opacity(0.5)
                            .allowsHitTesting(false)
                        VStack(spacing: 10) {
                            Text("🔒").font(.system(size: 22))
                            Text("Prem's weekly market read is for Premium members.")
                                .font(.system(size: 13)).multilineTextAlignment(.center)
                            Button { app.isMember = true } label: {
                                Text("Unlock Premium").font(.system(size: 13.5, weight: .bold))
                                    .foregroundColor(T.onAccent)
                                    .padding(.horizontal, 20).padding(.vertical, 8)
                                    .background(T.accent).clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                        }
                    }
                } else {
                    HStack {
                        Text("Week of \(weekOf)").font(.system(size: 11.5)).foregroundColor(T.faint)
                        Spacer()
                        Button(app.editing ? "Done" : "Edit") { app.editing.toggle() }
                            .font(.system(size: 12)).foregroundColor(T.dim)
                    }
                    .padding(.bottom, 8)

                    if app.editing {
                        TextEditor(text: Binding(get: { app.read }, set: { app.saveRead($0) }))
                            .font(.system(size: 13.5))
                            .scrollContentBackground(.hidden)
                            .padding(8)
                            .frame(minHeight: 140)
                            .background(T.ink)
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(T.border))
                    } else {
                        Text(app.read).font(.system(size: 13.5)).lineSpacing(5)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Text("— Prem").font(.system(size: 12.5, weight: .semibold)).foregroundColor(T.accent)
                        .padding(.top, 12)
                }
            }

            HStack(spacing: 4) {
                Text("Toggle: previewing as \(app.isMember ? "a Premium member" : "a free user") ·")
                    .foregroundColor(T.faint)
                Button("switch") { app.isMember.toggle() }.underline().foregroundColor(T.dim)
            }
            .font(.system(size: 11))
        }
    }
}
