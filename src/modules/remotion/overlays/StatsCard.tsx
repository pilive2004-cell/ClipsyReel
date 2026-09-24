"use client";

export function StatsCard({
  title,
  subtitle,
  accent = "#a855f7",
  position = "bottom-left",
}: {
  title: string;
  subtitle: string;
  accent?: string;
  position?: "bottom-left" | "top-right";
}) {
  const isBottomLeft = position === "bottom-left";
  return (
    <div
      style={{
        position: "absolute",
        left: isBottomLeft ? 32 : "auto",
        right: isBottomLeft ? "auto" : 32,
        bottom: isBottomLeft ? 40 : "auto",
        top: isBottomLeft ? "auto" : 40,
        padding: "16px 18px",
        borderRadius: 20,
        background: "rgba(8,12,24,0.74)",
        border: `1px solid ${accent}66`,
        minWidth: 220,
        boxShadow: `0 18px 40px ${accent}22`,
        backdropFilter: "blur(14px)",
      }}
    >
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: `${accent}`, marginBottom: 8 }}>
        Live stats
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "white", lineHeight: 1.05 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 16, color: "rgba(255,255,255,0.72)" }}>{subtitle}</div>
    </div>
  );
}
