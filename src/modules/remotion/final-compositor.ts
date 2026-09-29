import { BestMoment, ReelStyle } from "@/types";
import { buildRemotionPlanFromMoments, RemotionTimelinePlan } from "@/modules/remotion";
import { resolveNonSportOverlayTexts } from "@/lib/display-text";
import type { CreativeOverlayAnchor, CreativeOverlayAnimation, CreativeVariabilitySettings } from "@/lib/creative-variability";
import { getActionTitleCardState, getHookTextPanelState, getViralTransitionState } from "@/modules/remotion/motion/viralMotion";
import type { CreativeTransitionOverlayVariant } from "@/lib/creative-variability";
import type { RemotionTransitionType } from "@/modules/remotion/utils/TransitionSelector";
import type {
  RemotionOverlayWindow,
  RemotionTitleWindow,
  ViralRemotionTitleStyle,
  ViralRemotionTransitionMarker,
} from "@/modules/remotion/render-contract";
import {
  resolveReelTitleColorValue,
  resolveReelTitleFontFamily,
  resolveReelTitleFontStyle,
  resolveReelTitleFontWeight,
  resolveReelTitleSizeScale,
  resolveReelTitleTextTransform,
} from "@/lib/reel-title-style";
import {
  getViralHookLowerThirdState,
  resolveViralHookLowerThirdLayout,
} from "@/modules/remotion/graphics/viral-hook-lower-third";

export interface HybridRenderInput {
  moments?: BestMoment[];
  style: ReelStyle;
  durationSeconds?: number;
  width?: number;
  height?: number;
  title?: string;
  titleStyle?: ViralRemotionTitleStyle | null;
  hookText?: string;
  overlayTexts?: string[];
  titleWindow?: RemotionTitleWindow | null;
  overlayWindows?: RemotionOverlayWindow[];
  transitionMarkers?: ViralRemotionTransitionMarker[];
  creativitySettings?: CreativeVariabilitySettings;
}

export interface HybridRenderResult {
  plan: RemotionTimelinePlan;
  usedRemotionComposite: boolean;
  blob: Blob;
}

export interface AnimatedOverlayClipResult {
  data: Uint8Array;
  mimeType: string;
  extension: "webm";
}

const OVERLAY_RECORD_FPS = 30;
const CHROMA_KEY_GREEN = "#00ff00";

async function renderViralRemotionOnServer(
  ffmpegOutput: Blob,
  input: HybridRenderInput
): Promise<Blob> {
  const overlayTexts = resolveNonSportOverlayTexts({
    hookText: input.hookText,
    reelTitle: input.title,
    overlayTexts: input.overlayTexts ?? [],
  });
  const transitionMarkers: ViralRemotionTransitionMarker[] = (input.transitionMarkers ?? []).map((marker) => ({
    ...marker,
    durationFrames: Math.max(1, marker.durationFrames ?? 18),
  }));

  const formData = new FormData();
  formData.append("video", ffmpegOutput, "viral-base.mp4");
  formData.set("durationSeconds", String(input.durationSeconds ?? 0));
  formData.set("width", String(input.width ?? 1080));
  formData.set("height", String(input.height ?? 1920));
  formData.set("title", input.title ?? "");
  formData.set("titleStyle", JSON.stringify(input.titleStyle ?? null));
  formData.set("hookText", input.hookText ?? "");
  formData.set("overlayTexts", JSON.stringify(overlayTexts));
  formData.set("titleWindow", JSON.stringify(input.titleWindow ?? null));
  formData.set("overlayWindows", JSON.stringify(input.overlayWindows ?? []));
  formData.set("transitionMarkers", JSON.stringify(transitionMarkers));

  const controller = new AbortController();
  // The final hybrid pass is optional. A slow or blocked Remotion render must
  // never leave the user staring at 97% for several minutes; fail fast to the
  // FFmpeg base export instead of freezing the whole app.
  const timeoutMs = 45_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/render-viral-remotion", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Viral Remotion render failed (${response.status}): ${errorText}`);
    }

    const renderedBlob = await response.blob();
    if (!renderedBlob.size) {
      throw new Error("Viral Remotion render returned an empty MP4.");
    }

    return renderedBlob;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Viral Remotion render timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create the direct Remotion-style lower-third composite used as a safe fallback
 * for title/hook overlays when the FFmpeg overlay path cannot be trusted or the
 * browser lacks an animated overlay recorder.
 *
 * The output is intentionally an opaque PNG with a transparent background so the
 * final FFmpeg assembly can place it cleanly over the base video.
 */
