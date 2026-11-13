import { join } from "node:path";
import { readFile } from "node:fs/promises";

// The card drawn into a share link's preview image (see app/shared/[token]/opengraph-image.tsx).
// Rendered by next/og (Satori): inline styles only, and every element with several children
// needs display: flex.

// Doesn't depend on the request, so it's read once.
const mascot = `data:image/png;base64,${await readFile(join(process.cwd(), "public/brand/mascot-dark.png"), "base64")}`;

const AMBER = "#f59e3b";

export function SharedPreviewCard({
  name,
  description,
  surfaces,
}: {
  name: string;
  description: string;
  surfaces: string[];
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        backgroundColor: "#0e0e12",
        backgroundImage:
          "radial-gradient(circle at 12% 0%, rgba(245,158,59,0.32), transparent 45%), radial-gradient(circle at 100% 100%, rgba(234,88,12,0.18), transparent 40%)",
        color: "#f7f7f8",
        fontFamily: "sans-serif",
      }}
    >
      {/* Brand row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: "rgba(245,158,59,0.14)",
              border: "1px solid rgba(245,158,59,0.4)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mascot} width={40} height={40} alt="" />
          </div>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>Outpost</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 20px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.14)",
            backgroundColor: "rgba(255,255,255,0.04)",
            fontSize: 22,
            color: "#b4b4bd",
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: AMBER }} />
          Shared workspace
        </div>
      </div>

      {/* Title and description */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1000 }}>
        <div style={{ fontSize: name.length > 40 ? 60 : 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          {name}
        </div>
        <div style={{ fontSize: 28, lineHeight: 1.4, color: "#a1a1aa" }}>{description}</div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {surfaces.map((surface) => (
            <div
              key={surface}
              style={{
                display: "flex",
                padding: "8px 18px",
                borderRadius: 10,
                border: "1px solid rgba(245,158,59,0.35)",
                backgroundColor: "rgba(245,158,59,0.1)",
                color: AMBER,
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {surface}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#8b8b94" }}>View only · No sign-in needed</div>
      </div>
    </div>
  );
}
