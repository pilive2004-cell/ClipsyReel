import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "ClipsyReel — Turn videos into scroll-stopping Instagram Reels";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Static Open Graph / Twitter share image, generated at build time (a single
 * fixed image, not per-request — works fine with `output: "export"`). Kept
 * as inline JSX/CSS (no external image assets) so it renders identically
 * everywhere `next/og` runs, matching the app's dark, premium brand look.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#05050a",
          backgroundImage:
            "radial-gradient(circle at 25% 20%, rgba(236,72,153,0.35), transparent 55%), radial-gradient(circle at 80% 80%, rgba(99,102,241,0.35), transparent 55%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "18px 34px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 54,
              height: 54,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
              color: "#f5f5f7",
              background: "linear-gradient(135deg,#ec4899,#6366f1)",
            }}
          >
            CR
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#f5f5f7", letterSpacing: -1 }}>
            ClipsyReel
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 34,
            fontWeight: 700,
            color: "#f5f5f7",
            textAlign: "center",
            maxWidth: 940,
          }}
        >
          Turn your videos into scroll-stopping Reels
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 22,
            color: "rgba(245,245,247,0.72)",
            textAlign: "center",
            maxWidth: 860,
          }}
        >
          AI best-moment detection · Creative Style Engine · GPX routes · Premium transitions
        </div>
      </div>
    ),
    { ...size }
  );
}
