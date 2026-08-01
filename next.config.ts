import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ClipsyReel is a 100% client-side prototype (ffmpeg.wasm runs entirely in
  // the browser, no API routes / server rendering needed), so it can ship as
  // plain static files — the simplest, fastest way to host it on Netlify.
  output: "export",
};

export default nextConfig;
