import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ASSETS = new Map([
  ["ffmpeg-core.js", { relativePath: "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js", contentType: "text/javascript; charset=utf-8" }],
  ["ffmpeg-core.wasm", { relativePath: "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm", contentType: "application/wasm" }],
  ["ffmpeg-core-mt.js", { relativePath: "node_modules/@ffmpeg/core-mt/dist/umd/ffmpeg-core.js", contentType: "text/javascript; charset=utf-8" }],
  ["ffmpeg-core-mt.wasm", { relativePath: "node_modules/@ffmpeg/core-mt/dist/umd/ffmpeg-core.wasm", contentType: "application/wasm" }],
  ["ffmpeg-core-mt.worker.js", { relativePath: "node_modules/@ffmpeg/core-mt/dist/umd/ffmpeg-core.worker.js", contentType: "text/javascript; charset=utf-8" }],
]);

const PROJECT_ROOT = /* turbopackIgnore: true */ process.cwd();

export async function GET(_request: NextRequest, context: { params: Promise<{ asset: string }> }) {
  const { asset } = await context.params;
  const descriptor = ALLOWED_ASSETS.get(asset);

  if (!descriptor) {
    return NextResponse.json({ error: "Unknown FFmpeg asset." }, { status: 404 });
  }

  const filePath = resolve(PROJECT_ROOT, descriptor.relativePath);
  const file = await readFile(filePath);

  return new NextResponse(file, {
    status: 200,
    headers: {
      "Content-Type": descriptor.contentType,
      "Content-Length": String(file.byteLength),
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
