"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { BestMoment, PlanId, ReelStyle } from "@/types";
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
const SLOW_MO_FACTOR = 0.5;

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
  const MIN_LENGTH_FOR_SLOWMO = 0.9;
  const confidenceThreshold = 78;
  let lastWasSlowMo = false;
  let slowMoCount = 0;
  const maxSlowMo = Math.max(1, Math.ceil(segments.length / 3));

  return segments.map((seg, i) => {
    const moment = moments[i];
    const eligible =
      !!moment &&
      moment.confidence >= confidenceThreshold &&
      seg.length >= MIN_LENGTH_FOR_SLOWMO &&
      !lastWasSlowMo &&
      slowMoCount < maxSlowMo;

    if (eligible) {
      lastWasSlowMo = true;
      slowMoCount++;
      return { ...seg, slowMo: true };
    }
    lastWasSlowMo = false;
    return seg;
  });
}

/** Picks up to `recipe.reelClipCount` of the AI-detected best moments, fairly distributed across every source video (round-robin by per-video confidence) so a multi-video upload doesn't get dominated by whichever video happened to produce its moments first in the list. */
function planReelSegments(bestMoments: BestMoment[], recipe: StyleRecipe, videoDurations: number[]): Segment[] {
  const byVideo = new Map<number, BestMoment[]>();
  for (const m of bestMoments) {
    const list = byVideo.get(m.sourceIndex);
    if (list) list.push(m);
    else byVideo.set(m.sourceIndex, [m]);
  }
  // Best moment of each video first, so round-robin picks the strongest ones before dipping into weaker ones.
  for (const list of byVideo.values()) list.sort((a, b) => b.confidence - a.confidence);

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

  // Group clips by source (in upload order) and chronologically within each source, so the montage reads as "video 1 highlights → video 2 highlights → video 3 highlights" rather than jumping randomly between sources.
  selected.sort((a, b) => a.sourceIndex - b.sourceIndex || a.startSeconds - b.startSeconds);

  const segments = selected
    .map((m) => {
      const videoDuration = videoDurations[m.sourceIndex] ?? 0;
      const start = Math.min(Math.max(0, m.startSeconds), Math.max(0, videoDuration - 0.3));
      const available = Math.max(0, videoDuration - start);
      const momentLen = Math.max(0.3, m.endSeconds - m.startSeconds);
      const length = Math.max(0.3, Math.min(recipe.clipDuration, momentLen, available));
      return { sourceIndex: m.sourceIndex, start, length };
    })
    .filter((s) => s.length > 0.15);

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

/** Builds the ffmpeg video filter for a single segment: scale/crop to the target 9:16 frame + Ken Burns zoom + color correction (+ optional slow-mo). */
function buildSegmentFilter(seg: Segment, index: number, recipe: StyleRecipe, w: number, h: number, fps: number) {
  const { zoom, zoomIntensity } = recipe;
  const speed = effectiveSpeed(seg, recipe);
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

const QUALITY_DIMENSIONS: Record<RenderQuality, { w: number; h: number }> = {
  "720p": { w: 720, h: 1280 },
  "1080p": { w: 1080, h: 1920 },
};

/** Maps the demo plan tier to a render resolution — Pro plans render sharper (and, being fewer pixels for Free, faster too). */
export function qualityForPlan(plan: PlanId): RenderQuality {
  return plan === "free" ? "720p" : "1080p";
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

export interface BuildMontageParams {
  /** Up to 3 source videos to combine into one montage. */
  files: File[];
  /** Real duration (seconds) of each file in `files`, same order. */
  videoDurations: number[];
  style: ReelStyle;
  mode: MontageMode;
  bestMoments: BestMoment[];
  /** Instagram Story hard cap — defaults to 60s (current IG limit). */
  maxStorySeconds?: number;
  /** Working resolution — lower = faster render. Defaults to "720p". */
  quality?: RenderQuality;
  /** Burns a small "ClipsyReel" badge into the bottom-right corner of the exported MP4 (Free plan). */
  watermark?: boolean;
  onProgress?: (ratio: number) => void;
}

export interface BuildMontageResult {
  url: string;
  blob: Blob;
  durationSeconds: number;
  clipCount: number;
}

/**
 * Renders a real, style-matched montage (cuts + Ken Burns zoom + randomized
 * xfade transitions) from up to 3 uploaded videos, entirely client-side via
 * ffmpeg.wasm.
 *
 * - mode "reel": short highlight cut built only from the AI-detected best moments.
 * - mode "story": longer cut sampled across all uploaded footage, capped at `maxStorySeconds`.
 */
export async function buildMontage(params: BuildMontageParams): Promise<BuildMontageResult> {
  const {
    files,
    videoDurations,
    style,
    mode,
    bestMoments,
    maxStorySeconds = 60,
    quality = "720p",
    watermark = false,
    onProgress,
  } = params;

  const recipe = STYLE_RECIPES[style];
  const transitionPool = STYLE_TRANSITIONS[style];
  const { w, h } = QUALITY_DIMENSIONS[quality];
  const watermarkMargin = Math.round(w * 0.035);

  const segments = mode === "reel" ? planReelSegments(bestMoments, recipe, videoDurations) : planStorySegments(videoDurations, recipe, maxStorySeconds);

  if (segments.length === 0) {
    throw new Error("Video is too short to build a montage.");
  }

  const ffmpeg = await loadFFmpeg();
  const stamp = Date.now();
  const inputNames = await Promise.all(
    files.map(async (file, i) => {
      const name = `src_${stamp}_${i}.mp4`;
      await ffmpeg.writeFile(name, await fetchFile(file));
      return name;
    })
  );

  let watermarkName: string | null = null;
  if (watermark) {
    watermarkName = `wm_${stamp}.png`;
    await ffmpeg.writeFile(watermarkName, await generateWatermarkPng(w));
  }

  // Total "work units": one per segment (phase 1 extraction) + one for the
  // final compose pass. The compose pass happens whenever there's more than
  // 1 clip (cross-fade) OR a watermark needs burning in (even for a single
  // clip, that now requires one extra encode pass).
  const needsComposePass = segments.length > 1 || !!watermark;
  const totalUnits = segments.length + (needsComposePass ? 1 : 0);
  let completedUnits = 0;
  // ffmpeg.wasm's own "progress" events aren't always monotonic within a
  // single exec() call (short/ultrafast passes can briefly report a ratio
  // that dips before settling), which made the bar visibly "jump forward,
  // then slide back". Clamping to the highest ratio seen so far guarantees
  // the reported progress only ever moves forward, so it reads as smooth
  // and linear even if the underlying events are noisy.
  let highestRatioReported = 0;
  const reportUnitProgress = (ratio: number) => {
    if (!Number.isFinite(ratio)) return;
    const value = Math.min(1, (completedUnits + Math.min(1, Math.max(0, ratio))) / totalUnits);
    highestRatioReported = Math.max(highestRatioReported, value);
    onProgress?.(highestRatioReported);
  };

  const progressHandler = ({ progress }: { progress: number }) => reportUnitProgress(progress);
  ffmpeg.on("progress", progressHandler);

  const segmentClipNames: string[] = [];
  const segmentDurations: number[] = [];
  const tempFiles: string[] = [...inputNames, ...(watermarkName ? [watermarkName] : [])];

  try {
    // --- Phase 1: extract + Ken Burns zoom each segment (fast seek, small decode) ---
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const clipName = `seg_${stamp}_${i}.mp4`;
      const filter = buildSegmentFilter(seg, i, recipe, w, h, RENDER_FPS);

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

    // --- Single clip, no watermark: no re-encode needed, it *is* the final montage ---
    if (segments.length === 1 && !watermark) {
      const data = await ffmpeg.readFile(segmentClipNames[0]);
      const bytes = new Uint8Array(data as Uint8Array);
      const blob = new Blob([bytes], { type: "video/mp4" });
      return { url: URL.createObjectURL(blob), blob, durationSeconds: segmentDurations[0], clipCount: 1 };
    }

    // --- Single clip + watermark: one lightweight overlay pass, no cross-fade needed ---
    if (segments.length === 1 && watermark) {
      const outputName = `out_${stamp}.mp4`;
      await ffmpeg.exec([
        "-i", segmentClipNames[0],
        "-i", watermarkName as string,
        "-filter_complex", `[1:v]format=rgba[wm];[0:v][wm]overlay=W-w-${watermarkMargin}:H-h-${watermarkMargin}[vout]`,
        "-map", "[vout]",
        "-an",
        "-r", String(RENDER_FPS),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        outputName,
      ]);
      completedUnits++;
      const data = await ffmpeg.readFile(outputName);
      const bytes = new Uint8Array(data as Uint8Array);
      const blob = new Blob([bytes], { type: "video/mp4" });
      tempFiles.push(outputName);
      return { url: URL.createObjectURL(blob), blob, durationSeconds: segmentDurations[0], clipCount: 1 };
    }

    // --- Phase 2: cross-fade the small pre-rendered clips together (+ optional watermark overlay) ---
    const filterParts: string[] = [];
    let prevLabel = "0:v";
    let acc = segmentDurations[0];
    let prevTransitionName: string | null = null;

    for (let i = 1; i < segmentClipNames.length; i++) {
      const transitionName = pickTransitionName(transitionPool, prevTransitionName);
      const transitionDuration = Math.min(randomTransitionDuration(transitionPool), segmentDurations[i - 1], segmentDurations[i]);
      prevTransitionName = transitionName;

      const offset = Math.max(0, acc - transitionDuration);
      const outLabel = i === segmentClipNames.length - 1 ? "vpre" : `x${i}`;
      filterParts.push(
        `[${prevLabel}][${i}:v]xfade=transition=${transitionName}:duration=${transitionDuration.toFixed(3)}:offset=${offset.toFixed(3)}[${outLabel}]`
      );
      acc = acc + segmentDurations[i] - transitionDuration;
      prevLabel = outLabel;
    }

    const execArgs = segmentClipNames.flatMap((name) => ["-i", name]);
    let mapTarget = "[vpre]";
    if (watermark) {
      const wmInputIndex = segmentClipNames.length;
      execArgs.push("-i", watermarkName as string);
      filterParts.push(`[${wmInputIndex}:v]format=rgba[wm]`);
      filterParts.push(`[vpre][wm]overlay=W-w-${watermarkMargin}:H-h-${watermarkMargin}[vout]`);
      mapTarget = "[vout]";
    }

    const outputName = `out_${stamp}.mp4`;
    execArgs.push(
      "-filter_complex", filterParts.join(";"),
      "-map", mapTarget,
      "-an",
      "-r", String(RENDER_FPS),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      outputName
    );

    await ffmpeg.exec(execArgs);
    completedUnits++;

    const data = await ffmpeg.readFile(outputName);
    const bytes = new Uint8Array(data as Uint8Array);
    const blob = new Blob([bytes], { type: "video/mp4" });
    tempFiles.push(outputName);
    return { url: URL.createObjectURL(blob), blob, durationSeconds: Math.max(acc, 0.5), clipCount: segments.length };
  } finally {
    ffmpeg.off("progress", progressHandler);
    await Promise.all(tempFiles.map((name) => ffmpeg.deleteFile(name).catch(() => {})));
  }
}
