const ROWS = [
  { emoji: "🏠", label: "Pay rent", status: "In Progress", statusColor: "#FD7E14" },
  { emoji: "📋", label: "Insurance renewal", status: "Not started", statusColor: "#555555" },
  { emoji: "🔑", label: "Book locksmith", status: "Done", statusColor: "#40C057" },
  { emoji: "📦", label: "Return Amazon package", status: "Backlog", statusColor: "#339AF0" },
  { emoji: "💳", label: "Credit card statement", status: "Not started", statusColor: "#555555" },
  { emoji: "🚗", label: "Car service booking", status: "In Progress", statusColor: "#FD7E14" },
  { emoji: "📱", label: "Cancel Spotify trial", status: "Backlog", statusColor: "#339AF0" },
  { emoji: "🔋", label: "Electricity bill", status: "Not started", statusColor: "#555555" },
  { emoji: "🏦", label: "Transfer savings", status: "Done", statusColor: "#40C057" },
];

function PhoneHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        height: 52,
        background: "#0d0d0d",
        borderBottom: "1px solid #1e1e1e",
        display: "flex",
        alignItems: "center",
        paddingLeft: 18,
        paddingRight: 14,
        gap: 10,
        flexShrink: 0,
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#E03131", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 14 }}>🏠</span>
      </div>
      <span style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", letterSpacing: -0.3 }}>
        {title}
      </span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#E03131", fontSize: 14 }}>+</span>
        </div>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#888", fontSize: 12 }}>⋮</span>
        </div>
      </div>
    </div>
  );
}

function Row({ emoji, label, status, statusColor }: typeof ROWS[0]) {
  return (
    <div
      style={{
        height: 50,
        display: "flex",
        alignItems: "center",
        paddingLeft: 14,
        paddingRight: 14,
        borderBottom: "1px solid #1e1e1e",
        gap: 10,
        background: "#0d0d0d",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        {emoji}
      </div>
      <span
        style={{
          flex: 1,
          color: "#fff",
          fontSize: 13.5,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          letterSpacing: -0.1,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 10.5,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          color: statusColor,
          background: statusColor + "1A",
          border: `1px solid ${statusColor}40`,
          borderRadius: 5,
          padding: "2px 7px",
          whiteSpace: "nowrap",
          letterSpacing: 0.2,
        }}
      >
        {status}
      </span>
    </div>
  );
}

function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          fontSize: 12,
          color: "#888",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div
        style={{
          width: 320,
          height: 620,
          borderRadius: 32,
          background: "#111",
          border: "2px solid #2a2a2a",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
          position: "relative",
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 90,
            height: 24,
            background: "#111",
            borderRadius: "0 0 16px 16px",
            zIndex: 10,
            border: "2px solid #2a2a2a",
            borderTop: "none",
          }}
        />
        {/* Status bar space */}
        <div style={{ height: 28, background: "#111", flexShrink: 0 }} />
        {children}
      </div>
    </div>
  );
}

export function Preview() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#090909",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 32px",
        gap: 32,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Title */}
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#E03131", fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
          Design Exploration
        </p>
        <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "6px 0 0", letterSpacing: -0.5 }}>
          Life Section — Gradient Header
        </h1>
      </div>

      {/* Two phone frames */}
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        {/* LEFT: Current */}
        <PhoneFrame label="Current">
          <PhoneHeader title="Life Admin" />
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {ROWS.map((r, i) => <Row key={i} {...r} />)}
          </div>
        </PhoneFrame>

        {/* RIGHT: Proposed — gradient + items pushed down */}
        <PhoneFrame label="Proposed">
          <PhoneHeader title="Life Admin" />
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
            {/* Gradient band */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 70,
                background: "linear-gradient(180deg, rgba(224,49,49,0.28) 0%, transparent 100%)",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
            {/* Spacer pushes items below the gradient */}
            <div style={{ height: 70, flexShrink: 0 }} />
            {ROWS.map((r, i) => <Row key={i} {...r} />)}
          </div>
        </PhoneFrame>
      </div>

      {/* Caption */}
      <p style={{ color: "#555", fontSize: 12, textAlign: "center", maxWidth: 520, lineHeight: 1.6, margin: 0 }}>
        Right: ~22% opacity red gradient fades from the top of the list area, with a subtle left-edge accent line. List items start 20px lower.
      </p>
    </div>
  );
}
