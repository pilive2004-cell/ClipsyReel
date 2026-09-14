import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";

const ALLOWED_HOSTS = new Set([
  "cdn.motor1.com",
  "www.rideapart.com",
  "rideapart.com",
  "adventuremotorcycle.com",
  "www.adventuremotorcycle.com",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function runCurlBinary(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      [
        "--compressed",
        "-L",
        "--max-time",
        "20",
        "-A",
        "Mozilla/5.0 ClipsyReel/1.0",
        url,
      ],
      {
        encoding: "buffer",
        maxBuffer: 8 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout as Buffer);
      },
    );
  });
}

function inferContentType(url: string): string {
  if (/\.png(\?|$)/i.test(url)) return "image/png";
  if (/\.webp(\?|$)/i.test(url)) return "image/webp";
  if (/\.avif(\?|$)/i.test(url)) return "image/avif";
  if (/\.gif(\?|$)/i.test(url)) return "image/gif";
  if (/\.svg(\?|$)/i.test(url)) return "image/svg+xml";
  return "image/jpeg";
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src")?.trim();
  if (!src) {
    return new NextResponse("Missing src", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return new NextResponse("Invalid src", { status: 400 });
  }

  if (!/^https?:$/i.test(parsed.protocol) || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse("Blocked src", { status: 403 });
  }

  try {
    const data = await runCurlBinary(parsed.toString());
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": inferContentType(parsed.pathname),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.warn("[adventure-news-image] image proxy failed:", error);
    return new NextResponse("Image fetch failed", { status: 502 });
  }
}
