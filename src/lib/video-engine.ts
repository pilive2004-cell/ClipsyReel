"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { BestMoment, ReelStyle } from "@/types";
import { STYLE_RECIPES, StyleRecipe } from "@/data/styleRecipes";
import { pickTransitionName, randomTransitionDuration, STYLE_TRANSITIONS } from "@/data/transitions";

/**
 * Real, in-browser video editing engine powered by ffmpeg.wasm.
 *
 * There is no backend in this MVP, so all montage rendering (trimming the
 * detected best moments, applying Ken Burns zoom in/out, and cross-fading
 * between clips with style-matched `xfade` transitions) happens entirely
 * on-device via WebAssembly. Up to 3 source videos can be combined into one
 * montage.
 *
 * PERFORMANCE NOTE — two-phase pipeline:
 * A single `filter_complex` with several `trim` filters branching off one
 * decoded input (the original, naive approach) forces ffmpeg to decode the
 * *entire* source up to the last used timestamp, even for a 2-second clip
 * cut from a 10-minute video. Instead we:
 *   Phase 1: extract + Ken Burns-zoom each segment individually using
 *            `-ss` *before* `-i` (fast keyframe seek — only the needed
 *            few seconds are ever decoded) into small intermediate clips.
 *   Phase 2: cross-fade the (small, already-scaled) intermediate clips
 *            together — cheap, since total input size no longer depends on
 *            the original source length.
 * This is what makes rendering fast regardless of how long the uploaded
 * footage is.
 *
 * FUTURE BACKEND INTEGRATION:
 * Once a backend exists, move this whole pipeline server-side (native
 * FFmpeg, GPU-accelerated if possible) and simply POST the video(s) + the
 * chosen style/segments to e.g. `POST /api/render`, polling for a job status
 * instead of running ffmpeg.wasm on the client. The client-side API surface
 * below (`buildMontage`, `getVideoDuration`) can stay the same shape so the
 * UI barely has to change.
 */

let ffmpegSingleton: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

/**
 * Render mutex: ffmpeg.wasm is single-threaded and shares a single in-memory
 * FS. Concurrent `buildMontage` calls from re-running React effects corrupt
 * that FS (ErrnoError). Each render acquires this lock and the next waits.
 */
let renderLock: Promise<unknown> | null = null;

/** Returns true while a render is in progress (useful for guard checks in the UI). */
export function isRenderInProgress(): boolean {
  return renderLock !== null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Lazily loads & caches a single ffmpeg.wasm instance (core files are self-hosted in /public/ffmpeg). */
async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: "/ffmpeg/ffmpeg-core.js",
      wasmURL: "/ffmpeg/ffmpeg-core.wasm",
    });
    ffmpegSingleton = ffmpeg;
    return ffmpeg;
  })();

  return loadingPromise;
}

/** Destroys the singleton on unrecoverable FS errors so the next render gets a clean instance. */
function resetFFmpegSingleton() {
  try { ffmpegSingleton?.terminate?.(); } catch { /* ignore */ }
  ffmpegSingleton = null;
  loadingPromise = null;
}

/** Reads the real duration (seconds) of a video file using the browser's own decoder — no ffmpeg needed for this. */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.src = url;
    videoEl.onloadedmetadata = () => {
      const duration = Number.isFinite(videoEl.duration) ? videoEl.duration : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    videoEl.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata."));
    };
  });
}

interface Segment {
  /** Which uploaded source video (0, 1 or 2) this segment is cut from. */
  sourceIndex: number;
  start: number;
  length: number;
  /** Rendered in slow-motion (see `applySlowMoToStandoutMoments` below). */
  slowMo?: boolean;
}

/** How much a `slowMo` segment's playback speed is scaled down relative to the style's base speed. */
const SLOW_MO_FACTOR = 0.84;

/** The effective playback speed (base style speed, optionally halved for slow-mo segments) used both for the ffmpeg `setpts` filter and for computing the resulting clip duration. */
function effectiveSpeed(seg: Segment, recipe: StyleRecipe): number {
  return seg.slowMo ? recipe.speed * SLOW_MO_FACTOR : recipe.speed;
}

/**
 * Flags a handful of the standout clips (highest AI confidence, and long
 * enough to actually read as a slow-mo beat rather than a stutter) to play
 * back in slow motion — "parfois des ralentis si des moments s'y prêtent".
 * Applied sparingly: roughly 1 in 3 eligible clips, never two in a row, and
 * skipped for very short/snappy clips where slow-mo would just look choppy.
 */
