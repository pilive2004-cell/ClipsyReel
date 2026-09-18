/**
 * Helper to obtain background music based on the reel style.
 */
import { PIXABAY_TRACKS, type PixabayTrack } from "@/data/pixabayTracks";
import type { ReelStyle } from "@/types";

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const rawText = await response.text();
    if (!rawText) return `HTTP ${response.status}`;

    try {
      const parsed = JSON.parse(rawText) as { error?: string; detail?: string; message?: string };
      return parsed.error ?? parsed.detail ?? parsed.message ?? rawText;
    } catch {
      return rawText;
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

function pickPreferredTrack(style: ReelStyle, videoDuration: number): PixabayTrack | null {
  const candidates = PIXABAY_TRACKS[style] ?? [];
  if (candidates.length === 0) return null;

  const desiredEnergy = style === "sport" || style === "viral" ? "high" : style === "luxury" || style === "cinematic" ? "low" : "medium";
  const scored = candidates.map((track, index) => {
    const [minSeconds, maxSeconds] = track.bestForSeconds;
    const durationPenalty =
      videoDuration < minSeconds ? minSeconds - videoDuration : videoDuration > maxSeconds ? videoDuration - maxSeconds : 0;
    const energyPenalty = track.energy === desiredEnergy ? 0 : track.energy === "medium" || desiredEnergy === "medium" ? 1 : 2;
    return { track, score: durationPenalty * 10 + energyPenalty + index * 0.01 };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.track ?? null;
}

export async function generateBackgroundMusic(
  style: ReelStyle | null,
  videoDuration: number,
  bpm?: number,
  intensity?: number
): Promise<Blob | null> {
  const styleKey: ReelStyle = style ?? "viral";
  const preferredTrack = pickPreferredTrack(styleKey, videoDuration);
  if (preferredTrack) {
    try {
      const preferredResponse = await fetch(preferredTrack.mp3Url, { cache: "force-cache" });
      if (preferredResponse.ok) {
        const blob = await preferredResponse.blob();
        if (blob.size > 0) {
          return blob;
        }
      }
      console.warn("Preferred soundtrack fetch failed; falling back to local MusicGen.", preferredResponse.status);
    } catch (error) {
      console.warn("Preferred soundtrack is unavailable; falling back to local MusicGen.", error);
    }
  }

  const controller = new AbortController();
  const timeoutMs = 90000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Map ClipsyReel styles to MusicGen styles
    const styleMap: Record<ReelStyle | "unknown", string> = {
      sport: "sport",
      luxury: "luxury",
      cinematic: "cinematic",
      viral: "viral",
      adventure: "adventure",
      travel: "adventure",
      unknown: "viral",
    };

    const musicStyle = styleKey in styleMap ? styleMap[styleKey] : "viral";

    const response = await fetch("/api/generate-music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        style: musicStyle,
        duration: Math.min(videoDuration, 60), // Max 60s per MusicGen
        bpm: bpm || undefined,
        intensity: intensity || 0.8,
      }),
    });

    if (!response.ok) {
      const errorMessage = await readErrorMessage(response);
      console.warn("Background music unavailable; continuing without soundtrack.", errorMessage);
      return null;
    }

    try {
      return await response.blob();
    } catch (blobError) {
      console.warn("Music generation returned an invalid audio payload; proceeding without music.", blobError);
      return null;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.warn(`Background music generation timed out after ${timeoutMs}ms; continuing without soundtrack.`);
      return null;
    }

    console.warn("Music generation is unavailable right now; the render will continue without background music.", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
