"use client";

export function ProgressBar({ progress = 100, accent = "#f59e0b" }: { progress?: number; accent?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 28,
        top: 34,
        width: 210,
        padding: "12px 14px",
        borderRadius: 18,
        background: "rgba(6,10,18,0.74)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 11, color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: 1.5 }}>
        <span>Build</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${accent}, #ffffff)` }} />
      </div>
    </div>
  );
}
