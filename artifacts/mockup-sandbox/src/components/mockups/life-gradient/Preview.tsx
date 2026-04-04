const C = {
  primary:     "#E03131",
  bg:          "#0f0f0f",
  textPrimary: "#FFFFFF",
  textMuted:   "rgba(255,255,255,0.25)",
  success:     "#40C057",
  warning:     "#FD7E14",
  info:        "#339AF0",
};

const ROWS = [
  { emoji: "🔥", title: "Check suncorp origin",                        done: false, priority: "high"   },
  { emoji: "🔥", title: "Video for Suegra",                            done: false, priority: "high"   },
  { emoji: "🔥", title: "Make appointment with myself",                done: false, priority: "high"   },
  { emoji: "🖥", title: "Recommence Spanish Lessons",                  done: false, priority: "normal" },
  { emoji: "🖥", title: "Book laser",                                  done: false, priority: "normal" },
  { emoji: "🖥", title: "Email Alice with weekly check in 🧠",         done: true,  priority: "normal" },
  { emoji: "🖥", title: "Cancel subscriptions",                        done: false, priority: "normal" },
  { emoji: "🖥", title: "Danny GPT Instructions",                      done: true,  priority: "normal" },
  { emoji: "🖥", title: "Sort tax documents",                          done: true,  priority: "normal" },
];

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

// ── Current: plain flat header ─────────────────────────────────────
function CurrentHeader() {
  return (
    <div style={{
      display: "flex", flexDirection: "row", alignItems: "center",
      padding: "10px 12px", gap: 12,
      backgroundColor: C.bg,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      flexShrink: 0,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <MenuIcon />
      </div>
      <span style={{ flex: 1, textAlign: "center", color: C.textPrimary, fontSize: 17, fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>Life Admin</span>
      <div style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <RefreshIcon />
      </div>
    </div>
  );
}

// ── New Concept: multi-radial with mask + glowing title ─────────────
function NewHeader({ doneCount, total }: { doneCount: number; total: number }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {/* Multi-layered radial gradient — matches reference exactly */}
      <div style={{
        padding: "52px 20px 42px",
        background: [
          "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(224,49,49,0.38) 0%, rgba(180,20,20,0.16) 30%, rgba(80,5,5,0.06) 54%, transparent 70%)",
          "radial-gradient(ellipse 60% 65% at 0% 0%, rgba(224,49,49,0.14) 0%, transparent 60%)",
          "radial-gradient(ellipse 60% 65% at 100% 0%, rgba(224,49,49,0.14) 0%, transparent 60%)",
          C.bg,
        ].join(", "),
        WebkitMaskImage: "linear-gradient(to bottom, black 58%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, black 58%, transparent 100%)",
      }}>
        {/* Inner top glow (::before equivalent) */}
        <div style={{
          position: "absolute",
          top: -20, left: "50%", transform: "translateX(-50%)",
          width: 280, height: 200,
          background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(224,49,49,0.42) 0%, rgba(160,15,15,0.14) 45%, transparent 68%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        {/* Burger — top left */}
        <div style={{
          position: "absolute", top: 10, left: 12,
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: "rgba(26,26,26,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}>
          <MenuIcon />
        </div>
        {/* Refresh — top right */}
        <div style={{
          position: "absolute", top: 10, right: 12,
          width: 36, height: 36, borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}>
          <RefreshIcon />
        </div>

        {/* Title with red glow */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 4 }}>
          <span style={{
            fontSize: 20, fontWeight: 700,
            fontFamily: "'Inter', sans-serif",
            color: C.textPrimary,
            textShadow: "0 0 24px rgba(224,49,49,0.45)",
          }}>Life Admin</span>
        </div>
        {/* Subtitle */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Inter', sans-serif" }}>
            {doneCount} done · {total} items
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Row: current (card style) ─────────────────────────────────────
function CurrentRow({ emoji, title, done }: typeof ROWS[0]) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "13px 14px",
      backgroundColor: "#1A1A1A",
      border: "1px solid #2A2A2A",
      marginBottom: 1,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{emoji}</div>
      <span style={{ flex: 1, fontSize: 15, color: done ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.82)", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: done ? "line-through" : "none", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{title}</span>
      <div style={{ width: 24, height: 24, borderRadius: 6, border: done ? "none" : "1.5px solid rgba(255,255,255,0.15)", backgroundColor: done ? C.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", flexShrink: 0 }}>{done ? "✓" : ""}</div>
    </div>
  );
}

// ── Row: new concept (flat hairline) ─────────────────────────────
function NewRow({ emoji, title, done }: typeof ROWS[0]) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 13,
      padding: "13px 18px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(224,49,49,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{emoji}</div>
      <span style={{ flex: 1, fontSize: 15, color: done ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.82)", fontFamily: "'Inter', sans-serif", fontWeight: 400, textDecoration: done ? "line-through" : "none", lineHeight: 1.35, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{title}</span>
      <div style={{ width: 24, height: 24, borderRadius: 6, border: done ? "none" : "1.5px solid rgba(255,255,255,0.15)", backgroundColor: done ? C.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", flexShrink: 0 }}>{done ? "✓" : ""}</div>
    </div>
  );
}

function FAB() {
  return (
    <div style={{ position: "absolute", bottom: 20, right: 16, width: 48, height: 48, borderRadius: 14, backgroundColor: C.primary, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px rgba(224,49,49,0.5)` }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </div>
  );
}

function Screen({ label, isNew }: { label: string; isNew: boolean }) {
  const doneCount = ROWS.filter(r => r.done).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 11, color: "#555", letterSpacing: 1.4, textTransform: "uppercase" as const }}>{label}</span>

      <div style={{ width: 390, height: 640, backgroundColor: C.bg, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", borderRadius: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}>

        {isNew ? (
          <>
            <NewHeader doneCount={doneCount} total={ROWS.length} />
            <div style={{ flex: 1, overflow: "hidden" }}>
              {ROWS.map((r, i) => <NewRow key={i} {...r} />)}
            </div>
          </>
        ) : (
          <>
            <CurrentHeader />
            <div style={{ padding: "6px 16px", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Inter', sans-serif" }}>{ROWS.length} items</span>
            </div>
            <div style={{ flex: 1, overflow: "hidden", marginLeft: 16, marginRight: 16, marginTop: 4 }}>
              {ROWS.map((r, i) => <CurrentRow key={i} {...r} />)}
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
        <Screen label="Current" isNew={false} />
        <Screen label="New Concept" isNew={true} />
      </div>

      <p style={{ color: "#3a3a3a", fontSize: 11, textAlign: "center", maxWidth: 600, lineHeight: 1.6, margin: 0 }}>
        New: multi-radial glow that mask-fades out · title glows red · rows are full-bleed on pure black with a hairline separator
      </p>
    </div>
  );
}
