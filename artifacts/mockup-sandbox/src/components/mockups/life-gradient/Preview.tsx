// Colours matching constants/colors.ts exactly
const C = {
  primary:        "#E03131",
  darkBg:         "#111111",
  cardBg:         "#1A1A1A",
  border:         "#2A2A2A",
  textPrimary:    "#FFFFFF",
  textMuted:      "#666666",
  success:        "#40C057",
  warning:        "#FD7E14",
  info:           "#339AF0",
};

const ITEM_H = 48;

const ROWS = [
  { emoji: "🏠", title: "Pay rent",               status: "In Progress", sc: C.warning  },
  { emoji: "📋", title: "Insurance renewal",       status: "Not started", sc: "#555555"  },
  { emoji: "🔑", title: "Book locksmith",          status: "Done",        sc: C.success  },
  { emoji: "📦", title: "Return Amazon package",   status: "Backlog",     sc: C.info     },
  { emoji: "💳", title: "Credit card statement",   status: "Not started", sc: "#555555"  },
  { emoji: "🚗", title: "Car service booking",     status: "In Progress", sc: C.warning  },
  { emoji: "📱", title: "Cancel Spotify trial",    status: "Backlog",     sc: C.info     },
  { emoji: "🏦", title: "Transfer savings",        status: "Done",        sc: C.success  },
];

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textPrimary} strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

// Current: plain ScreenHeader exactly matching the real component
function CurrentHeader() {
  return (
    <div style={{
      display: "flex", flexDirection: "row", alignItems: "center",
      padding: "10px 12px", gap: 12,
      backgroundColor: C.darkBg,
      borderBottom: `1px solid ${C.border}`,
      flexShrink: 0,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.cardBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <MenuIcon />
      </div>
      <span style={{ flex: 1, textAlign: "center", color: C.textPrimary, fontSize: 17, fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>Life Admin</span>
      <div style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <RefreshIcon />
      </div>
    </div>
  );
}

// Proposed: Spotify-style — title + burger float over a black→dark-crimson radial hero
function ProposedHero() {
  return (
    <div style={{ position: "relative", height: 128, flexShrink: 0, overflow: "visible" }}>
      {/* E03131-tinted radial glow — black at edges, brand red blooms from top-centre */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 110% 160% at 50% -20%, rgba(224,49,49,0.72) 0%, rgba(224,49,49,0.28) 42%, transparent 68%)",
        backgroundColor: C.darkBg,
      }} />
      {/* Fade-to-list gradient at the bottom so rows merge seamlessly */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 52,
        background: `linear-gradient(transparent, ${C.darkBg})`,
        pointerEvents: "none",
      }} />

      {/* Burger — top left, semi-transparent pill */}
      <div style={{
        position: "absolute", top: 10, left: 12,
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: "rgba(26,26,26,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <MenuIcon />
      </div>
      {/* Refresh — top right */}
      <div style={{
        position: "absolute", top: 10, right: 12,
        width: 36, height: 36, borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <RefreshIcon />
      </div>

      {/* Title sits in the lower half of the hero, overlaying the gradient */}
      <div style={{
        position: "absolute", bottom: 22, left: 0, right: 0,
        textAlign: "center",
      }}>
        <span style={{
          color: C.textPrimary, fontSize: 17,
          fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: 0.1,
        }}>Life Admin</span>
      </div>
    </div>
  );
}

function TaskRow({ emoji, title, status, sc }: typeof ROWS[0]) {
  return (
    <div style={{
      display: "flex", flexDirection: "row", alignItems: "center",
      gap: 12, backgroundColor: C.cardBg,
      border: `1px solid ${C.border}`,
      paddingLeft: 14, paddingRight: 14,
      height: ITEM_H, flexShrink: 0,
      marginBottom: 1, boxSizing: "border-box",
    }}>
      <span style={{ fontSize: 21, lineHeight: 1, minWidth: 26, textAlign: "center" }}>{emoji}</span>
      <span style={{ flex: 1, color: C.textPrimary, fontSize: 15, fontFamily: "'Inter', sans-serif", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{title}</span>
      <span style={{ fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: 0.2, color: sc, backgroundColor: sc + "28", border: `1px solid ${sc}55`, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>{status}</span>
      <div style={{ width: 24, height: 24, borderRadius: 6, border: "2px solid #5a5a5a", flexShrink: 0, backgroundColor: "transparent" }} />
    </div>
  );
}

function CountRow({ count }: { count: number }) {
  return (
    <div style={{ padding: "6px 16px", flexShrink: 0 }}>
      <span style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>{count} items</span>
    </div>
  );
}

function FAB() {
  return (
    <div style={{ position: "absolute", bottom: 28, right: 18, width: 48, height: 48, borderRadius: 14, backgroundColor: C.primary, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${C.primary}73` }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </div>
  );
}

function Screen({ label, proposed }: { label: string; proposed: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 11, color: "#555", letterSpacing: 1.4, textTransform: "uppercase" as const }}>{label}</span>

      <div style={{ width: 390, height: 620, backgroundColor: C.darkBg, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", borderRadius: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.7)", border: `1px solid ${C.border}` }}>

        {proposed ? (
          <>
            <ProposedHero />
            {/* Count sits just below the fade — no separator */}
            <CountRow count={ROWS.length} />
            <div style={{ flex: 1, overflow: "hidden", marginLeft: 16, marginRight: 16, marginTop: 4 }}>
              {ROWS.map((r, i) => <TaskRow key={i} {...r} />)}
            </div>
          </>
        ) : (
          <>
            <CurrentHeader />
            <CountRow count={ROWS.length} />
            <div style={{ flex: 1, overflow: "hidden", marginLeft: 16, marginRight: 16, marginTop: 8 }}>
              {ROWS.map((r, i) => <TaskRow key={i} {...r} />)}
            </div>
          </>
        )}

        <FAB />
      </div>
    </div>
  );
}

export function Preview() {
  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 48px", gap: 28, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: C.primary, fontSize: 10, fontWeight: 700, letterSpacing: 2.2, textTransform: "uppercase" as const, margin: 0 }}>Design Exploration</p>
        <h1 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "6px 0 0", letterSpacing: -0.3 }}>Life Section — Gradient Header</h1>
      </div>

      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        <Screen label="Current" proposed={false} />
        <Screen label="Proposed" proposed={true} />
      </div>

      <p style={{ color: "#3a3a3a", fontSize: 11, textAlign: "center", maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
        Proposed: title floats over a black → dark crimson radial glow. No header border. Fades seamlessly into the list.
      </p>
    </div>
  );
}
