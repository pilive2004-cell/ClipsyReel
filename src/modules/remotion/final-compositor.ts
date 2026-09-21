import { BestMoment, ReelStyle } from "@/types";
import { buildRemotionPlanFromMoments, RemotionTimelinePlan } from "@/modules/remotion";

export interface HybridRenderInput {
  moments?: BestMoment[];
  style: ReelStyle;
  title?: string;
  hookText?: string;
  overlayTexts?: string[];
}

export interface HybridRenderResult {
  plan: RemotionTimelinePlan;
  usedRemotionComposite: boolean;
  blob: Blob;
}

/**
 * DEPRECATED: This function is kept for backwards compatibility but should not
 * be used for actual rendering. Overlays (titles and hook texts) are generated
 * separately by generateReelTitlePng and generateOverlayTextPng and then
 * applied via FFmpeg filter_complex with proper timing.
 *
 * This function returns an empty array to disable the duplicate overlay path.
 */
export async function generateRemotionCompositeAsset({
  width,
  height,
  style,
  title,
  hookText,
  overlayTexts,
}: HybridRenderInput & { width: number; height: number }): Promise<Uint8Array> {
  // Return empty to disable this path — overlays are handled by generateReelTitlePng
  // and generateOverlayTextPng instead, with proper FFmpeg timing via filter_complex.
  return new Uint8Array();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

/**
 * Final render contract for the hybrid pipeline:
 * - FFmpeg remains the authoritative base video engine.
 * - Remotion is the overlay/template layer that can add a title, motion graphics,
 *   transitions, and style-specific overlays on top of the FFmpeg assembly.
 * - If a browser environment cannot render the Remotion overlay in this session,
 *   the FFmpeg output is kept unchanged instead of failing the entire export.
 */
export async function composeFinalRenderWithRemotion(
  ffmpegOutput: Blob,
  input: HybridRenderInput
): Promise<HybridRenderResult> {
  const moments = input.moments ?? [];
  const plan = buildRemotionPlanFromMoments(
    moments,
    input.style === "sport" ? "sport" : "cinematic",
    input.style === "sport" ? "sport_dynamic" : "cinematic_wave",
    {
      title: input.title,
      hookText: input.hookText,
      overlayTexts: input.overlayTexts,
    }
  );

  try {
    if (typeof document === "undefined") {
      return { plan, usedRemotionComposite: false, blob: ffmpegOutput };
    }

    const asset = await generateRemotionCompositeAsset({
      width: 1080,
      height: 1920,
      style: input.style,
      title: input.title,
      hookText: input.hookText,
      overlayTexts: input.overlayTexts,
    });
    return {
      plan,
      usedRemotionComposite: asset.byteLength > 0,
      blob: ffmpegOutput,
    };
  } catch (error) {
    console.warn("[remotion] Hybrid final render was not applied; FFmpeg export kept as fallback.", error);
    return { plan, usedRemotionComposite: false, blob: ffmpegOutput };
  }
}
