const ITEMS = [
  { emoji: "🔥", title: "Check suncorp origin",                          done: false },
  { emoji: "🔥", title: "Video for Suegra",                              done: false },
  { emoji: "🔥", title: "Make Tyga Playlist",                            done: false },
  { emoji: "🔥", title: "Think about weekly reflection",                 done: false },
  { emoji: "🔥", title: "Make appointment with myself",                  done: false },
  { emoji: "🖥", title: "Recommence Spanish Lessons",                    done: false },
  { emoji: "🖥", title: "Book laser",                                     done: false },
  { emoji: "🖥", title: "GP check Alice",                                done: false },
  { emoji: "🖥", title: "Email Alice with weekly check in 🧠",           done: true  },
  { emoji: "🖥", title: "Cancel subscriptions",                          done: false },
  { emoji: "🖥", title: "Danny GPT Instructions",                        done: true  },
  { emoji: "🖥", title: "Research new running shoes",                    done: false },
  { emoji: "🖥", title: "Sort tax documents",                            done: true  },
];

const BG = "#0f0f0f";
const PRIMARY = "#E03131";

function Row({ emoji, title, done }: typeof ITEMS[0]) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 13,
      padding: "13px 18px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: "rgba(224,49,49,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, flexShrink: 0,
      }}>{emoji}</div>
      <span style={{
        flex: 1, fontSize: 15,
        color: done ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.82)",
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontWeight: 400, lineHeight: 1.35,
        textDecoration: done ? "line-through" : "none",
        overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
      }}>{title}</span>
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        border: done ? "none" : "1.5px solid rgba(255,255,255,0.15)",
        backgroundColor: done ? PRIMARY : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, color: "#fff", fontWeight: 700,
      }}>{done ? "✓" : ""}</div>
    </div>
  );
}

export function Preview() {
  const doneCount = ITEMS.filter(i => i.done).length;

  return (
    <div style={{
      height: "100vh", background: BG,
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Gradient header ───────────────────────────── */}
      <div style={{ position: "relative", flexShrink: 0, overflow: "visible" }}>
        <div style={{
          padding: "52px 20px 56px",
          background: [
            `radial-gradient(ellipse 100% 100% at 50% 0%, rgba(224,49,49,0.72) 0%, rgba(180,20,20,0.28) 45%, transparent 70%)`,
            `radial-gradient(ellipse 60% 65% at 0% 0%, rgba(224,49,49,0.22) 0%, transparent 60%)`,
            `radial-gradient(ellipse 60% 65% at 100% 0%, rgba(224,49,49,0.22) 0%, transparent 60%)`,
            BG,
          ].join(", "),
          WebkitMaskImage: "linear-gradient(to bottom, black 72%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 72%, transparent 100%)",
        }}>
          {/* Top halo */}
          <div style={{
            position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)",
            width: 280, height: 180,
            background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(224,49,49,0.72) 0%, rgba(160,15,15,0.28) 45%, transparent 68%)",
            pointerEvents: "none", zIndex: 0,
          }} />

          {/* Nav row */}
          <div style={{ position: "absolute", top: 10, left: 12, right: 12, display: "flex", alignItems: "center", zIndex: 2 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(26,26,26,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "rgba(255,255,255,0.75)" }}>‹</div>
            <div style={{ flex: 1 }} />
            <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "rgba(255,255,255,0.28)" }}>↻</div>
          </div>

          {/* Title */}
          <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 4 }}>
            <span style={{
              fontSize: 20, fontWeight: 700, color: "#fff",
              textShadow: "0 0 24px rgba(224,49,49,0.45)",
            }}>Gradient Header</span>
          </div>
          {/* Subtitle */}
          <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
              {doneCount} done · {ITEMS.length} items
            </span>
          </div>
        </div>
      </div>

      {/* ── List ─────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" } as any}>
        {ITEMS.map((item, i) => <Row key={i} {...item} />)}
      </div>

    </div>
  );
}
