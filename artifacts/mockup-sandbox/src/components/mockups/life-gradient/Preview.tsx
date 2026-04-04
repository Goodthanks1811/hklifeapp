// Colours matching constants/colors.ts exactly
const C = {
  primary:         "#E03131",
  darkBg:          "#111111",
  cardBg:          "#1A1A1A",
  cardBgElevated:  "#222222",
  border:          "#2A2A2A",
  textPrimary:     "#FFFFFF",
  textSecondary:   "#A0A0A0",
  textMuted:       "#666666",
  success:         "#40C057",
  warning:         "#FD7E14",
  info:            "#339AF0",
};

const ITEM_H  = 48;
const ITEM_GAP = 1;
const SLOT_H  = ITEM_H + ITEM_GAP;

const ROWS = [
  { emoji: "🏠", title: "Pay rent",               status: "In Progress", sc: C.warning },
  { emoji: "📋", title: "Insurance renewal",       status: "Not started", sc: "#555555" },
  { emoji: "🔑", title: "Book locksmith",          status: "Done",        sc: C.success },
  { emoji: "📦", title: "Return Amazon package",   status: "Backlog",     sc: C.info    },
  { emoji: "💳", title: "Credit card statement",   status: "Not started", sc: "#555555" },
  { emoji: "🚗", title: "Car service booking",     status: "In Progress", sc: C.warning },
  { emoji: "📱", title: "Cancel Spotify trial",    status: "Backlog",     sc: C.info    },
  { emoji: "🔋", title: "Electricity bill",        status: "Not started", sc: "#555555" },
  { emoji: "🏦", title: "Transfer savings",        status: "Done",        sc: C.success },
];

// Exact replication of ScreenHeader from components/ScreenHeader.tsx
function ScreenHeader({ title }: { title: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "row", alignItems: "center",
      padding: "10px 12px", gap: 12,
      backgroundColor: C.darkBg,
      borderBottom: `1px solid ${C.border}`,
      flexShrink: 0,
    }}>
      {/* Menu button */}
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: C.cardBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textPrimary} strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </div>
      {/* Title */}
      <span style={{
        flex: 1, textAlign: "center",
        color: C.textPrimary, fontSize: 17,
        fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: 0.1,
      }}>{title}</span>
      {/* Right spacer / refresh icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </div>
    </div>
  );
}

// Exact replication of TaskRow from life/[slug].tsx — rowWrap style
function TaskRow({ emoji, title, status, sc }: typeof ROWS[0]) {
  return (
    <div style={{
      display: "flex", flexDirection: "row", alignItems: "center",
      gap: 12, backgroundColor: C.cardBg,
      border: `1px solid ${C.border}`,
      paddingLeft: 14, paddingRight: 14,
      height: ITEM_H, flexShrink: 0,
      marginBottom: ITEM_GAP,
      boxSizing: "border-box",
    }}>
      {/* Emoji */}
      <span style={{ fontSize: 22, lineHeight: 1, minWidth: 28, textAlign: "center" }}>{emoji}</span>
      {/* Title */}
      <span style={{
        flex: 1,
        color: C.textPrimary, fontSize: 15,
        fontFamily: "'Inter', sans-serif", fontWeight: 600, lineHeight: "21px",
        overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
      }}>{title}</span>
      {/* Status pill — epicPill style */}
      <span style={{
        fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: 0.2,
        color: sc,
        backgroundColor: sc + "28",
        border: `1px solid ${sc}55`,
        borderRadius: 6,
        padding: "3px 8px",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}>{status}</span>
      {/* Checkbox — checkBox style */}
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        border: "2px solid #5a5a5a",
        flexShrink: 0, backgroundColor: "transparent",
      }} />
    </div>
  );
}

// Count row — sc.countRow / sc.countText
function CountRow({ count }: { count: number }) {
  return (
    <div style={{ padding: "8px 16px", flexShrink: 0 }}>
      <span style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
        {count} items
      </span>
    </div>
  );
}

// FAB — sc.fab
function FAB() {
  return (
    <div style={{
      position: "absolute", bottom: 32, right: 20,
      width: 48, height: 48, borderRadius: 14,
      backgroundColor: C.primary,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 4px 12px ${C.primary}73`,
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </div>
  );
}

// A single screen column — label above, screen below
function Screen({ label, gradient }: { label: string; gradient: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      {/* Label */}
      <span style={{
        fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 11,
        color: "#666", letterSpacing: 1.4, textTransform: "uppercase",
      }}>{label}</span>

      {/* Screen — exact darkBg, 390px wide */}
      <div style={{
        width: 390, height: 620,
        backgroundColor: C.darkBg,
        display: "flex", flexDirection: "column",
        position: "relative", overflow: "hidden",
        borderRadius: 8,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        border: `1px solid ${C.border}`,
      }}>
        <ScreenHeader title="Life Admin" />
        <CountRow count={ROWS.length} />

        {/* List area */}
        <div style={{
          flex: 1, overflow: "hidden",
          marginLeft: 16, marginRight: 16,
          marginTop: 8,
          position: "relative",
        }}>
          {/* Gradient overlay — PROPOSED only */}
          {gradient && (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: 70,
              background: "linear-gradient(180deg, rgba(224,49,49,0.28) 0%, transparent 100%)",
              zIndex: 2, pointerEvents: "none",
            }} />
          )}

          {/* Task rows — pushed down 70px in proposed variant */}
          <div style={{ paddingTop: gradient ? 70 : 0 }}>
            {ROWS.map((r, i) => <TaskRow key={i} {...r} />)}
          </div>
        </div>

        <FAB />
      </div>
    </div>
  );
}

export function Preview() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 48px",
      gap: 28,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Heading */}
      <div style={{ textAlign: "center" }}>
        <p style={{ color: C.primary, fontSize: 10, fontWeight: 700, letterSpacing: 2.2, textTransform: "uppercase", margin: 0 }}>
          Design Exploration
        </p>
        <h1 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "6px 0 0", letterSpacing: -0.3 }}>
          Life Section — Gradient Header
        </h1>
      </div>

      {/* Side-by-side screens */}
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        <Screen label="Current" gradient={false} />
        <Screen label="Proposed" gradient={true} />
      </div>

      {/* Caption */}
      <p style={{ color: "#444", fontSize: 11, textAlign: "center", maxWidth: 600, lineHeight: 1.6, margin: 0 }}>
        Proposed: 70px gradient (rgba(224,49,49,0.28) → transparent) overlays the top of the list. Items start 70px lower.
      </p>
    </div>
  );
}
