"use client";

export function SpeedIndicator({
  value,
  unit,
  position = "bottom-right",
}: {
  value: number;
  unit: string;
  position?: "bottom-right" | "top-left";
}) {
  const isBottomRight = position === "bottom-right";
  return (
    <div
      style={{
        position: "absolute",
        right: isBottomRight ? 28 : "auto",
        left: isBottomRight ? "auto" : 28,
        bottom: isBottomRight ? 28 : "auto",
        top: isBottomRight ? "auto" : 28,
        padding: "12px 18px",
        borderRadius: 16,
        background: "rgba(8,10,16,0.7)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "white",
        fontFamily: "Inter, sans-serif",
        backdropFilter: "blur(10px)",
        boxShadow: "0 15px 40px rgba(0,0,0,0.2)",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 1.3, opacity: 0.75, textTransform: "uppercase" }}>Speed</div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>
        {value}
        <span style={{ fontSize: 16, marginLeft: 6, opacity: 0.88 }}>{unit}</span>
      </div>
    </div>
  );
}