function applySlowMoToStandoutMoments(segments: Segment[], moments: BestMoment[]): Segment[] {
  // The current UX target forbids shots that appear frozen/over-held.
  // A dedicated map intro now owns the first seconds of the reel, so the
  // footage montage itself should stay energetic: no automatic slow-motion,
  // no repeated "same clip but slower" beats, and a reliably dynamic first
  // real shot immediately after the map.
  void moments;
  return segments;
}

function pickDistinctMoments(moments: BestMoment[], clipDuration: number): BestMoment[] {
  const minGap = Math.max(2.2, clipDuration * 0.85);
  const chosen: BestMoment[] = [];

  for (const moment of [...moments].sort((a, b) => b.confidence - a.confidence)) {
    const overlapsExisting = chosen.some((picked) => {
      const startGap = Math.abs(picked.startSeconds - moment.startSeconds);
      const endGap = Math.abs(picked.endSeconds - moment.endSeconds);
      const intersects =
        moment.startSeconds < picked.endSeconds + minGap * 0.2 && picked.startSeconds < moment.endSeconds + minGap * 0.2;
      return intersects || (startGap < minGap && endGap < minGap);
    });
    if (!overlapsExisting) chosen.push(moment);
  }

  return chosen.sort((a, b) => a.startSeconds - b.startSeconds);
}