export async function generateRemotionCompositeAsset({
  width,
  height,
  style,
  title,
  hookText,
  overlayTexts,
  titleStyle,
}: HybridRenderInput & { width: number; height: number }): Promise<Uint8Array> {
  if (typeof document === "undefined") {
    return new Uint8Array();
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new Uint8Array();
  }

  ctx.clearRect(0, 0, width, height);
  ctx.clearRect(0, 0, width, height);

  const baseTitle = (title ?? "").trim();
  const baseHook = (overlayTexts?.[0] ?? hookText ?? "").trim();
  const accent = style === "viral" ? "#f59e0b" : "#22d3ee";

  if (baseTitle) {
    const titleColor = resolveReelTitleColorValue(titleStyle?.color ?? "white");
    const titleFont = titleStyle?.font ?? "bold";
    const titleSize = Math.round(width * resolveReelTitleSizeScale(titleStyle?.size ?? "md"));
    const panelWidth = width * 0.84;
    const panelHeight = height * 0.14;
    const panelX = (width - panelWidth) / 2;
    const panelY = height * 0.08;

    ctx.save();
    ctx.fillStyle = "rgba(3, 7, 18, 0.52)";
    roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 28);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = titleColor;
    ctx.fillRect(panelX + 24, panelY + 18, 6, panelHeight - 36);

    ctx.fillStyle = titleColor;
    ctx.font = `700 ${Math.round(width * 0.013)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(style === "viral" ? "VIRAL MODE" : "SPORT MODE", panelX + 42, panelY + 22);

    ctx.fillStyle = titleColor;
    ctx.font = `${resolveReelTitleFontStyle(titleFont)} ${resolveReelTitleFontWeight(titleFont)} ${titleSize}px ${resolveReelTitleFontFamily(titleFont)}`;
    const titleLines = wrapText(ctx, baseTitle, panelWidth - 80).slice(0, 2);
    titleLines.forEach((line, index) => {
      const resolvedLine = resolveReelTitleTextTransform(titleFont) === "uppercase" ? line.toUpperCase() : line;
      const y = panelY + 58 + index * Math.round(width * 0.05);
      if (style === "viral") {
        ctx.save();
        ctx.fillStyle = "#22d3ee";
        ctx.fillText(resolvedLine, panelX + 42 + 4, y - 1);
        ctx.fillStyle = "#f472b6";
        ctx.fillText(resolvedLine, panelX + 42 - 4, y + 1);
        ctx.restore();
      }
      ctx.fillStyle = titleColor;
      ctx.fillText(resolvedLine, panelX + 42, y);
    });
    ctx.restore();
  }

  if (baseHook) {
    if (style === "viral") {
      const layout = resolveViralHookLowerThirdLayout(baseHook, ctx, Math.round(width * 0.97));
      const panelX = width * 0.05;
      const panelY = height * 0.74;
      const font = `800 ${layout.fontSize}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;

      const drawBar = (label: string, y: number, backgroundColor: string) => {
        if (!label) return;
        ctx.save();
        ctx.font = font;
        ctx.fillStyle = backgroundColor;
        roundRect(ctx, panelX, y, layout.barWidth, layout.barHeight, 10);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, panelX + layout.paddingX, y + layout.barHeight / 2 + 1);
        ctx.restore();
      };

      ctx.save();
      drawBar(layout.primary, panelY, "#2563eb");
      if (layout.secondary) {
        drawBar(layout.secondary, panelY + layout.barHeight + layout.barGap, "#18181b");
      }
      ctx.restore();
    } else {
      const panelWidth = width * 0.62;
      const panelHeight = height * 0.17;
      const panelX = width * 0.08;
      const panelY = height * 0.72;

      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
      roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 26);
      ctx.fill();

      ctx.strokeStyle = `${accent}cc`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = accent;
      ctx.fillRect(panelX, panelY, 6, panelHeight);

      ctx.fillStyle = "rgba(125, 211, 252, 0.9)";
      ctx.font = `700 ${Math.round(width * 0.0125)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText("HOOK", panelX + 22, panelY + 18);

      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${Math.round(width * 0.029)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      const hookLines = wrapText(ctx, baseHook, panelWidth - 52).slice(0, 2);
      hookLines.forEach((line, index) => {
        ctx.fillText(line, panelX + 22, panelY + 52 + index * Math.round(width * 0.036));
      });
      ctx.restore();
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("Remotion-style overlay export failed"));
        return;
      }
      resolve(result);
    }, "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
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

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function easeInOutCubic(value: number) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getCanvasGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  descriptor: string
) {
  if (descriptor.startsWith("linear-gradient(115deg")) {
    const gradient = ctx.createLinearGradient(0, height * 0.18, width, height * 0.82);
    gradient.addColorStop(0, "rgba(244,114,182,0.18)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.05)");
    gradient.addColorStop(1, "rgba(34,211,238,0.18)");
    return gradient;
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(15,23,42,0.18)");
  gradient.addColorStop(0.55, "rgba(245,158,11,0.14)");
  gradient.addColorStop(1, "rgba(255,255,255,0.08)");
  return gradient;
}

function pickOverlayMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null;
}

function drawOverlayTitleFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: ReelStyle,
  title: string,
  subtitle: string | undefined,
  frame: number,
  animationStyle: CreativeOverlayAnimation,
  anchor: CreativeOverlayAnchor,
  accentOverride?: string,
  titleStyle?: ViralRemotionTitleStyle | null
) {
  const accent = titleStyle ? resolveReelTitleColorValue(titleStyle.color) : accentOverride ?? (style === "viral" ? "#f59e0b" : "#22d3ee");
  const actionState = getActionTitleCardState(frame);
  const intro = easeOutCubic(Math.min(frame / 18, 1));
  const translateX = animationStyle === "swipe-in" ? (1 - intro) * 96 : animationStyle === "dynamic-reveal" ? (1 - intro) * 28 : 0;
  const scale = animationStyle === "scale-in" || animationStyle === "bounce-in"
    ? 0.92 + easeInOutCubic(Math.min(frame / 18, 1)) * 0.14
    : 1 + (1 - easeInOutCubic(Math.min(frame / 18, 1))) * 0.06;
  const resolvedTitleFont = titleStyle?.font ?? "bold";
  const resolvedTitleColor = titleStyle ? resolveReelTitleColorValue(titleStyle.color) : "#ffffff";
  const titleSize = Math.round(width * resolveReelTitleSizeScale(titleStyle?.size ?? "md"));
  ctx.font = `${resolveReelTitleFontStyle(resolvedTitleFont)} ${resolveReelTitleFontWeight(resolvedTitleFont)} ${titleSize}px ${resolveReelTitleFontFamily(resolvedTitleFont)}`;
  const titleLines = wrapText(ctx, title, style === "viral" ? width * 0.7 : width - 84);

  ctx.save();
  ctx.globalAlpha = actionState.opacity;
  ctx.translate(translateX, actionState.translateY);
  ctx.scale(scale, scale);
  ctx.textBaseline = "top";

  if (style === "viral") {
    const titleX = Math.round(width * 0.1);
    const titleY = Math.round(height * 0.12);
    const lineStep = Math.round(titleSize * 0.96);

    ctx.font = `${resolveReelTitleFontStyle(resolvedTitleFont)} ${resolveReelTitleFontWeight(resolvedTitleFont)} ${titleSize}px ${resolveReelTitleFontFamily(resolvedTitleFont)}`;
    titleLines.forEach((line, index) => {
      const resolvedLine = resolveReelTitleTextTransform(resolvedTitleFont) === "uppercase" ? line.toUpperCase() : line;
      const y = titleY + index * lineStep;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.48)";
      ctx.shadowBlur = 26;
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(resolvedLine, titleX + 8, y - 2);
      ctx.fillStyle = "#f472b6";
      ctx.fillText(resolvedLine, titleX - 8, y + 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = resolvedTitleColor;
      ctx.fillText(resolvedLine, titleX, y);
      ctx.restore();
    });

    if (subtitle) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = `600 ${Math.round(width * 0.021)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.fillText(subtitle, titleX, titleY + titleLines.length * lineStep + 18);
    }
    ctx.restore();
    return;
  }

  const boxHeight = Math.round(height * 0.18);
  const boxWidth = width - 40;
  const boxX = 20;
  const boxY = anchor === "center" ? Math.round(height * 0.16) : anchor === "top-right" || anchor === "top-left" ? 24 : Math.round(height * 0.68);
  ctx.fillStyle = "rgba(8,15,28,0.82)";
  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 28);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.font = `700 ${Math.round(width * 0.014)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText("SPORT MODE", boxX + 22, boxY + 22);

  ctx.fillStyle = resolvedTitleColor;
  titleLines.forEach((line, index) => {
    const resolvedLine = resolveReelTitleTextTransform(resolvedTitleFont) === "uppercase" ? line.toUpperCase() : line;
    const y = boxY + 58 + index * Math.round(width * 0.05);
    ctx.fillText(resolvedLine, boxX + 22, y);
  });

  if (subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `600 ${Math.round(width * 0.021)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillText(subtitle, boxX + 22, boxY + 58 + titleLines.length * Math.round(width * 0.05) + 18);
  }
  ctx.restore();
}

function drawOverlayHookFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: ReelStyle,
  text: string,
  frame: number,
  _animationStyle: CreativeOverlayAnimation,
  anchor: CreativeOverlayAnchor,
  accentOverride?: string
) {
  if (style === "viral") {
    const state = getViralHookLowerThirdState(frame, Math.max(36, Math.round(OVERLAY_RECORD_FPS * 4)));
    const baseX = Math.round(width * 0.05);
    const layout = resolveViralHookLowerThirdLayout(text, ctx, Math.round(width * 0.97));
    const baseY = Math.round(height * 0.74);
    const font = `800 ${layout.fontSize}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;

    const drawBar = (label: string, y: number, backgroundColor: string, reveal: number) => {
      if (!label || reveal <= 0) return;
      ctx.save();
      ctx.font = font;
      ctx.beginPath();
      ctx.rect(baseX, y, layout.barWidth * reveal, layout.barHeight);
      ctx.clip();
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(baseX, y, layout.barWidth, layout.barHeight);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, baseX + layout.paddingX, y + layout.barHeight / 2 + 1);
      ctx.restore();
    };

    ctx.save();
    ctx.globalAlpha = state.opacity;
    ctx.translate(state.translateX, 0);
    drawBar(layout.primary, baseY, "#2563eb", state.topReveal);
    drawBar(layout.secondary, baseY + layout.barHeight + layout.barGap, "#18181b", state.bottomReveal);
    ctx.restore();
    return;
  }

  const accent = accentOverride ?? "#22d3ee";
  const state = getHookTextPanelState(frame);
  const panelWidth = Math.round(width * 0.58);
  const panelHeight = Math.round(height * 0.16);
  const panelX =
    anchor === "center"
      ? Math.round((width - panelWidth) / 2)
      : anchor === "top-right" || anchor === "bottom-right"
        ? Math.round(width * 0.34)
        : Math.round(width * 0.08);
  const panelY =
    anchor === "center"
      ? Math.round(height * 0.42)
      : anchor === "top-left" || anchor === "top-right"
        ? Math.round(height * 0.24)
        : Math.round(height * 0.68);

  ctx.save();
  ctx.globalAlpha = state.opacity;
  ctx.translate(state.translateX, 0);
  ctx.scale(state.scale, state.scale);
  ctx.fillStyle = "rgba(8,15,28,0.82)";
  roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 28);
  ctx.fill();
  ctx.strokeStyle = `${accent}aa`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = `700 ${Math.round(width * 0.013)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText("HOOK", panelX + 22, panelY + 18);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(width * 0.028)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const lines = wrapText(ctx, text, panelWidth - 44);
  lines.forEach((line, index) => {
    ctx.fillText(line, panelX + 22, panelY + 48 + index * Math.round(width * 0.036));
  });
  ctx.restore();
}

function remotionTransitionTypeForVariant(variant: CreativeTransitionOverlayVariant): RemotionTransitionType {
  switch (variant) {
    case "glitch":
      return "film-burn";
    case "speed-ramp":
      return "cross-zoom";
    case "whip-pan":
      return "cross-zoom";
    case "zoom":
      return "cross-zoom";
    case "motion-blur":
      return "cross-zoom";
    case "blur":
      return "cross-zoom";
    case "flash":
      return "film-burn";
    case "swipe":
    default:
      return "film-burn";
  }
}

function drawViralTransitionFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  variant: CreativeTransitionOverlayVariant,
  direction: "left" | "right"
) {
  const state = getViralTransitionState(frame, remotionTransitionTypeForVariant(variant), direction);
  ctx.fillStyle = CHROMA_KEY_GREEN;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = state.opacity;
  if (state.isHorizontal) {
    ctx.translate(state.offset, 0);
  } else {
    ctx.translate(0, state.offset);
  }
  if (state.scale !== 1) {
    ctx.translate(width / 2, height / 2);
    ctx.scale(state.scale, state.scale);
    ctx.translate(-width / 2, -height / 2);
  }
  ctx.filter = state.blurPx > 0 ? `blur(${state.blurPx}px)` : "none";
  ctx.fillStyle = getCanvasGradient(ctx, width, height, state.background);
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  ctx.filter = "none";

  // Viral film-burn and cross-zoom are intentionally subtle motion accents.
  // A full white flash is reserved for true flash-cut transitions only; never
  // apply it here to keep the mid-shot effect clean and premium.
}

async function recordAnimatedCanvasClip({
  width,
  height,
  durationSeconds,
  drawFrame,
}: {
  width: number;
  height: number;
  durationSeconds: number;
  drawFrame: (ctx: CanvasRenderingContext2D, frame: number, progress: number) => void;
}): Promise<AnimatedOverlayClipResult> {
  if (typeof document === "undefined") {
    throw new Error("Animated overlay clips require a browser environment.");
  }
  const mimeType = pickOverlayMimeType();
  if (!mimeType) {
    throw new Error("No supported MediaRecorder mime type available for animated overlays.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire overlay canvas context.");
  }

  const stream = canvas.captureStream(OVERLAY_RECORD_FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });
  const chunks: BlobPart[] = [];

  const stopPromise = new Promise<AnimatedOverlayClipResult>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("Animated overlay recording failed."));
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) {
        reject(new Error("Animated overlay recording produced an empty clip."));
        return;
      }
      resolve({
        data: new Uint8Array(await blob.arrayBuffer()),
        mimeType,
        extension: "webm",
      });
    };
  });

  drawFrame(ctx, 0, 0);
  recorder.start(100);

  await new Promise<void>((resolve) => {
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(durationSeconds, (now - startedAt) / 1000);
      const progress = durationSeconds > 0 ? clamp01(elapsed / durationSeconds) : 1;
      drawFrame(ctx, Math.round(elapsed * OVERLAY_RECORD_FPS), progress);
      if (elapsed >= durationSeconds) {
        if (recorder.state !== "inactive") recorder.stop();
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  return stopPromise;
}

export async function generateAnimatedTextOverlayClip({
  width,
  height,
  style,
  text,
  subtitle,
  durationSeconds,
  kind,
  animationStyle = "slide-in",
  anchor = kind === "title" ? "top-left" : "bottom-left",
  accentColor,
  titleStyle,
}: {
  width: number;
  height: number;
  style: ReelStyle;
  text: string;
  subtitle?: string;
  durationSeconds: number;
  kind: "title" | "hook";
  animationStyle?: CreativeOverlayAnimation;
  anchor?: CreativeOverlayAnchor;
  accentColor?: string;
  titleStyle?: ViralRemotionTitleStyle | null;
}): Promise<AnimatedOverlayClipResult> {
  return recordAnimatedCanvasClip({
    width,
    height,
    durationSeconds,
    drawFrame: (ctx, frame) => {
      ctx.fillStyle = CHROMA_KEY_GREEN;
      ctx.fillRect(0, 0, width, height);
      if (kind === "title") {
        drawOverlayTitleFrame(ctx, width, height, style, text, subtitle, frame, animationStyle, anchor, accentColor, titleStyle);
      } else {
        drawOverlayHookFrame(ctx, width, height, style, text, frame, animationStyle, anchor, accentColor);
      }
    },
  });
}

export async function generateAnimatedViralTransitionOverlayClip({
  width,
  height,
  durationSeconds,
  direction,
  variant,
}: {
  width: number;
  height: number;
  durationSeconds: number;
  direction: "left" | "right";
  variant: CreativeTransitionOverlayVariant;
}): Promise<AnimatedOverlayClipResult> {
  return recordAnimatedCanvasClip({
    width,
    height,
    durationSeconds,
    drawFrame: (ctx, frame) => {
      drawViralTransitionFrame(ctx, width, height, frame, variant, direction);
    },
  });
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
    input.style === "sport" ? "sport" : input.style === "viral" ? "viral" : "cinematic",
    input.style === "sport" ? "sport_dynamic" : input.style === "viral" ? "viral_pulse" : "cinematic_wave",
    {
      title: input.title,
      hookText: input.hookText,
      overlayTexts: input.overlayTexts,
    },
    input.creativitySettings
  );

  try {
    if (typeof document === "undefined") {
      return { plan, usedRemotionComposite: false, blob: ffmpegOutput };
    }

    if (input.style === "viral") {
      const hasTitle = !!input.title?.trim();
      const hasTitleWindow = !!input.titleWindow && input.titleWindow.end > input.titleWindow.start;
      const hasHookText = !!(input.hookText ?? "").trim() || (input.overlayTexts ?? []).some((text) => !!text?.trim());
      const hasOverlayWindows = (input.overlayWindows ?? []).some((window) => !!window.text?.trim() && window.end > window.start);
      const hasTransitionMarkers = (input.transitionMarkers ?? []).length > 0;

      if (!hasTitle && !hasTitleWindow && !hasHookText && !hasOverlayWindows && !hasTransitionMarkers) {
        return { plan, usedRemotionComposite: false, blob: ffmpegOutput };
      }

      const remotionBlob = await renderViralRemotionOnServer(ffmpegOutput, input);
      return {
        plan,
        usedRemotionComposite: true,
        blob: remotionBlob,
      };
    }

    const asset = await generateRemotionCompositeAsset({
      width: 1080,
      height: 1920,
      style: input.style,
      title: input.title,
      titleStyle: input.titleStyle,
      hookText: input.hookText,
      overlayTexts: input.overlayTexts,
    });
    return {
      plan,
      usedRemotionComposite: asset.byteLength > 0 && ffmpegOutput.size > 0,
      blob: ffmpegOutput,
    };
  } catch (error) {
    console.warn("[remotion] Hybrid final render was not applied; FFmpeg export kept as fallback.", error);
    return { plan, usedRemotionComposite: false, blob: ffmpegOutput };
  }
}
