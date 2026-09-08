import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // `@tensorflow-models/face-landmarks-detection` (used in
      // `src/lib/ml-detection.ts` for on-device "best moment" face/emotion
      // scoring) statically imports these two MediaPipe packages even
      // though this app only uses the pure-TFJS runtime (no MediaPipe WASM
      // assets). Both are UMD/globals bundles, not real ESM modules, which
      // breaks Turbopack's production build — alias them to a harmless stub
      // (see `src/lib/stubs/mediapipe-stub.ts`) that's never invoked.
      "@mediapipe/face_mesh": "./src/lib/stubs/mediapipe-stub.ts",
      "@mediapipe/face_detection": "./src/lib/stubs/mediapipe-stub.ts",
    },
  },
  // Cross-origin isolation (COOP/COEP) is required for SharedArrayBuffer,
  // which the multi-threaded ffmpeg.wasm core needs to actually use multiple
  // threads (a big real-world speedup for the compose/render pass — see
  // loadFFmpeg() in src/lib/video-engine.ts). `headers()` only affects the
  // local `next dev` server; the static export ignores it, so the same
  // headers are duplicated for Netlify in public/_headers.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