/** Picks up to `recipe.reelClipCount` of the AI-detected best moments, fairly distributed across every source video (round-robin by per-video confidence) so a multi-video upload doesn't get dominated by whichever video happened to produce its moments first in the list. */
function planReelSegments(bestMoments: BestMoment[], recipe: StyleRecipe, videoDurations: number[]): Segment[] {
  const byVideo = new Map<number, BestMoment[]>();
  for (const m of bestMoments) {
    const list = byVideo.get(m.sourceIndex);
    if (list) list.push(m);
    else byVideo.set(m.sourceIndex, [m]);
  }
  for (const [sourceIndex, list] of byVideo.entries()) {
    byVideo.set(sourceIndex, pickDistinctMoments(list, recipe.clipDuration));
  }

  const activeSources = Array.from(byVideo.keys()).sort((a, b) => a - b);
  const selected: BestMoment[] = [];
  for (let round = 0; selected.length < recipe.reelClipCount; round++) {
    let addedThisRound = false;
    for (const src of activeSources) {
      if (selected.length >= recipe.reelClipCount) break;
      const list = byVideo.get(src)!;
      if (round < list.length) {
        selected.push(list[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }

  const segments = selected
    .map((m) => {
      const videoDuration = videoDurations[m.sourceIndex] ?? 0;
      const targetLength = Math.max(3.4, recipe.clipDuration);
      const momentCenter = (m.startSeconds + m.endSeconds) / 2;
      const start = Math.min(
        Math.max(0, momentCenter - targetLength / 2),
        Math.max(0, videoDuration - 0.3)
      );
      const available = Math.max(0, videoDuration - start);
      const length = Math.max(3.0, Math.min(targetLength, available));
      return { sourceIndex: m.sourceIndex, start, length };
    })
    .filter((s) => s.length > 2.9);

  return applySlowMoToStandoutMoments(segments, selected);
}

/** Samples evenly-spaced segments across all uploaded videos (proportional to each one's length) so a Story can tell the full arc, capped at `maxDurationSeconds`. */
function planStorySegments(videoDurations: number[], recipe: StyleRecipe, maxDurationSeconds: number): Segment[] {
  const totalDuration = videoDurations.reduce((a, b) => a + b, 0);
  if (totalDuration <= 0) return [];

  const perClipNet = recipe.clipDuration / recipe.speed;
  let totalCount = perClipNet > 0 ? Math.floor(maxDurationSeconds / perClipNet) : 8;
  totalCount = Math.max(3, Math.min(totalCount, 18));

  const segments: Segment[] = [];
  videoDurations.forEach((videoDuration, sourceIndex) => {
    if (videoDuration <= 0.3) return;
    const share = videoDuration / totalDuration;
    const count = Math.max(1, Math.round(totalCount * share));
    const step = videoDuration / count;
    const clipLen = Math.max(0.2, Math.min(recipe.clipDuration, step));

    for (let i = 0; i < count; i++) {
      const slotStart = i * step;
      const start = Math.max(0, Math.min(slotStart + (step - clipLen) / 2, Math.max(0, videoDuration - clipLen)));
      segments.push({ sourceIndex, start, length: clipLen });
    }
  });
  return segments;
}

/**
 * Color correction applied to every clip so footage straight off a phone
 * camera doesn't look flat/washed-out in the final Reel: a mild contrast +
 * saturation + gamma lift, tuned to stay natural rather than "HDR-oversaturated".
 */
const COLOR_CORRECTION_FILTER = "eq=contrast=1.08:saturation=1.28:gamma=1.03:brightness=0.01";

/**
 * Builds the ffmpeg video filter for a single segment.
 *
 * `fastMode = true` (when renderSpeedProfile is "fast") skips `zoompan` entirely
 * and replaces it with a lightweight static scale + crop. Ken Burns is beautiful
 * but processes every frame through bilinear scaling — the single biggest
 * performance bottleneck at 1080p (≈ 80 frames × 2 MB/frame per segment).
 * Removing it cuts Phase 1 time by roughly 3–5× on a mid-range laptop.
 */
function buildSegmentFilter(seg: Segment, index: number, recipe: StyleRecipe, w: number, h: number, fps: number, fastMode = false) {
  const speed = effectiveSpeed(seg, recipe);

  if (fastMode) {
    // Fast mode: scale/crop + color correction, no zoompan.
    return (
      `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` +
      `${COLOR_CORRECTION_FILTER},` +
      `setpts=(PTS-STARTPTS)/${speed}`
    );
  }

  const { zoom, zoomIntensity } = recipe;
  // `zoompan`'s own `d=1:fps=...` timing engine re-stamps every frame's PTS
  // from scratch based purely on frame count, so it silently discards any
  // upstream `setpts` timeline stretch/compression. That means the zoom
  // pacing below must be computed against the *pre-speed* frame count
  // (seg.length), and `setpts` (the actual speed/slow-mo change) has to be
  // applied *after* zoompan — as the very last filter — so it's the last
  // thing touching PTS and the real encoded duration matches
  // `segmentDurations` (seg.length / speed) used for the Phase 2 xfade math.
  const frames = Math.max(1, Math.round(seg.length * fps));
  const dir = zoom === "alternate" ? (index % 2 === 0 ? "in" : "out") : zoom;
  const inc = (zoomIntensity - 1) / frames;
  const zExpr = dir === "in" ? `min(1+on*${inc.toFixed(6)},${zoomIntensity})` : `max(${zoomIntensity}-on*${inc.toFixed(6)},1)`;

  return (
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` +
    `${COLOR_CORRECTION_FILTER},` +
    `zoompan=z='${zExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=${fps},` +
    `setpts=(PTS-STARTPTS)/${speed}`
  );
}

export type MontageMode = "reel" | "story";
export type RenderQuality = "720p" | "1080p";
export type RenderSpeedProfile = "standard" | "fast";

const QUALITY_DIMENSIONS: Record<RenderQuality, { w: number; h: number }> = {
  "720p": { w: 720, h: 1280 },
  "1080p": { w: 1080, h: 1920 },
};

/** Maps the demo plan tier to a render resolution — Pro plans render sharper (and, being fewer pixels for Free, faster too). */
export function qualityForPlan(): RenderQuality {
  return "1080p";
}

const RENDER_FPS = 24;

/** Draws a rounded rectangle path (used by the watermark canvas generator below). */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Generates a small "ClipsyReel" watermark badge as a PNG (client-side
 * canvas — no server round-trip), sized relative to the output frame width.
 * Discreet (small, semi-transparent pill) but easily identifiable (readable
 * wordmark + brand-gradient mark), matching the badge shown in the app's own
 * preview UI. Burned into the actual exported MP4 for Free-plan renders via
 * an `overlay` filter (see `buildMontage` below) — unlike a CSS overlay in
 * the preview, this is present in the downloaded file itself.
 */
async function generateWatermarkPng(frameWidth: number): Promise<Uint8Array> {
  const width = Math.max(140, Math.round(frameWidth * 0.42));
  const height = Math.round(width * 0.26);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRectPath(ctx, 0, 0, width, height, height / 2);
  ctx.fill();

  const markR = height * 0.34;
  const markCx = height * 0.58;
  const markCy = height / 2;
  const grad = ctx.createLinearGradient(markCx - markR, markCy - markR, markCx + markR, markCy + markR);
  grad.addColorStop(0, "#e879f9");
  grad.addColorStop(1, "#fb923c");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(markCx, markCy, markR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  const triSize = markR * 0.85;
  ctx.beginPath();
  ctx.moveTo(markCx - triSize * 0.3, markCy - triSize * 0.5);
  ctx.lineTo(markCx - triSize * 0.3, markCy + triSize * 0.5);
  ctx.lineTo(markCx + triSize * 0.55, markCy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.font = `700 ${Math.round(height * 0.36)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("ClipsyReel", height * 1.12, height / 2 + height * 0.02);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Watermark canvas export failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

async function generateOverlayTextPng(frameWidth: number, frameHeight: number, text: string): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, frameWidth, frameHeight);

  const cardWidth = Math.round(frameWidth * 0.82);
  const paddingX = Math.round(frameWidth * 0.06);
  const y = Math.round(frameHeight * 0.64);
  const x = Math.round((frameWidth - cardWidth) / 2);
  const maxTextWidth = cardWidth - paddingX * 2;

  ctx.font = `700 ${Math.round(frameWidth * 0.058)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const lines = wrapCanvasText(ctx, text, maxTextWidth);
  const lineHeight = Math.round(frameWidth * 0.072);
  const cardHeight = Math.max(Math.round(frameHeight * 0.1), paddingX * 2 + lines.length * lineHeight);

  ctx.fillStyle = "rgba(0,0,0,0.46)";
  roundRectPath(ctx, x, y, cardWidth, cardHeight, Math.round(cardHeight / 2));
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const centerX = frameWidth / 2;
  const startY = y + cardHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, startY + index * lineHeight);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Overlay text canvas export failed"))), "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
}

function planOverlayTextWindows(texts: string[], totalDuration: number, introDuration: number, outroDuration: number) {
  if (texts.length === 0) return [];

  const startBoundary = Math.max(0.35, introDuration + 0.35);
  const endBoundary = Math.max(startBoundary, totalDuration - Math.max(0.35, outroDuration + 0.35));
  const available = endBoundary - startBoundary;
  if (available < 1.8) return [];

  const gap = texts.length > 1 ? 0.45 : 0;
  const rawDuration = (available - gap * Math.max(0, texts.length - 1)) / texts.length;
  const overlayDuration = clamp(rawDuration, 1.8, 4.2);
  const totalNeeded = overlayDuration * texts.length + gap * Math.max(0, texts.length - 1);
  const offset = Math.max(0, (available - totalNeeded) / 2);

  return texts.map((text, index) => {
    const start = startBoundary + offset + index * (overlayDuration + gap);
    const end = Math.min(endBoundary, start + overlayDuration);
    return { text, start, end };
  });
}

export interface BuildMontageParams {
  /** Up to 3 source videos to combine into one montage. */
  files: File[];
  /** Real duration (seconds) of each file in `files`, same order. */
  videoDurations: number[];
  /** Optional intro clip prepended before the best-moment montage (e.g. a 3D route flyover). */
  introClip?: { file: File; durationSeconds: number };
  /** Optional end card appended after the montage (e.g. gear summary). */
  outroClip?: { file: File; durationSeconds: number };
  style: ReelStyle;
  mode: MontageMode;
  bestMoments: BestMoment[];
  /** Instagram Story hard cap — defaults to 60s (current IG limit). */
  maxStorySeconds?: number;
  /** Working resolution — lower = faster render. Defaults to "720p". */
  quality?: RenderQuality;
  /** Burns a small "ClipsyReel" badge into the bottom-right corner of the exported MP4 (Free plan). */
  watermark?: boolean;
  /** Controls encoder speed at fixed 1080p: "fast" skips Ken Burns zoom (3–5× speedup) at the cost of static framing. */
  renderSpeedProfile?: RenderSpeedProfile;
  /** Up to three custom overlay texts burned into the final exported MP4. */
  overlayTexts?: string[];
  /** Called with a 0–1 ratio whenever rendering progresses. Never exceeds 0.97 until the file is fully written. */
  onProgress?: (ratio: number) => void;
  /** Called with a human-readable label at the start of each pipeline phase (for UI status display). */
  onPhaseChange?: (label: string) => void;
}

export interface BuildMontageResult {
  url: string;
  blob: Blob;
  durationSeconds: number;
  clipCount: number;
}

function ensureNonEmptyVideoBlob(data: Uint8Array, mimeType: string) {
  const bytes = new Uint8Array(data);
  if (bytes.byteLength === 0) {
    throw new Error("Rendered video output was empty.");
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Renders a real, style-matched montage (cuts + Ken Burns zoom + randomized
 * xfade transitions) from up to 3 uploaded videos, entirely client-side via
 * ffmpeg.wasm.
 *
 * - mode "reel": short highlight cut built only from the AI-detected best moments.
 * - mode "story": longer cut sampled across all uploaded footage, capped at `maxStorySeconds`.
 *
 * MUTUAL EXCLUSION — only one render runs at a time. ffmpeg.wasm is
 * single-threaded and shares a single Emscripten FS. Concurrent calls
 * (triggered by React effect re-runs) corrupt the FS → ErrnoError. The
 * render lock serialises them: the second call waits for the first to finish.
 */
export async function buildMontage(params: BuildMontageParams): Promise<BuildMontageResult> {
  // Acquire render lock — wait for any ongoing render to finish first.
  const prev = renderLock;
  let releaseLock!: () => void;
  renderLock = new Promise<void>((resolve) => { releaseLock = resolve; });
  if (prev) {
    try { await prev; } catch { /* previous render failed; safe to continue */ }
  }
  try {
    return await _buildMontage(params);
  } catch (err) {
    // ErrnoError from Emscripten FS usually means the singleton is
    // corrupted (stale files, OOM, or concurrent access). Reset it so the
    // next render gets a fresh instance.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("FS error") || msg.includes("ErrnoError") || msg.includes("errno")) {
      console.warn("[video-engine] FS error detected — resetting ffmpeg singleton for next render");
      resetFFmpegSingleton();
    }
    throw err;
  } finally {
    releaseLock();
    renderLock = null;
  }
}

async function _buildMontage(params: BuildMontageParams): Promise<BuildMontageResult> {
  const {
    files,
    videoDurations,
    introClip,
    outroClip,
    style,
    mode,
    bestMoments,
    maxStorySeconds = 60,
    quality = "720p",
    watermark = false,
    renderSpeedProfile = "standard",
    overlayTexts = [],
    onProgress,
    onPhaseChange,
  } = params;

  // Fast mode: skips Ken Burns zoompan — 3–5× speedup on Phase 1 at the cost
  // of static framing. Trades cinematic zoom for responsiveness.
  const fastMode = renderSpeedProfile === "fast";

  const recipe = STYLE_RECIPES[style];
  const transitionPool = STYLE_TRANSITIONS[style];
  const { w, h } = QUALITY_DIMENSIONS[quality];
  const finalPreset = renderSpeedProfile === "fast" ? "superfast" : "veryfast";
  const finalCrf = renderSpeedProfile === "fast" ? "25" : "23";
  const watermarkMargin = Math.round(w * 0.035);
  const cleanedOverlayTexts = overlayTexts.map((text) => text.trim()).filter(Boolean).slice(0, 3);

  const segments = mode === "reel" ? planReelSegments(bestMoments, recipe, videoDurations) : planStorySegments(videoDurations, recipe, maxStorySeconds);

  if (segments.length === 0) {
    throw new Error("Video is too short to build a montage.");
  }

  // ── Profiling ─────────────────────────────────────────────────────────────
  // Records wall-clock ms for each pipeline phase. Logged on completion so
  // bottlenecks are immediately visible in devtools.
  const perf: Record<string, number> = {};
  const mark = (label: string) => { perf[label] = performance.now(); };
  const elapsed = (from: string, to: string) =>
    `${((perf[to] - perf[from]) / 1000).toFixed(1)}s`;

  mark("start");
  console.group("[video-engine] Render pipeline started");
  console.log(`Quality: ${quality} | fastMode: ${fastMode} | segments: ${segments.length}`);

  const ffmpeg = await loadFFmpeg();
  mark("ffmpeg-ready");

  onPhaseChange?.("Loading video files…");
  onProgress?.(0.01);

  const stamp = Date.now();

  // Write all source files to ffmpeg FS upfront.
  // Serialised (not parallel) to keep peak FS memory predictable.
  const inputNames: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const name = `src_${stamp}_${i}.mp4`;
    await ffmpeg.writeFile(name, await fetchFile(files[i]));
    inputNames.push(name);
    onProgress?.(0.01 + (i + 1) / files.length * 0.03);
  }
  mark("files-written");
  console.log(`[video-engine] File write: ${elapsed("ffmpeg-ready", "files-written")}`);

  let introSourceName: string | null = null;
  if (introClip) {
    introSourceName = `intro_${stamp}.webm`;
    await ffmpeg.writeFile(introSourceName, await fetchFile(introClip.file));
  }

  let outroSourceName: string | null = null;
  if (outroClip) {
    outroSourceName = `outro_${stamp}.webm`;
    await ffmpeg.writeFile(outroSourceName, await fetchFile(outroClip.file));
  }

  let watermarkName: string | null = null;
  if (watermark) {
    watermarkName = `wm_${stamp}.png`;
    await ffmpeg.writeFile(watermarkName, await generateWatermarkPng(w));
  }

  // ── Progress accounting ───────────────────────────────────────────────────
  // IMPORTANT: progress is capped at 0.97 throughout the render loop.
  // The final 3% (0.97→0.99→1.0) are emitted manually after the FS read and
  // blob creation complete — so the bar never shows 100% while the user is
  // still waiting for the file to be available.
  const normalizedClipUnits = (introClip ? 1 : 0) + (outroClip ? 1 : 0);
  const needsComposePass = segments.length + (introClip ? 1 : 0) + (outroClip ? 1 : 0) > 1 || !!watermark;
  const totalUnits = normalizedClipUnits + segments.length + (needsComposePass ? 1 : 0);
  const PROGRESS_RENDER_MAX = 0.93; // cap during ffmpeg work; last 7% = file ops + verification
  let completedUnits = 0;
  // Clamp to highest seen: ffmpeg.wasm progress events are non-monotonic
  // within a single exec() call (short passes can briefly dip).
  let highestRatioReported = 0.04;
  const reportUnitProgress = (ratio: number) => {
    if (!Number.isFinite(ratio)) return;
    const raw = (completedUnits + Math.min(1, Math.max(0, ratio))) / totalUnits;
    const value = Math.min(PROGRESS_RENDER_MAX, raw * PROGRESS_RENDER_MAX);
    highestRatioReported = Math.max(highestRatioReported, value);
    onProgress?.(highestRatioReported);
  };

  const progressHandler = ({ progress }: { progress: number }) => reportUnitProgress(progress);
  ffmpeg.on("progress", progressHandler);

  const segmentClipNames: string[] = [];
  const segmentDurations: number[] = [];
  const tempFiles: string[] = [...inputNames, ...(introSourceName ? [introSourceName] : []), ...(outroSourceName ? [outroSourceName] : []), ...(watermarkName ? [watermarkName] : [])];
  const overlayTextNames: string[] = [];

  try {
    for (let i = 0; i < cleanedOverlayTexts.length; i++) {
      const name = `overlay_text_${stamp}_${i}.png`;
      await ffmpeg.writeFile(name, await generateOverlayTextPng(w, h, cleanedOverlayTexts[i]));
      overlayTextNames.push(name);
      tempFiles.push(name);
    }

    const appendOverlayFilters = (
      filterParts: string[],
      baseLabel: string,
      firstInputIndex: number,
      durationSeconds: number,
      labelPrefix: string
    ) => {
      if (overlayTextNames.length === 0) {
        return { finalLabel: baseLabel, overlaysUsed: 0 };
      }

      const overlays = planOverlayTextWindows(
        cleanedOverlayTexts,
        durationSeconds,
        introClip?.durationSeconds ?? 0,
        outroClip?.durationSeconds ?? 0
      );
      if (overlays.length === 0) {
        return { finalLabel: baseLabel, overlaysUsed: 0 };
      }

      let currentLabel = baseLabel;
      overlays.forEach((overlay, index) => {
        const inputIndex = firstInputIndex + index;
        const textLabel = `${labelPrefix}_txtsrc_${index}`;
        const outLabel = `${labelPrefix}_txt_${index}`;
        filterParts.push(`[${inputIndex}:v]format=rgba[${textLabel}]`);
        filterParts.push(
          `[${currentLabel}][${textLabel}]overlay=(W-w)/2:H*0.64:enable='between(t,${overlay.start.toFixed(3)},${overlay.end.toFixed(3)})'[${outLabel}]`
        );
        currentLabel = outLabel;
      });

      return { finalLabel: currentLabel, overlaysUsed: overlays.length };
    };

    let introName: string | null = null;
    if (introSourceName) {
      onPhaseChange?.("Transcoding map intro…");
      mark("intro-start");
      introName = `intro_norm_${stamp}.mp4`;
      await ffmpeg.exec([
        "-fflags", "+genpts",
        "-i", introSourceName,
        "-vf", `fps=${RENDER_FPS},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setpts=PTS-STARTPTS,format=yuv420p`,
        "-an",
        "-r", String(RENDER_FPS),
        "-c:v", "libx264",
        "-preset", finalPreset,
        "-crf", finalCrf,
        "-pix_fmt", "yuv420p",
        introName,
      ]);
      tempFiles.push(introName);
      completedUnits++;
      mark("intro-done");
      console.log(`[video-engine] Map intro transcode: ${elapsed("intro-start", "intro-done")}`);
    }

    let outroName: string | null = null;
    if (outroSourceName) {
      onPhaseChange?.("Transcoding outro card…");
      mark("outro-start");
      outroName = `outro_norm_${stamp}.mp4`;
      await ffmpeg.exec([
        "-fflags", "+genpts",
        "-i", outroSourceName,
        "-vf", `fps=${RENDER_FPS},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setpts=PTS-STARTPTS,format=yuv420p`,
        "-an",
        "-r", String(RENDER_FPS),
        "-c:v", "libx264",
        "-preset", finalPreset,
        "-crf", finalCrf,
        "-pix_fmt", "yuv420p",
        outroName,
      ]);
      tempFiles.push(outroName);
      completedUnits++;
      mark("outro-done");
      console.log(`[video-engine] Outro transcode: ${elapsed("outro-start", "outro-done")}`);
    }

    // --- Phase 1: extract + Ken Burns zoom each segment (fast seek, small decode) ---
    onPhaseChange?.(fastMode ? `Cutting ${segments.length} clips…` : `Cutting & zooming ${segments.length} clips…`);
    mark("phase1-start");
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const clipName = `seg_${stamp}_${i}.mp4`;
      // Pass fastMode to skip zoompan (the main per-frame bottleneck)
      const filter = buildSegmentFilter(seg, i, recipe, w, h, RENDER_FPS, fastMode);

      await ffmpeg.exec([
        // NOTE: -ss and -t must both come *before* -i. When -t is placed
        // after -i (with no further -i afterwards) ffmpeg treats it as an
        // OUTPUT duration limit applied *after* the filtergraph instead of
        // an input trim — so it was cutting/measuring the clip on the
        // post-`setpts` (speed-adjusted) timeline rather than trimming
        // `seg.length` seconds of source. That silently desynced the real
        // encoded clip duration from `segmentDurations` below for any
        // style/segment with speed != 1 (i.e. almost everything, and
        // especially slow-mo segments), which threw off the Phase 2 xfade
        // `offset` math and made transitions land wrong or disappear.
        "-ss", seg.start.toFixed(3),
        "-t", seg.length.toFixed(3),
        "-i", inputNames[seg.sourceIndex],
        "-vf", filter,
        "-an",
        "-r", String(RENDER_FPS),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "27",
        "-pix_fmt", "yuv420p",
        clipName,
      ]);

      segmentClipNames.push(clipName);
      segmentDurations.push(seg.length / effectiveSpeed(seg, recipe));
      tempFiles.push(clipName);
      completedUnits++;
    }
    mark("phase1-done");
    console.log(`[video-engine] Phase 1 (${segments.length} clips, fastMode=${fastMode}): ${elapsed("phase1-start", "phase1-done")}`);

    const finalClipNames = [...(introName ? [introName] : []), ...segmentClipNames, ...(outroName ? [outroName] : [])];
    const finalDurations = [...(introName ? [introClip!.durationSeconds] : []), ...segmentDurations, ...(outroName ? [outroClip!.durationSeconds] : [])];

    // ── Helper: read + convert output file, then report final progress phases ──
    const finaliseOutput = async (name: string, durationSeconds: number, clipCount: number): Promise<BuildMontageResult> => {
      onPhaseChange?.("Writing output file…");
      onProgress?.(0.95);
      const data = await ffmpeg.readFile(name);
      onProgress?.(0.97);
      onPhaseChange?.("Verifying export…");
      const blob = ensureNonEmptyVideoBlob(data as Uint8Array, "video/mp4");
      onProgress?.(0.99);
      const url = URL.createObjectURL(blob);
      mark("done");
      const totalMs = perf["done"] - perf["start"];
      console.log(`[video-engine] Total render time: ${(totalMs / 1000).toFixed(1)}s`);
      console.log("[video-engine] Phase breakdown:", Object.fromEntries(
        Object.keys(perf).filter((_, i, a) => i < a.length - 1).map((k, i, a) => [
          `${k}→${a[i + 1]}`,
          `${((perf[a[i + 1]] - perf[k]) / 1000).toFixed(1)}s`,
        ])
      ));
      console.groupEnd();
      onProgress?.(1.0);
      return { url, blob, durationSeconds, clipCount };
    };

    // --- Single clip, no watermark: no re-encode needed, it *is* the final montage ---
    if (finalClipNames.length === 1 && !watermark) {
      if (overlayTextNames.length === 0) {
        return finaliseOutput(finalClipNames[0], finalDurations[0], 1);
      }

      const outputName = `out_${stamp}.mp4`;
      const filterParts: string[] = [];
      const { finalLabel, overlaysUsed } = appendOverlayFilters(filterParts, "0:v", 1, finalDurations[0], "single");
      if (overlaysUsed === 0) {
        return finaliseOutput(finalClipNames[0], finalDurations[0], 1);
      }
      onPhaseChange?.("Burning in overlay text…");
      await ffmpeg.exec([
        "-i",
        finalClipNames[0],
        ...overlayTextNames.slice(0, overlaysUsed).flatMap((name) => ["-i", name]),
        "-filter_complex",
        filterParts.join(";"),
        "-map",
        `[${finalLabel}]`,
        "-an",
        "-r",
        String(RENDER_FPS),
        "-c:v",
        "libx264",
        "-preset",
        finalPreset,
        "-crf",
        finalCrf,
        "-pix_fmt",
        "yuv420p",
        outputName,
      ]);
      completedUnits++;
      tempFiles.push(outputName);
      return finaliseOutput(outputName, finalDurations[0], 1);
    }

    // --- Single clip + watermark: one lightweight overlay pass, no cross-fade needed ---
    if (finalClipNames.length === 1 && watermark) {
      onPhaseChange?.("Applying watermark…");
      const outputName = `out_${stamp}.mp4`;
      const filterParts = [`[1:v]format=rgba[wm]`, `[0:v][wm]overlay=W-w-${watermarkMargin}:H-h-${watermarkMargin}[vwm]`];
      const { finalLabel, overlaysUsed } = appendOverlayFilters(filterParts, "vwm", 2, finalDurations[0], "singlewm");
      await ffmpeg.exec([
        "-i", finalClipNames[0],
        "-i", watermarkName as string,
        ...overlayTextNames.slice(0, overlaysUsed).flatMap((name) => ["-i", name]),
        "-filter_complex",
        filterParts.join(";"),
        "-map",
        `[${finalLabel}]`,
        "-an",
        "-r", String(RENDER_FPS),
        "-c:v", "libx264",
        "-preset", finalPreset,
        "-crf", finalCrf,
        "-pix_fmt", "yuv420p",
        outputName,
      ]);
      completedUnits++;
      tempFiles.push(outputName);
      return finaliseOutput(outputName, finalDurations[0], 1);
    }

    // --- Phase 2: cross-fade the small pre-rendered clips together (+ optional watermark overlay) ---
    onPhaseChange?.(`Compositing ${finalClipNames.length} clips with transitions…`);
    mark("phase2-start");
    const filterParts: string[] = [];
    let prevLabel = "0:v";
    let acc = finalDurations[0];
    let prevTransitionName: string | null = null;

    for (let i = 1; i < finalClipNames.length; i++) {
      const transitionName = pickTransitionName(transitionPool, prevTransitionName);
      const transitionDuration = Math.min(randomTransitionDuration(transitionPool), finalDurations[i - 1], finalDurations[i]);
      prevTransitionName = transitionName;

      const offset = Math.max(0, acc - transitionDuration);
      const outLabel = i === finalClipNames.length - 1 ? "vpre" : `x${i}`;
      filterParts.push(
        `[${prevLabel}][${i}:v]xfade=transition=${transitionName}:duration=${transitionDuration.toFixed(3)}:offset=${offset.toFixed(3)}[${outLabel}]`
      );
      acc = acc + finalDurations[i] - transitionDuration;
      prevLabel = outLabel;
    }

    const execArgs = finalClipNames.flatMap((name) => ["-i", name]);
    let mapTarget = "[vpre]";
    const overlayStartIndex = finalClipNames.length + (watermark ? 1 : 0);
    if (watermark) {
      const wmInputIndex = finalClipNames.length;
      execArgs.push("-i", watermarkName as string);
      filterParts.push(`[${wmInputIndex}:v]format=rgba[wm]`);
      filterParts.push(`[vpre][wm]overlay=W-w-${watermarkMargin}:H-h-${watermarkMargin}[vout]`);
      mapTarget = "[vout]";
    }
    const { finalLabel, overlaysUsed } = appendOverlayFilters(
      filterParts,
      mapTarget.slice(1, -1),
      overlayStartIndex,
      Math.max(acc, 0.5),
      "multi"
    );
    execArgs.push(...overlayTextNames.slice(0, overlaysUsed).flatMap((name) => ["-i", name]));

    const outputName = `out_${stamp}.mp4`;
    execArgs.push(
      "-filter_complex", filterParts.join(";"),
      "-map", `[${finalLabel}]`,
      "-an",
      "-r", String(RENDER_FPS),
      "-c:v", "libx264",
      "-preset", finalPreset,
      "-crf", finalCrf,
      "-pix_fmt", "yuv420p",
      outputName
    );

    await ffmpeg.exec(execArgs);
    completedUnits++;
    mark("phase2-done");
    console.log(`[video-engine] Phase 2 (compose): ${elapsed("phase2-start", "phase2-done")}`);

    tempFiles.push(outputName);
    return finaliseOutput(outputName, Math.max(acc, 0.5), finalClipNames.length);
  } finally {
    ffmpeg.off("progress", progressHandler);
    await Promise.all(tempFiles.map((name) => ffmpeg.deleteFile(name).catch(() => {})));
  }
}
