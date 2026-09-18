import { NextRequest, NextResponse } from "next/server";
import { PIXABAY_TRACKS } from "@/data/pixabayTracks";

export async function POST(request: NextRequest) {
  const controller = new AbortController();
  const timeoutMs = 90000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { style, duration, bpm, intensity } = await request.json();
    const styleKey = typeof style === "string" && style in PIXABAY_TRACKS ? style as keyof typeof PIXABAY_TRACKS : "viral";
    const preferredTrack = PIXABAY_TRACKS[styleKey]?.[0];

    if (preferredTrack) {
      try {
        const preferredResponse = await fetch(preferredTrack.mp3Url, {
          cache: "force-cache",
        });

        if (preferredResponse.ok) {
          const buffer = await preferredResponse.arrayBuffer();
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              "Content-Type": preferredResponse.headers.get("Content-Type") || "audio/mpeg",
              "Content-Disposition": `attachment; filename=${styleKey}-soundtrack.mp3`,
              "X-Soundtrack-Source": "pixabay",
            },
          });
        }

        console.warn("Preferred Pixabay soundtrack request failed:", preferredResponse.status);
      } catch (preferredError) {
        console.warn("Preferred Pixabay soundtrack unavailable; falling back to local MusicGen.", preferredError);
      }
    }

    const musicgenUrl = process.env.MUSICGEN_API_URL || "http://localhost:8788/generate-music";

    // Call Python MusicGen server
    const formData = new FormData();
    formData.append("style", style || "viral");
    formData.append("duration", String(duration || 30));
    if (bpm) formData.append("bpm", String(bpm));
    formData.append("intensity", String(intensity || 0.8));

    const response = await fetch(musicgenUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MusicGen returned ${response.status}: ${text || "music service unavailable"}`);
    }

    // Stream audio back to client
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": "attachment; filename=background-music.wav",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Music generation timed out. The local MusicGen service is likely starting or unavailable." },
        { status: 504 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("MusicGen error:", message);
    return NextResponse.json({ error: message }, { status: 503 });
  } finally {
    clearTimeout(timeoutId);
  }
}
