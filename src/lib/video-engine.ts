"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { BestMoment, GpxRouteStats, ReelStyle, ReelTitleColor, ReelTitleFont, ReelTitleSize, SportTelemetry } from "@/types";
import { STYLE_RECIPES, StyleRecipe } from "@/data/styleRecipes";
import { pickTransitionName, randomTransitionDuration, STYLE_TRANSITIONS } from "@/data/transitions";
import { detectHardwareAcceleration, buildEncoderArgs, HardwareCodec } from "@/lib/hw-acceleration";
import { buildRenderCacheKey, fingerprintFile, getCachedBinaryAsset, putCachedBinaryAsset } from "@/lib/render-asset-cache";
import { filterCoherentDisplayTexts, isCoherentDisplayText } from "@/lib/display-text";
import {
  buildSportHookSequence,
  resolveSportHookPalette,
  planSportHookWindows,
  type SportHookBeat,
  type SportHookEffect,
  type SportHookWindow,
} from "@/lib/sport-style";

const ENABLE_MT_FFMPEG = process.env.NEXT_PUBLIC_ENABLE_MT_FFMPEG === "true";
const INTRO_TRANSCODE_TIMEOUT_MS_FAST = 75_000;
const INTRO_TRANSCODE_TIMEOUT_MS_QUALITY = 110_000;

/** Clone file data to prevent ArrayBuffer detachment issues with FFmpeg worker. */
async function getFileDataForFFmpeg(file: File | Blob): Promise<Uint8Array> {
  const data = await fetchFile(file);
  const source = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data as ArrayBuffer);
  return new Uint8Array(source);
}

function cloneFFmpegData(data: Uint8Array): Uint8Array {
  return new Uint8Array(data);
}

function buildConcatManifest(fileNames: string[]): Uint8Array {
  const manifest = fileNames.map((name) => `file '${name.replace(/'/g, "'\\''")}'`).join("\n");
  return new TextEncoder().encode(`${manifest}\n`);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

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

export function capTransitionDuration(baseTransitionDuration: number, prevClipLength: number, nextClipLength: number): number {
  const safeBase = Number.isFinite(baseTransitionDuration) ? Math.max(0, baseTransitionDuration) : 0;
  const safePrev = Number.isFinite(prevClipLength) ? Math.max(0, prevClipLength) : 0;
  const safeNext = Number.isFinite(nextClipLength) ? Math.max(0, nextClipLength) : 0;
  return Math.max(0, Math.min(safeBase, safePrev * 0.2, safeNext * 0.2));
}

export function shouldUseCompactConcatFallback(style: ReelStyle, clipCount: number): boolean {
  if (style === "sport") return clipCount >= 3;
  return clipCount >= 8;
}

export async function detectVideoHasAudio(file: File | Blob): Promise<boolean> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.playsInline = true;
  video.muted = false;
  video.volume = 1;
  video.src = url;

  return await new Promise<boolean>((resolve) => {
    const cleanup = () => URL.revokeObjectURL(url);
    const finalize = () => {
      const audioTracks = (video as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks;
      const mozHasAudio = (video as HTMLVideoElement & { mozHasAudio?: boolean }).mozHasAudio;
      const webkitAudioDecodedByteCount = (video as HTMLVideoElement & { webkitAudioDecodedByteCount?: number }).webkitAudioDecodedByteCount;
      const hasAudio = Boolean(
        mozHasAudio ||
        webkitAudioDecodedByteCount ||
        (audioTracks && audioTracks.length > 0)
      );
      cleanup();
      resolve(hasAudio);
    };

    video.onloadedmetadata = finalize;
    video.oncanplay = finalize;
    video.onerror = () => {
      cleanup();
      resolve(false);
    };
    video.load();
  });
}

/** Lazily loads & caches a single ffmpeg.wasm instance (core files are self-hosted in /public/ffmpeg). */
async function loadFFmpeg(): Promise<FFmpeg> {
  const ffmpeg = new FFmpeg();
  const coreJsUrl = await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript");
  const wasmUrl = await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm");

  await ffmpeg.load({
    coreURL: coreJsUrl,
    wasmURL: wasmUrl,
  });
  return ffmpeg;
}

/**
 * Preloads the two heaviest render-time dependencies during idle time:
 * ffmpeg.wasm core and hardware codec detection.
 */
export async function preloadRenderPipeline(): Promise<void> {
  await Promise.all([loadFFmpeg(), detectHardwareAcceleration()]);
}

/** Reads the real duration (seconds) of a video file using the browser's own decoder — no ffmpeg needed for this. */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement("video");
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      videoEl.onloadedmetadata = null;
      videoEl.onloadeddata = null;
      videoEl.oncanplay = null;
      videoEl.onerror = null;
      URL.revokeObjectURL(url);
    };
    const finalize = (duration: number | null, error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
        resolve(duration);
        return;
      }
      reject(error ?? new Error("Could not read video metadata."));
    };
    const timeoutId = window.setTimeout(() => {
      finalize(null, new Error("Timed out while reading video metadata."));
    }, 8000);
    videoEl.preload = "metadata";
    videoEl.playsInline = true;
    videoEl.onloadedmetadata = () => {
      finalize(Number.isFinite(videoEl.duration) ? videoEl.duration : null);
    };
    videoEl.onloadeddata = () => {
      finalize(Number.isFinite(videoEl.duration) ? videoEl.duration : null);
    };
    videoEl.oncanplay = () => {
      finalize(Number.isFinite(videoEl.duration) ? videoEl.duration : null);
    };
    videoEl.onerror = () => {
      const mediaError = videoEl.error;
      const detail = mediaError ? ` (MediaError ${mediaError.code}${mediaError.message ? `: ${mediaError.message}` : ""})` : "";
      finalize(null, new Error(`Could not read video metadata.${detail}`));
    };
    videoEl.src = url;
    videoEl.load();
  });
}

export interface Segment {
  /** Which uploaded source video (0, 1 or 2) this segment is cut from. */
  sourceIndex: number;
  start: number;
  length: number;
  /** Confidence score used for source-spread dedupe and editorial selection. */
  confidence?: number;
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
 * How much a "slowmo" creative-plan segment's playback speed is scaled down
 * relative to the style's base speed. Deliberately not too extreme (was
 * 0.62, i.e. ~1.6x slower) — a milder ramp (~1.35x slower) reads as a quick
 * dramatic "punch" rather than the clip visibly dragging, per "les plans en
 * ralenti sont beaucoup trop long" feedback: a real TikTok/Reels slow-mo
 * beat is short AND only mildly slowed, always surrounded by real-speed
 * clips — never a long half-speed shot.
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

function buildSegmentFromMoment(
  moment: BestMoment,
  recipe: StyleRecipe,
  videoDurations: number[],
  centerShiftSeconds = 0
): Segment | null {
  const videoDuration = videoDurations[moment.sourceIndex] ?? 0;
  const isSportRecipe = recipe === STYLE_RECIPES.sport;
  const targetLength = isSportRecipe
    ? clamp(recipe.clipDuration, Math.max(0.85, recipe.minClipDuration), Math.max(1.6, recipe.maxClipDuration))
    : Math.max(3.2, recipe.clipDuration);
  const momentCenter = (moment.startSeconds + moment.endSeconds) / 2 + centerShiftSeconds;
  const start = Math.min(
    Math.max(0, momentCenter - targetLength / 2),
    Math.max(0, videoDuration - (isSportRecipe ? 0.2 : 0.3))
  );
  const available = Math.max(0, videoDuration - start);
  const minLength = isSportRecipe ? Math.max(0.8, recipe.minClipDuration * 0.75) : 3.0;
  const length = Math.max(minLength, Math.min(targetLength, available));
  if (length <= (isSportRecipe ? 0.75 : 2.9)) return null;
  return { sourceIndex: moment.sourceIndex, start, length, confidence: moment.confidence };
}

function estimatedMontageDuration(segments: Segment[], recipe: StyleRecipe): number {
  const raw = segments.reduce((sum, seg) => sum + seg.length / effectiveSpeed(seg, recipe), 0);
  const transitionPenalty = Math.max(0, segments.length - 1) * 0.2;
  return Math.max(0, raw - transitionPenalty);
}

/** Picks clips for a Reel up to `targetDurationSeconds`, allowing non-consecutive reuse when needed. */
export function planReelSegments(
  bestMoments: BestMoment[],
  recipe: StyleRecipe,
  videoDurations: number[],
  targetDurationSeconds: number
): Segment[] {
  const byVideo = new Map<number, BestMoment[]>();
  for (const m of bestMoments) {
    const list = byVideo.get(m.sourceIndex);
    if (list) list.push(m);
    else byVideo.set(m.sourceIndex, [m]);
  }
  for (const [sourceIndex, list] of byVideo.entries()) {
    byVideo.set(sourceIndex, pickDistinctMoments(list, recipe.clipDuration));
  }

  // How many clips does this style's target duration call for at this style's pacing?
  const perClipNet = recipe.clipDuration / recipe.speed;
  const [targetMinSeconds, targetMaxSeconds] = recipe.targetReelSeconds;
  const targetForStyle = perClipNet > 0 ? Math.round(((targetMinSeconds + targetMaxSeconds) / 2) / perClipNet) : recipe.reelClipCount;
  const clipCap = recipe === STYLE_RECIPES.sport ? 48 : 12;
  // Never exceed the reel duration target or the render-performance clip cap, even if a style target/lots of footage would suggest more.
  const hardCapFromDuration = perClipNet > 0 ? Math.floor(targetDurationSeconds / perClipNet) : clipCap;
  const targetCount = Math.max(1, Math.min(clipCap, hardCapFromDuration, Math.max(recipe.reelClipCount, targetForStyle)));

  const activeSources = Array.from(byVideo.keys()).sort((a, b) => a - b);
  const selected: BestMoment[] = [];
  const selectedIds = new Set<string>();

  // Cap how many clips any single source can contribute relative to a "fair
  // share" of the reel. Without this, once the other sources' detected best
  // moments run out, the round-robin below just keeps drawing from
  // whichever source still has moments left — round after round — until
  // `targetCount` is hit. For a homogeneous, continuous POV/handlebar-cam
  // source (which the best-moment detector can flag many similar moments
  // in), that produces a long tail of many consecutive clips from the SAME
  // repetitive footage: technically distinct cuts, but visually
  // indistinguishable, reading as "the same shot 3 times in a row" — the
  // exact complaint this caps. No "+1" slack here on purpose: once the
  // other sources are exhausted, we deliberately end the reel a bit shorter
  // rather than let one source monopolize the tail and kill the variety.
  const fairShare = Math.max(1, Math.floor(targetCount / Math.max(1, activeSources.length)));
  const maxPerSource = fairShare;
  const perSourceCount = new Map<number, number>();
  // Times (in that source's own timeline) already claimed by a selected
  // moment, per source. Used below to enforce a minimum spread — see
  // `MIN_SOURCE_SPREAD_FRACTION` doc comment.
  const perSourceSelectedTimes = new Map<number, number[]>();
  for (const m of selected) {
    const list = perSourceSelectedTimes.get(m.sourceIndex) ?? [];
    list.push(m.startSeconds);
    perSourceSelectedTimes.set(m.sourceIndex, list);
  }

  // A single continuous take (e.g. a slow drone orbit, or a long stretch of
  // handlebar POV riding) can get several high-confidence "best moments"
  // flagged close together in time — all technically distinct clips, but
  // visually the same subject/scene, since nothing about the footage
  // actually changed in that stretch. `removeNearDuplicateSegments` only
  // catches genuinely near-overlapping timestamps (a window close to the
  // clip's own short duration), so it does NOT catch two moments a few
  // seconds apart within the same slow continuous shot — exactly what
  // produced "the same shot keeps coming back" even after earlier fixes.
  // Requiring same-source picks to be spread across a meaningful fraction
  // of that source's own duration (not just past their own clip length)
  // makes the reel actually sample DIFFERENT parts of a video's footage
  // instead of clustering on whichever few seconds scored highest.
  const MIN_SOURCE_SPREAD_FRACTION = 0.12;
  function isFarEnoughFromSameSourcePicks(sourceIndex: number, startSeconds: number): boolean {
    const videoDuration = videoDurations[sourceIndex] ?? 0;
    const minGapSeconds = recipe === STYLE_RECIPES.sport
      ? Math.max(0.75, videoDuration * 0.008)
      : Math.max(3, videoDuration * MIN_SOURCE_SPREAD_FRACTION);
    const claimedTimes = perSourceSelectedTimes.get(sourceIndex) ?? [];
    return claimedTimes.every((t) => Math.abs(t - startSeconds) >= minGapSeconds);
  }
  function claimSourceTime(sourceIndex: number, startSeconds: number): void {
    const list = perSourceSelectedTimes.get(sourceIndex) ?? [];
    list.push(startSeconds);
    perSourceSelectedTimes.set(sourceIndex, list);
  }

  for (let round = 0; selected.length < targetCount; round++) {
    let addedThisRound = false;
    // Once only one source still has capacity to contribute (every other
    // source is either out of detected moments or already at its fair-share
    // cap), stop growing the reel from that lone source once a sane minimum
    // length is already reached — otherwise the whole back half of the reel
    // becomes one repetitive source, which reads as "always the same shot"
    // even though each clip is technically a distinct cut.
    const stillCapable = activeSources.filter((src) => {
      const list = byVideo.get(src)!;
      return round < list.length && (perSourceCount.get(src) ?? 0) < maxPerSource;
    });
    if (activeSources.length > 1 && stillCapable.length <= 1 && selected.length >= Math.min(4, targetCount)) break;
    for (const src of activeSources) {
      if (selected.length >= targetCount) break;
      const list = byVideo.get(src)!;
      if (round >= list.length) continue;
      if ((perSourceCount.get(src) ?? 0) >= maxPerSource) continue;
      // Take the best remaining not-yet-selected candidate from this source
      // that is ALSO spread far enough from every moment already picked
      // from the same source (see `isFarEnoughFromSameSourcePicks` above) —
      // not just `list[round]`, which would still let two visually-similar
      // moments from the same slow continuous shot both get picked just
      // because they landed in different confidence-sorted rounds.
      const candidate = list.find((m) => !selectedIds.has(m.id) && isFarEnoughFromSameSourcePicks(m.sourceIndex, m.startSeconds));
      if (!candidate) continue;
      selected.push(candidate);
      selectedIds.add(candidate.id);
      claimSourceTime(candidate.sourceIndex, candidate.startSeconds);
      perSourceCount.set(src, (perSourceCount.get(src) ?? 0) + 1);
      addedThisRound = true;
    }
    // Naturally stops once every source's detected best moments are used up
    // (or every source has hit its fair-share cap) — we never invent or
    // repeat moments, or let one source monopolize the reel, just to hit
    // the target duration.
    if (!addedThisRound) break;
  }

  const baseMoments =
    selected.length > 0
      ? selected
      : [...byVideo.values()].flat().sort((a, b) => b.confidence - a.confidence);
  const segments = baseMoments
    .map((m) => buildSegmentFromMoment(m, recipe, videoDurations, 0))
    .filter((s): s is Segment => s !== null);

  if (segments.length === 0) {
    // If moment selection cannot produce usable clips (e.g., invalid or sparse
    // best-moment timestamps), fall back to an even-coverage cut so rendering
    // never degrades to a raw single-source playback.
    return avoidBackToBackSameSource(
      removeNearDuplicateSegments(planStorySegments(videoDurations, recipe, targetDurationSeconds))
    );
  }

  const sourceDiversity = new Set(baseMoments.map((m) => m.sourceIndex)).size;
  const jitterPattern = [-1.4, 1.1, -0.8, 1.6, -2.0, 2.2, -1.1, 0.9];
  // Keep browser-side ffmpeg composition stable: a larger xfade chain is
  // much more likely to fail near the end of export in wasm than a slightly
  // shorter, better-paced montage. Sport is the worst offender because it
  // creates a high cut density and long transition graph.
  // Increased from 16 to 24 to accommodate 60s SPORT reels with more moments.
  const maxSegments = recipe === STYLE_RECIPES.sport ? 24 : 20;
  let cursor = 0;
  let guard = 0;
  while (
    estimatedMontageDuration(segments, recipe) < targetDurationSeconds &&
    segments.length < maxSegments &&
    guard < 240
  ) {
    guard += 1;
    const sourceMoment = baseMoments[cursor % baseMoments.length];
    const shiftBase = jitterPattern[cursor % jitterPattern.length];
    const shift = shiftBase + Math.floor(cursor / jitterPattern.length) * 0.35 * (cursor % 2 === 0 ? 1 : -1);
    cursor += 1;

    const candidate = buildSegmentFromMoment(sourceMoment, recipe, videoDurations, shift);
    if (!candidate) continue;
    const previous = segments[segments.length - 1];
    if (previous) {
      const sameSourceConsecutive = sourceDiversity > 1 && previous.sourceIndex === candidate.sourceIndex;
      const tooSimilarConsecutive =
        previous.sourceIndex === candidate.sourceIndex &&
        Math.abs(previous.start - candidate.start) < Math.max(recipe === STYLE_RECIPES.sport ? 0.45 : 1.2, recipe.clipDuration * 0.38);
      if (sameSourceConsecutive || tooSimilarConsecutive) continue;
    }
    segments.push(candidate);
  }

  let dedupedSegments = enforceSameSourceSpread(segments, videoDurations, recipe);
  dedupedSegments = dedupedSegments.slice(0, maxSegments);

  if (recipe === STYLE_RECIPES.sport && videoDurations.length > 1) {
    const seenSources = new Set(dedupedSegments.map((segment) => segment.sourceIndex));
    if (seenSources.size < Math.min(3, videoDurations.length)) {
      const coverageSegments = planStorySegments(videoDurations, recipe, targetDurationSeconds);
      const merged = [...dedupedSegments];
      const seen = new Set(merged.map((segment) => `${segment.sourceIndex}:${segment.start.toFixed(3)}`));
      for (const segment of coverageSegments) {
        const key = `${segment.sourceIndex}:${segment.start.toFixed(3)}`;
        if (seen.has(key) || seenSources.has(segment.sourceIndex) && seenSources.size >= Math.min(3, videoDurations.length)) continue;
        if (seenSources.size < Math.min(3, videoDurations.length) && !seenSources.has(segment.sourceIndex)) {
          seenSources.add(segment.sourceIndex);
        }
        merged.push(segment);
        seen.add(key);
        if (seenSources.size >= Math.min(3, videoDurations.length)) break;
      }
      dedupedSegments = avoidBackToBackSameSource(removeNearDuplicateSegments(merged));
    }
  }

  if (recipe === STYLE_RECIPES.sport && estimatedMontageDuration(dedupedSegments, recipe) < targetDurationSeconds * 0.88) {
    const coverageSegments = planStorySegments(videoDurations, recipe, targetDurationSeconds);
    const merged = [...dedupedSegments];
    const seen = new Set(merged.map((segment) => `${segment.sourceIndex}:${segment.start.toFixed(3)}`));

    for (const segment of coverageSegments) {
      const key = `${segment.sourceIndex}:${segment.start.toFixed(3)}`;
      if (seen.has(key)) continue;
      merged.push(segment);
      seen.add(key);
      const normalized = avoidBackToBackSameSource(removeNearDuplicateSegments(merged)).slice(0, maxSegments);
      if (estimatedMontageDuration(normalized, recipe) >= targetDurationSeconds * 0.96 || normalized.length >= maxSegments) {
        dedupedSegments = normalized;
        break;
      }
      dedupedSegments = normalized;
    }
  }

  // If the best-moment plan still collapses to a single segment, fall back to
  // an even coverage cut so SPORT (and other montage modes) cannot degrade into
  // a raw one-clip playback.
  if (dedupedSegments.length < 2) {
    const coverageSegments = planStorySegments(videoDurations, recipe, targetDurationSeconds);
    const merged = [...dedupedSegments];
    const seen = new Set(merged.map((segment) => `${segment.sourceIndex}:${segment.start.toFixed(3)}`));
    for (const segment of coverageSegments) {
      const key = `${segment.sourceIndex}:${segment.start.toFixed(3)}`;
      if (seen.has(key)) continue;
      merged.push(segment);
      seen.add(key);
      if (merged.length >= Math.max(3, Math.min(targetCount, coverageSegments.length))) break;
    }
    dedupedSegments = avoidBackToBackSameSource(removeNearDuplicateSegments(merged));
  }

  return applySlowMoToStandoutMoments(dedupedSegments.slice(0, maxSegments), baseMoments);
}

function enforceSameSourceSpread(segments: Segment[], videoDurations: number[], recipe: StyleRecipe): Segment[] {
  const kept: Segment[] = [];
  const acceptedTimesBySource = new Map<number, number[]>();

  for (const segment of [...segments].sort((a, b) => a.sourceIndex - b.sourceIndex || a.start - b.start)) {
    const sourceIndex = segment.sourceIndex;
    const videoDuration = videoDurations[sourceIndex] ?? 0;
    const minGapSeconds = recipe === STYLE_RECIPES.sport
      ? Math.max(0.75, videoDuration * 0.008)
      : Math.max(3, videoDuration * 0.12);
    const claimedTimes = acceptedTimesBySource.get(sourceIndex) ?? [];
    const overlaps = claimedTimes.some((time) => Math.abs(time - segment.start) < minGapSeconds);

    if (overlaps) {
      const existingIndex = kept.findIndex(
        (candidate) =>
          candidate.sourceIndex === sourceIndex &&
          Math.abs(candidate.start - segment.start) < minGapSeconds
      );
      if (existingIndex === -1) continue;
      if ((segment.confidence ?? 0) <= (kept[existingIndex].confidence ?? 0)) continue;
      kept[existingIndex] = segment;
      acceptedTimesBySource.set(sourceIndex, claimedTimes.map((time) => (Math.abs(time - kept[existingIndex].start) < minGapSeconds ? kept[existingIndex].start : time)));
      continue;
    }

    kept.push(segment);
    claimedTimes.push(segment.start);
    acceptedTimesBySource.set(sourceIndex, claimedTimes);
  }

  return kept;
}

/**
 * Editing rule: "never use two visually similar clips back to back" — and,
 * per explicit user feedback, this must hold unconditionally, not just when
 * the two consecutive picks happen to sit close together in the source
 * footage. With only pixel-level heuristics (no real shot-similarity model)
 * available client-side, the strongest practical proxy for "same shot" is
 * "cut from the same source video" — two consecutive clips from a different
 * upload are almost always more visually distinct than two from the same
 * one. The round-robin selection above already alternates sources most of
 * the time; this pass mops up the remaining run (e.g. once a shorter
 * video's moments run out and the tail is all one source) by swapping in a
 * later same-source-free candidate wherever one exists, without changing
 * the overall multiset of chosen segments.
 */
function avoidBackToBackSameSource<T extends { sourceIndex: number; start?: number; length?: number }>(segments: T[]): T[] {
  const out = [...segments];
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    const current = out[i];
    // Strict rule: ANY two consecutive segments sharing the same source
    // video get a swap attempt — not just ones that also land close
    // together in time. A viewer can't tell "same video, different minute"
    // from "same shot repeated" nearly as reliably as the editing logic
    // can, so treat every same-source repeat as something to avoid.
    if (current.sourceIndex !== prev.sourceIndex) continue;
    for (let j = i + 1; j < out.length; j++) {
      if (out[j].sourceIndex !== prev.sourceIndex) {
        const [swap] = out.splice(j, 1);
        out.splice(i, 0, swap);
        break;
      }
    }
  }
  return out;
}

function removeNearDuplicateSegments<T extends { sourceIndex: number; start?: number; length?: number; confidence?: number }>(segments: T[]): T[] {
  const filtered: T[] = [];
  for (const segment of segments) {
    const duplicateIndex = filtered.findIndex((existing) => {
      if (existing.sourceIndex !== segment.sourceIndex) return false;
      if (typeof existing.start !== "number" || typeof segment.start !== "number") return false;
      const baseWindow = Math.max(existing.length ?? 0, segment.length ?? 0, 0.6);
      return Math.abs(existing.start - segment.start) < baseWindow * 0.85;
    });
    if (duplicateIndex === -1) {
      filtered.push(segment);
      continue;
    }
    const existing = filtered[duplicateIndex];
    const existingConfidence = existing.confidence ?? 0;
    const candidateConfidence = segment.confidence ?? 0;
    if (candidateConfidence > existingConfidence) filtered[duplicateIndex] = segment;
  }
  return filtered;
}

/** Samples evenly-spaced segments across all uploaded videos (proportional to each one's length) so a Story can tell the full arc, capped at `maxDurationSeconds`. A synthetic confidence peaking at the middle segment gives the Creative Style Engine a natural "highlight" beat even without AI-scored moments. */
function planStorySegments(videoDurations: number[], recipe: StyleRecipe, maxDurationSeconds: number): Segment[] {
  const totalDuration = videoDurations.reduce((a, b) => a + b, 0);
  if (totalDuration <= 0) return [];

  const perClipNet = recipe.clipDuration / recipe.speed;
  let totalCount = perClipNet > 0 ? Math.floor(maxDurationSeconds / perClipNet) : 8;
  totalCount = Math.max(3, Math.min(totalCount, recipe === STYLE_RECIPES.sport ? 48 : 18));

  const segments: Omit<Segment, "confidence">[] = [];
  videoDurations.forEach((videoDuration, sourceIndex) => {
    if (videoDuration <= 0.3) return;
    const share = videoDuration / totalDuration;
    const count = Math.max(1, Math.round(totalCount * share));
    const step = videoDuration / count;
    const clipLen = Math.max(recipe.minClipDuration, Math.min(recipe.clipDuration, recipe.maxClipDuration, step));

    for (let i = 0; i < count; i++) {
      const slotStart = i * step;
      const start = Math.max(0, Math.min(slotStart + (step - clipLen) / 2, Math.max(0, videoDuration - clipLen)));
      segments.push({ sourceIndex, start, length: clipLen });
    }
  });

  const mid = (segments.length - 1) / 2 || 1;
  return segments.map((s, i) => ({ ...s, confidence: 60 - (Math.abs(i - mid) / mid) * 30 }));
}

/**
 * Color correction applied to every clip so footage straight off a phone
 * camera doesn't look flat/washed-out in the final Reel — one grade per
 * Creative Style Engine `ColorTreatment`, so Viral pops with punchy contrast,
 * Travel/Adventure lean warm, Cinematic reads moody/desaturated, and Luxury
 * stays clean and muted, instead of every style sharing one fixed grade.
 */
type ColorTreatment = "standard" | "highContrastPunchy" | "warmTravel" | "premiumMuted" | "cinematicMoody";

const COLOR_FILTERS: Record<ColorTreatment, string> = {
  standard: "eq=contrast=1.08:saturation=1.28:gamma=1.03:brightness=0.01",
  highContrastPunchy: "eq=contrast=1.24:saturation=1.48:gamma=1.05:brightness=0.02",
  warmTravel: "eq=contrast=1.1:saturation=1.3:gamma=1.05:brightness=0.015,colorbalance=rs=0.09:gs=0.01:bs=-0.09:rm=0.05:bm=-0.04",
  premiumMuted: "eq=contrast=1.05:saturation=0.9:gamma=1.02:brightness=0.0",
  cinematicMoody: "eq=contrast=1.16:saturation=0.82:gamma=0.98:brightness=-0.01,colorbalance=bs=0.07:bm=0.04",
};

const COLOR_CORRECTION_FILTER = COLOR_FILTERS.standard;

/**
 * Builds the ffmpeg video filter for a single segment.
 *
 * `fastMode = true` (when renderSpeedProfile is "fast") skips `zoompan` entirely
 * and replaces it with a lightweight static scale + crop. Ken Burns is beautiful
 * but processes every frame through bilinear scaling — the single biggest
 * performance bottleneck at 1080p (≈ 80 frames × 2 MB/frame per segment).
 * Removing it cuts Phase 1 time by roughly 3–5× on a mid-range laptop.
 */
function buildSegmentFilter(seg: Segment, index: number, recipe: StyleRecipe, w: number, h: number, fps: number, fastMode = false, style: ReelStyle = "viral") {
  const speed = effectiveSpeed(seg, recipe);
  const sportBoost = style === "sport" ? "eq=contrast=1.18:saturation=1.45:gamma=1.08:brightness=0.02" : COLOR_CORRECTION_FILTER;

  if (fastMode) {
    // Fast mode: scale/crop + color correction, no zoompan.
    return (
      `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` +
      `${sportBoost},` +
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
  const effectiveZoomIntensity = style === "sport" ? Math.max(zoomIntensity, 1.2) : zoomIntensity;
  const inc = (effectiveZoomIntensity - 1) / frames;
  const zExpr = dir === "in" ? `min(1+on*${inc.toFixed(6)},${effectiveZoomIntensity})` : `max(${effectiveZoomIntensity}-on*${inc.toFixed(6)},1)`;

  return (
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` +
    `${sportBoost},` +
    `zoompan=z='${zExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=${fps},` +
    `setpts=(PTS-STARTPTS)/${speed}`
  );
}

export type MontageMode = "reel" | "story";
export type RenderQuality = "720p" | "1080p";
export type RenderSpeedProfile = "standard" | "fast";
export type KenBurnsTier = "skip" | "standard" | "enhanced";


const QUALITY_DIMENSIONS: Record<RenderQuality, { w: number; h: number }> = {
  "720p": { w: 720, h: 1280 },
  "1080p": { w: 1080, h: 1920 },
};

/** Maps the demo plan tier to a render resolution — Pro plans render sharper (and, being fewer pixels for Free, faster too). */
export function qualityForPlan(): RenderQuality {
  return "720p";
}

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

function hashString(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isIgnorableFsCleanupError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ErrnoError:\s*FS error/i.test(message);
}

async function deleteFFmpegTempFile(ffmpeg: FFmpeg, fileName: string): Promise<void> {
  if (!fileName) return;
  try {
    await ffmpeg.deleteFile(fileName);
  } catch (error) {
    if (!isIgnorableFsCleanupError(error)) {
      console.warn(`[video-engine] Failed to delete temporary ffmpeg file ${fileName}:`, error);
    }
  }
}

async function pruneFFmpegTempFiles(ffmpeg: FFmpeg, fileNames: string[], keep: Set<string> = new Set()): Promise<void> {
  for (const fileName of fileNames) {
    if (keep.has(fileName)) continue;
    await deleteFFmpegTempFile(ffmpeg, fileName);
  }
}

function drawSportScratchLayer(
  ctx: CanvasRenderingContext2D,
  frameWidth: number,
  frameHeight: number,
  seed: string,
  effect: SportHookEffect | "route" = "route"
) {
  const rand = mulberry32(hashString(seed));
  const impact = effect === "scratch" || effect === "terrain" || effect === "dust";
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < (impact ? 26 : 18); i++) {
    const x = rand() * frameWidth;
    const y = rand() * frameHeight;
    const length = frameWidth * (0.07 + rand() * 0.26);
    const angle = -0.8 + rand() * 1.6;
    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;
    ctx.strokeStyle = rand() > 0.5 ? (impact ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.14)") : "rgba(0,0,0,0.08)";
    ctx.lineWidth = (impact ? 0.9 : 0.7) + rand() * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.globalAlpha = impact ? 0.2 : 0.12;
  for (let i = 0; i < (impact ? 150 : 90); i++) {
    const x = rand() * frameWidth;
    const y = rand() * frameHeight;
    const size = 0.5 + rand() * 1.4;
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.35)";
    ctx.fillRect(x, y, size, size);
  }

  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = impact ? 0.14 : 0.08;
  for (let i = 0; i < (impact ? 12 : 8); i++) {
    const x = rand() * frameWidth;
    const y = rand() * frameHeight;
    const w = frameWidth * (0.06 + rand() * 0.16);
    const h = frameHeight * (0.008 + rand() * 0.018);
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.55)";
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.6 + rand() * 1.2);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  if (impact) {
    ctx.globalCompositeOperation = "lighter";
    const flashHeight = frameHeight * 0.035;
    const flashY = frameHeight * (0.58 + rand() * 0.14);
    const redGrad = ctx.createLinearGradient(0, flashY, frameWidth, flashY);
    redGrad.addColorStop(0, "rgba(225,29,46,0.38)");
    redGrad.addColorStop(0.72, "rgba(225,29,46,0)");
    ctx.fillStyle = redGrad;
    ctx.fillRect(0, flashY, frameWidth, flashHeight);

    const cyanGrad = ctx.createLinearGradient(frameWidth, flashY + flashHeight * 0.9, 0, flashY + flashHeight * 0.9);
    cyanGrad.addColorStop(0, "rgba(56,189,248,0.26)");
    cyanGrad.addColorStop(0.72, "rgba(56,189,248,0)");
    ctx.fillStyle = cyanGrad;
    ctx.fillRect(0, flashY + flashHeight * 0.9, frameWidth, flashHeight * 0.75);

    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(0, frameHeight * 0.54, frameWidth, frameHeight * 0.012);
  }

  ctx.restore();
}

/**
 * Generates a small "Powered by ClipsyReel." watermark PNG (client-side
 * canvas — no server round-trip), sized relative to output width.
 * Kept compact and subtle so it behaves like an action-cam signature.
 */
async function generateWatermarkPng(frameWidth: number): Promise<Uint8Array> {
  const width = Math.max(172, Math.round(frameWidth * 0.34));
  const height = Math.round(width * 0.24);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  roundRectPath(ctx, 0, 0, width, height, height / 2);
  ctx.fill();

  const iconSize = height * 0.62;
  const iconX = height * 0.22;
  const iconY = (height - iconSize) / 2;
  const iconRadius = iconSize * 0.26;
  const grad = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize);
  grad.addColorStop(0, "#e879f9");
  grad.addColorStop(1, "#fb923c");
  ctx.fillStyle = grad;
  roundRectPath(ctx, iconX, iconY, iconSize, iconSize, iconRadius);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  const bodyX = iconX + iconSize * 0.18;
  const bodyY = iconY + iconSize * 0.35;
  const bodyW = iconSize * 0.64;
  const bodyH = iconSize * 0.3;
  roundRectPath(ctx, bodyX, bodyY, bodyW, bodyH, iconSize * 0.08);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(iconX + iconSize * 0.18, iconY + iconSize * 0.18);
  ctx.lineTo(iconX + iconSize * 0.82, iconY + iconSize * 0.18);
  ctx.lineTo(iconX + iconSize * 0.72, iconY + iconSize * 0.31);
  ctx.lineTo(iconX + iconSize * 0.08, iconY + iconSize * 0.31);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(232,121,249,0.95)";
  ctx.lineWidth = Math.max(1.25, iconSize * 0.05);
  for (let i = 0; i < 3; i++) {
    const x = iconX + iconSize * (0.24 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(x, iconY + iconSize * 0.2);
    ctx.lineTo(x - iconSize * 0.08, iconY + iconSize * 0.29);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.font = `700 ${Math.round(height * 0.34)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("ClipsyReel", iconX + iconSize + height * 0.22, height / 2 + height * 0.02);

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

function drawSportBroadcastBanner(
  ctx: CanvasRenderingContext2D,
  frameWidth: number,
  frameHeight: number,
  beat: SportHookBeat
) {
  const colors = resolveSportHookPalette(beat.theme, beat.color);
  const alignedRight = beat.align === "right";
  const baseWidth = Math.round(frameWidth * 0.36);
  const mainX = alignedRight ? Math.round(frameWidth * 0.54) : Math.round(frameWidth * 0.07);
  const topY = Math.round(frameHeight * 0.735);
  const mainW = baseWidth;
  const mainH = Math.round(frameHeight * 0.078);

  drawSportScratchLayer(ctx, frameWidth, frameHeight, `${beat.title}|${beat.effect}`, beat.effect);

  ctx.save();
  roundRectPath(ctx, mainX, topY, mainW, mainH, 18);
  ctx.fillStyle = colors.mainFill;
  ctx.fill();
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  const accentBarX = alignedRight ? mainX : mainX + mainW - 12;
  ctx.fillStyle = colors.accent;
  ctx.fillRect(accentBarX, topY, 12, mainH);

  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 8;
  ctx.textAlign = alignedRight ? "right" : "left";
  const fontFamily = canvasFontFamilyForTitle(beat.font);
  const fontWeight = beat.font === "bold" || beat.font === "impact" ? 900 : beat.font === "minimal" ? 500 : 700;
  const fontStyle = beat.font === "handwritten" || beat.font === "elegant" || beat.font === "cinematic" ? "italic" : "normal";
  const fontSize = beat.size === "sm" ? Math.round(frameWidth * 0.024) : beat.size === "lg" ? Math.round(frameWidth * 0.031) : Math.round(frameWidth * 0.027);
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = colors.mainText;

  const titleLines = wrapCanvasText(ctx, beat.title, mainW - 34);
  const titleStartX = alignedRight ? mainX + mainW - 18 : mainX + 18;
  const lineHeight = Math.round(frameWidth * 0.03);

  titleLines.forEach((line, index) => {
    const y = topY + mainH / 2 + (index - (titleLines.length - 1) / 2) * lineHeight;
    ctx.fillText(line, titleStartX, y);
  });
  ctx.restore();
}

async function generateOverlayTextPng(
  frameWidth: number,
  frameHeight: number,
  text: string,
  style: ReelStyle,
  sportBeat?: SportHookBeat
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, frameWidth, frameHeight);

  if (style === "sport" && sportBeat) {
    drawSportBroadcastBanner(ctx, frameWidth, frameHeight, sportBeat);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Sport broadcast overlay export failed"))), "image/png");
    });
    return new Uint8Array(await blob.arrayBuffer());
  }

  const centerX = frameWidth / 2;
  const maxTextWidth = Math.round(frameWidth * (style === "sport" ? 0.5 : 0.78));
  const y = Math.round(frameHeight * (style === "sport" ? 0.72 : 0.34));

  ctx.font = `700 ${Math.round(frameWidth * (style === "sport" ? 0.046 : 0.058))}px ${style === "sport" ? `"SFMono-Regular", Menlo, Monaco, Consolas, monospace` : `system-ui, -apple-system, "Segoe UI", sans-serif`}`;
  const lines = wrapCanvasText(ctx, text, maxTextWidth);
  const lineHeight = Math.round(frameWidth * 0.072);

  if (style === "sport") {
    const panelX = Math.round(frameWidth * 0.08);
    const panelW = Math.round(frameWidth * 0.52);
    const panelH = Math.round(lineHeight * lines.length + frameHeight * 0.07);
    const panelY = Math.round(y - frameHeight * 0.06);
    ctx.fillStyle = "rgba(2,6,23,0.56)";
    roundRectPath(ctx, panelX, panelY, panelW, panelH, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(34,211,238,0.34)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(165,243,252,0.72)";
    ctx.textAlign = "left";
    ctx.font = `600 ${Math.round(frameWidth * 0.018)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
    ctx.fillText("EDITORIAL OVERLAY", panelX + 20, panelY + 18);
    ctx.font = `700 ${Math.round(frameWidth * 0.046)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.98)";
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.textAlign = "center";
  }

  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 12;
  lines.forEach((line, index) => {
    if (style === "sport") {
      ctx.fillText(line, Math.round(frameWidth * 0.11), y + index * lineHeight);
    } else {
      ctx.fillText(line, centerX, y + index * lineHeight);
    }
  });
  ctx.shadowBlur = 0;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Overlay text canvas export failed"))), "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
}

async function generateSportTelemetryOverlayPng(
  frameWidth: number,
  frameHeight: number,
  routeLabel: string | null | undefined,
  gpxStats: GpxRouteStats | null | undefined,
  maxSpeedKmh: number | null | undefined,
  focus: 0 | 1 | 2,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, frameWidth, frameHeight);

  const grid = Math.max(18, Math.round(frameWidth * 0.032));
  ctx.strokeStyle = "rgba(34,211,238,0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= frameWidth; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, frameHeight);
    ctx.stroke();
  }
  for (let y = 0; y <= frameHeight; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(frameWidth, y);
    ctx.stroke();
  }

  drawSportScratchLayer(ctx, frameWidth, frameHeight, `${routeLabel ?? "sport"}|${focus}|${gpxStats?.durationLabel ?? ""}|${gpxStats?.distanceKm ?? ""}`, "route");

  const titleX = Math.round(frameWidth * 0.05);
  const titleY = Math.round(frameHeight * 0.04);
  const titleW = Math.round(frameWidth * 0.42);
  const titleH = Math.round(frameHeight * 0.11);
  roundRectPath(ctx, titleX, titleY, titleW, titleH, 22);
  ctx.fillStyle = "rgba(2,6,23,0.48)";
  ctx.fill();
  ctx.strokeStyle = "rgba(34,211,238,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(165,243,252,0.7)";
  ctx.font = `600 ${Math.round(frameWidth * 0.011)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
  ctx.fillText("SPORT LAB", titleX + 16, titleY + 14);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `700 ${Math.round(frameWidth * 0.021)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
  const routeLabelText = routeLabel?.trim() ?? "";
  const coherentRouteLabel = isCoherentDisplayText(routeLabelText) ? routeLabelText.toUpperCase() : "";
  ctx.fillText("SPORT LAB", titleX + 16, titleY + 34);
  if (coherentRouteLabel) {
    ctx.fillStyle = "rgba(165,243,252,0.58)";
    ctx.font = `600 ${Math.round(frameWidth * 0.010)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
    ctx.fillText(coherentRouteLabel, titleX + 16, titleY + 63);
  }

  const statX = Math.round(frameWidth * 0.52);
  const statY = titleY;
  const statW = Math.round(frameWidth * 0.43);
  const statH = Math.round(frameHeight * 0.11);
  roundRectPath(ctx, statX, statY, statW, statH, 22);
  ctx.fillStyle = "rgba(2,6,23,0.48)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.stroke();
  const mainLabel = focus === 0 ? "GPS POSITION" : focus === 1 ? "ALTITUDE" : "SPEED";
  const mainValue = focus === 0
    ? (gpxStats ? `${gpxStats.distanceKm.toFixed(1)} km` : "—")
    : focus === 1
      ? (gpxStats ? `${Math.round(gpxStats.elevationGainM)} m` : "—")
      : (maxSpeedKmh ? `${Math.round(maxSpeedKmh)} km/h` : "—");
  ctx.fillStyle = "rgba(165,243,252,0.68)";
  ctx.font = `600 ${Math.round(frameWidth * 0.010)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
  ctx.fillText(mainLabel, statX + 14, statY + 14);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.font = `700 ${Math.round(frameWidth * 0.03)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
  ctx.fillText(mainValue, statX + 14, statY + 34);
  ctx.fillStyle = "rgba(255,255,255,0.54)";
  ctx.font = `500 ${Math.round(frameWidth * 0.009)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
  ctx.fillText(focus === 0 ? "GPS LOCK / COMPASS" : focus === 1 ? "vertical effort" : "real pace cap", statX + 14, statY + 68);

  const iconX = statX + statW - 34;
  const iconY = statY + 30;
  ctx.strokeStyle = focus === 1 ? "rgba(244,114,182,0.95)" : focus === 2 ? "rgba(250,204,21,0.95)" : "rgba(34,211,238,0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (focus === 1) {
    ctx.moveTo(iconX - 12, iconY + 18);
    ctx.lineTo(iconX, iconY - 8);
    ctx.lineTo(iconX + 12, iconY + 6);
    ctx.lineTo(iconX + 24, iconY - 16);
    ctx.lineTo(iconX + 36, iconY + 18);
  } else if (focus === 2) {
    ctx.moveTo(iconX - 14, iconY + 16);
    ctx.lineTo(iconX + 6, iconY - 18);
    ctx.lineTo(iconX + 20, iconY + 2);
    ctx.lineTo(iconX + 34, iconY - 10);
    ctx.lineTo(iconX + 44, iconY + 16);
  } else {
    ctx.moveTo(iconX - 16, iconY + 16);
    ctx.lineTo(iconX - 2, iconY + 2);
    ctx.lineTo(iconX + 10, iconY + 10);
    ctx.lineTo(iconX + 26, iconY - 6);
    ctx.lineTo(iconX + 42, iconY + 16);
  }
  ctx.stroke();

  const schematicX = Math.round(frameWidth * 0.05);
  const schematicY = Math.round(frameHeight * 0.22);
  const schematicW = Math.round(frameWidth * 0.9);
  const schematicH = Math.round(frameHeight * 0.18);
  roundRectPath(ctx, schematicX, schematicY, schematicW, schematicH, 24);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();
  ctx.beginPath();
  const points = Array.from({ length: 10 }, (_, index) => {
    const t = index / 9;
    const yFactor = focus === 1
      ? 0.56 + Math.sin(t * Math.PI * 4) * 0.18 + (index % 2 === 0 ? 0.08 : -0.04)
      : focus === 2
        ? 0.42 + Math.sin(t * Math.PI * 7) * 0.06 + (index % 3 === 0 ? 0.08 : -0.01)
        : 0.48 + t * 0.1 + Math.sin(t * Math.PI * 2.5) * 0.05;
    return {
      x: schematicX + 18 + t * (schematicW - 36),
      y: schematicY + schematicH - 20 - yFactor * (schematicH - 28),
    };
  });
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = focus === 1 ? "rgba(244,114,182,0.92)" : focus === 2 ? "rgba(250,204,21,0.95)" : "rgba(34,211,238,0.95)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === 4 ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = index === 4 ? "rgba(255,255,255,0.92)" : "rgba(34,211,238,0.9)";
    ctx.fill();
  });

  const chipsY = Math.round(frameHeight * 0.45);
  const chips = [
    ["TIME", gpxStats?.durationLabel ?? "—"],
    ["D+", gpxStats?.elevationGainM ? `${Math.round(gpxStats.elevationGainM)} m` : "—"],
    ["MAX", maxSpeedKmh ? `${Math.round(maxSpeedKmh)} km/h` : "—"],
  ];
  chips.forEach((chip, index) => {
    const chipX = Math.round(frameWidth * 0.05 + index * frameWidth * 0.19);
    roundRectPath(ctx, chipX, chipsY, Math.round(frameWidth * 0.16), Math.round(frameHeight * 0.075), 18);
    ctx.fillStyle = "rgba(2,6,23,0.45)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();
    ctx.fillStyle = "rgba(165,243,252,0.6)";
    ctx.font = `600 ${Math.round(frameWidth * 0.0095)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
    ctx.fillText(chip[0], chipX + 12, chipsY + 10);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `700 ${Math.round(frameWidth * 0.016)}px "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
    ctx.fillText(chip[1], chipX + 12, chipsY + 26);
  });

  const railX = Math.round(frameWidth * 0.05);
  const railY = Math.round(frameHeight * 0.885);
  const railW = Math.round(frameWidth * 0.9);
  roundRectPath(ctx, railX, railY, railW, Math.round(frameHeight * 0.024), 999);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  const grad = ctx.createLinearGradient(railX, railY, railX + railW, railY);
  grad.addColorStop(0, "rgba(34,211,238,0.65)");
  grad.addColorStop(1, "rgba(168,85,247,0.58)");
  roundRectPath(ctx, railX, railY, Math.round(railW * (focus === 0 ? 0.38 : focus === 1 ? 0.7 : 0.93)), Math.round(frameHeight * 0.024), 999);
  ctx.fillStyle = grad;
  ctx.fill();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Sport telemetry overlay export failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

interface ReelTitleOverlaySettings {
  text: string;
  font: ReelTitleFont;
  size: ReelTitleSize;
  color: ReelTitleColor;
}

function canvasFontFamilyForTitle(font: ReelTitleFont): string {
  if (font === "classic") return `Georgia, "Times New Roman", serif`;
  if (font === "modern") return `"Inter", "Arial", "Helvetica Neue", sans-serif`;
  if (font === "bold") return `"Arial Black", "Inter", "Segoe UI", sans-serif`;
  if (font === "minimal") return `"Avenir Next", "Inter", "Helvetica Neue", sans-serif`;
  if (font === "handwritten") return `"Brush Script MT", "Snell Roundhand", "Comic Sans MS", cursive`;
  if (font === "elegant") return `"Garamond", "Baskerville", Georgia, serif`;
  if (font === "impact") return `"Impact", "Arial Black", sans-serif`;
  if (font === "mono") return `"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
  if (font === "rounded") return `"Trebuchet MS", "Avenir Next", "Segoe UI", sans-serif`;
  return `"Bodoni MT", "Didot", Georgia, serif`;
}

function titleSizeScale(size: ReelTitleSize): number {
  if (size === "sm") return 0.06;
  if (size === "lg") return 0.095;
  return 0.078;
}

function titleColorForCanvas(color: ReelTitleColor): string {
  if (color === "gold") return "rgba(252,211,77,0.98)";
  if (color === "coral") return "rgba(253,186,116,0.98)";
  if (color === "cyan") return "rgba(103,232,249,0.98)";
  if (color === "lime") return "rgba(190,242,100,0.98)";
  if (color === "violet") return "rgba(196,181,253,0.98)";
  if (color === "pink") return "rgba(249,168,212,0.98)";
  if (color === "red") return "rgba(248,113,113,0.98)";
  if (color === "blue") return "rgba(96,165,250,0.98)";
  if (color === "emerald") return "rgba(110,231,183,0.98)";
  if (color === "peach") return "rgba(254,215,170,0.98)";
  if (color === "silver") return "rgba(203,213,225,0.98)";
  return "rgba(255,255,255,0.98)";
}

async function generateReelTitlePng(frameWidth: number, frameHeight: number, title: ReelTitleOverlaySettings): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, frameWidth, frameHeight);

  const fontSize = Math.round(frameWidth * titleSizeScale(title.size));
  ctx.font = `700 ${fontSize}px ${canvasFontFamilyForTitle(title.font)}`;
  const lines = wrapCanvasText(ctx, title.text, frameWidth * 0.84).slice(0, 2);
  const lineHeight = Math.round(fontSize * 1.14);
  const paddingX = Math.round(frameWidth * 0.07);
  const paddingY = Math.round(fontSize * 0.45);
  const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const boxWidth = Math.max(frameWidth * 0.58, maxLineWidth + paddingX * 2);
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const centerX = frameWidth / 2;
  const boxX = centerX - boxWidth / 2;
  const boxY = Math.round(frameHeight * 0.12);
  const titleColor = titleColorForCanvas(title.color);

  ctx.clearRect(0, 0, frameWidth, frameHeight);
  ctx.beginPath();
  roundRectPath(ctx, boxX, boxY, boxWidth, boxHeight, Math.max(18, Math.round(fontSize * 0.28)));
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fill();
  ctx.strokeStyle = titleColor;
  ctx.lineWidth = Math.max(1.5, Math.round(fontSize * 0.05));
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    const y = boxY + paddingY + index * lineHeight;
    ctx.strokeStyle = "rgba(0,0,0,0.46)";
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.1));
    ctx.strokeText(line, centerX, y);
    ctx.fillStyle = titleColor;
    ctx.fillText(line, centerX, y);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Reel title canvas export failed"))), "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
}

function planReelTitleWindow(totalDuration: number, introDuration: number, outroDuration: number, style: ReelStyle) {
  const start = style === "sport"
    ? Math.max(0.3, introDuration + 0.28)
    : Math.max(0.35, introDuration + 0.35);
  const endBoundary = Math.max(start, totalDuration - Math.max(0.35, outroDuration + 0.35));
  const available = endBoundary - start;
  if (available < 1.4) return null;
  const duration = style === "sport"
    ? clamp(available * 0.18, 1.9, 3.3)
    : clamp(available * 0.2, 1.2, 2.2);
  return { start, end: Math.min(endBoundary, start + duration) };
}

function planOverlayTextWindows(
  texts: string[],
  totalDuration: number,
  introDuration: number,
  outroDuration: number,
  minimumStartSeconds = 0,
  style: ReelStyle = "viral"
) {
  if (texts.length === 0) return [];

  const startBoundary = style === "sport"
    ? Math.max(0.14, minimumStartSeconds)
    : Math.max(0.35, introDuration + 0.35, minimumStartSeconds);
  const endBoundary = style === "sport"
    ? Math.max(startBoundary, Math.min(totalDuration, 3.05))
    : Math.max(startBoundary, totalDuration - Math.max(0.35, outroDuration + 0.35));
  const available = endBoundary - startBoundary;
  if (available < 1.2) return [];

  const gap = texts.length > 1 ? (style === "sport" ? 0.08 : 0.45) : 0;
  const rawDuration = (available - gap * Math.max(0, texts.length - 1)) / texts.length;
  const overlayDuration = style === "sport" ? clamp(rawDuration, 0.55, 0.95) : clamp(rawDuration, 2.8, 5.2);
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
  /** Per-source audio toggles in the same order as `files` (defaults to all true when omitted). */
  videoAudioEnabled?: boolean[];
  /** Optional intro clip prepended before the best-moment montage (e.g. a 3D route flyover). */
  introClip?: { file: File; durationSeconds: number };
  /**
   * If true, intro transcode failures stop the whole render.
   * If false (default), caller may retry without intro for reliability.
   */
  preserveRouteIntro?: boolean;
  /** Optional end card appended after the montage (e.g. gear summary). */
  outroClip?: { file: File; durationSeconds: number };
  style: ReelStyle;
  mode: MontageMode;
  bestMoments: BestMoment[];
  /** Instagram Story hard cap — defaults to 60s (current IG limit). */
  maxStorySeconds?: number;
  /** Reel hard cap target (including intro/outro) — defaults to 60s. */
  maxReelSeconds?: number;
  /** Working resolution — lower = faster render. Defaults to "720p". */
  quality?: RenderQuality;
  /** Burns a small "ClipsyReel" badge into the bottom-right corner of the exported MP4 (Free plan). */
  watermark?: boolean;
  /** Keeps the original clip audio in the exported montage instead of muting everything. */
  keepOriginalAudio?: boolean;
  /** Controls encoder speed at fixed 1080p: "fast" skips Ken Burns zoom (3–5× speedup) at the cost of static framing. */
  renderSpeedProfile?: RenderSpeedProfile;
  /** Ken Burns zoom control: "skip" for 15-25% speedup, "standard" for cinematic zoom, "enhanced" for premium effect. Defaults to "standard". */
  kenBurnsTier?: KenBurnsTier;
  /** Optional reel title shown before hook overlay text. */
  reelTitle?: ReelTitleOverlaySettings;
  /** Up to three custom overlay texts burned into the final exported MP4. */
  overlayTexts?: string[];
  overlayFonts?: ReelTitleFont[];
  overlaySizes?: ReelTitleSize[];
  overlayColors?: ReelTitleColor[];
  /** Optional selected hook text used to derive the sport opener sequence. */
  openerHookText?: string;
  /** Optional route label shown in sport telemetry overlays. */
  routeLabel?: string | null;
  /** Optional GPX stats shown in sport telemetry overlays. */
  gpxStats?: GpxRouteStats | null;
  /** Optional sport-mode telemetry detail. */
  sportTelemetry?: SportTelemetry | null;
  /** Optional GPX-derived points passed by the page; currently unused here but accepted by callers. */
  gpxPoints?: { lat: number; lng: number }[] | null;
  routeFocusPoints?: { lat: number; lng: number }[] | null;
  customTextOverlays?: string[];
  metadataCardLines?: string[] | null;
  emotionalStory?: unknown;
  adventureSetupOverlay?: unknown;
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
  /** Human-readable list of creative effects actually applied — for a post-render "what changed" summary in the UI. */
  appliedEffects: string[];
  /** Effects this style wanted but were stripped because the render wasn't on a Pro plan — a concrete, specific upsell list. */
  proLockedEffects: string[];
  /** The Editing Pattern (structural template) chosen for this render — see `editingPatterns.ts`. */
  editingPattern: { name: string; description: string };
}

function ensureNonEmptyVideoBlob(data: Uint8Array, mimeType: string) {
  const bytes = new Uint8Array(data);
  if (bytes.byteLength === 0) {
    throw new Error("Rendered video output was empty.");
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Instagram's currently published max length for a Reel — a hard technical
 * ceiling, not a target (see `StyleRecipe.targetReelSeconds` for the actual
 * per-style duration goal, chosen per editorial best practices rather than
 * always maxing out this number). Kept as a single named constant since Meta
 * has changed this a few times (30s → 60s → 90s) — bump this one number
 * if/when Instagram raises the limit again.
 */
export const INSTAGRAM_REEL_MAX_SECONDS = 60;

/**
 * Renders a real, style-matched montage (cuts + Ken Burns zoom + randomized
 * xfade transitions) from up to 3 uploaded videos, entirely client-side via
 * ffmpeg.wasm.
 *
 * - mode "reel": highlight cut built from the AI-detected best moments,
 *   picking enough of them to land inside the chosen style's target
 *   duration bracket (`StyleRecipe.targetReelSeconds`) — a short punchy
 *   teaser for Viral/Sport, a short story for Travel/Adventure, or a longer
 *   mini-story for Cinematic/Luxury — always bounded by Instagram's real max
 *   (`maxReelSeconds` / `INSTAGRAM_REEL_MAX_SECONDS`) and by `MAX_REEL_CLIPS`
 *   (keeps client-side ffmpeg.wasm rendering fast).
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
    const message = err instanceof Error ? err.message : String(err);
    const audioRelated = /audio|stream specifier|stream map|acrossfade|amix|anullsrc|aac/i.test(message);
    const audioRequested = params.videoAudioEnabled ? params.videoAudioEnabled.some(Boolean) : (params.keepOriginalAudio ?? true);

    if (!audioRequested || !audioRelated) {
      throw err;
    }

    console.warn("[video-engine] Original-audio export failed; retrying without audio:", message);
    return await _buildMontage({ ...params, keepOriginalAudio: false });
  } finally {
    releaseLock();
    renderLock = null;
  }
}

async function _buildMontage(params: BuildMontageParams): Promise<BuildMontageResult> {
  const {
    files,
    videoDurations,
    videoAudioEnabled,
    introClip,
    preserveRouteIntro = false,
    outroClip,
    style,
    mode,
    bestMoments,
    maxStorySeconds = 60,
    maxReelSeconds = 60,
    quality = "720p",
    watermark = false,
    keepOriginalAudio = true,
    renderSpeedProfile = "fast",
    kenBurnsTier = "standard",
    reelTitle,
    overlayTexts = [],
    overlayFonts = [],
    overlaySizes = [],
    overlayColors = [],
    openerHookText,
    routeLabel,
    gpxStats,
    sportTelemetry,
    onProgress,
    onPhaseChange,
  } = params;

  // Determine Ken Burns mode: use tier, or auto-detect from renderSpeedProfile
  const effectiveKenBurnsTier: KenBurnsTier = kenBurnsTier !== "standard" ? kenBurnsTier : (renderSpeedProfile === "fast" ? "skip" : "standard");
  const fastMode = effectiveKenBurnsTier === "skip";

  const recipe = STYLE_RECIPES[style];
  const transitionPool = STYLE_TRANSITIONS[style];
  const { w, h } = QUALITY_DIMENSIONS[quality];
  const RENDER_FPS = renderSpeedProfile === "fast" ? 18 : 24;
  
  // Detect hardware acceleration and select optimal codec
  const hwAccelResult = await detectHardwareAcceleration();
  const selectedCodec: HardwareCodec = hwAccelResult.codec;
  const encoderArgs = buildEncoderArgs(
    selectedCodec,
    renderSpeedProfile === "fast" ? "fast" : "medium",
    renderSpeedProfile === "fast" ? 25 : 23
  );
  // Phase 1 uses more aggressive settings for speed
  const phase1EncoderArgs = buildEncoderArgs(selectedCodec, "fast", 27);
  const renderCodecProfile = encoderArgs.join(" ");
  const phase1CodecProfile = phase1EncoderArgs.join(" ");
  const effectiveRenderFps = renderSpeedProfile === "fast" ? 18 : 24;
  
  const audioSampleRate = 48000;
  const sourceAudioEnabled = await Promise.all(
    files.map(async (file, index) => {
      const explicit = videoAudioEnabled?.[index];
      if (typeof explicit === "boolean") {
        return explicit && (await detectVideoHasAudio(file));
      }
      return keepOriginalAudio && (await detectVideoHasAudio(file));
    })
  );
  const watermarkLeft = Math.round(w * 0.04);
  const watermarkTop = Math.round(h * 0.07);
  const sportDefaultTitleText = style === "sport"
    ? (reelTitle?.text.trim() || (routeLabel && isCoherentDisplayText(routeLabel) ? routeLabel : (openerHookText && isCoherentDisplayText(openerHookText) ? openerHookText : "SPORT MODE")))
    : reelTitle?.text.trim() || "";
  const cleanedReelTitle = sportDefaultTitleText.trim()
    ? {
        ...reelTitle,
        text: sportDefaultTitleText.trim(),
        font: reelTitle?.font ?? "cinematic",
        size: reelTitle?.size ?? "md",
        color: reelTitle?.color ?? "white",
      }
    : null;
  const sportHookSequence = style === "sport"
    ? buildSportHookSequence({
        routeLabel,
        gpxStats,
        sportTelemetry,
        fallbackText: openerHookText || sportDefaultTitleText || "SPORT MODE",
        customTexts: filterCoherentDisplayTexts(overlayTexts),
        overlayFonts,
        overlaySizes,
        overlayColors,
      })
    : [];
  const normalizedSportHookSequence: SportHookBeat[] = style === "sport" && sportHookSequence.length > 0 ? sportHookSequence : [
    { text: `${sportDefaultTitleText || "SPORT MODE"} READY TO RIDE`, label: "LIVE SPORT", title: sportDefaultTitleText || "SPORT MODE", subtitle: "READY TO RIDE", accent: "white", effect: "scratch", theme: "sport", align: "left", font: "bold", size: "md", color: "white" },
    { text: "FULL SEND OFFROAD ENERGY", label: "BREAKAWAY", title: "FULL SEND", subtitle: "OFFROAD ENERGY", accent: "orange", effect: "terrain", theme: "sport", align: "right", font: "bold", size: "md", color: "white" },
    { text: "OFFROAD DUST AND FREEDOM", label: "TERRAIN", title: "OFFROAD", subtitle: "DUST AND FREEDOM", accent: "sand", effect: "dust", theme: "sport", align: "left", font: "bold", size: "md", color: "white" },
  ];
  const cleanedOverlayTexts = style === "sport"
    ? normalizedSportHookSequence.map((beat) => beat.text || beat.title)
    : filterCoherentDisplayTexts(overlayTexts).slice(0, 3);

  const introDuration = introClip?.durationSeconds ?? 0;
  const outroDuration = style === "sport" ? Math.min(outroClip?.durationSeconds ?? 0, 3) : outroClip?.durationSeconds ?? 0;
  const reelContentTarget = Math.max(12, Math.min(60, maxReelSeconds) - introDuration - outroDuration);
  const segments = mode === "reel"
    ? planReelSegments(bestMoments, recipe, videoDurations, reelContentTarget)
    : planStorySegments(videoDurations, recipe, maxStorySeconds);
  const creativePlan = {
    clips: segments.map((_, index) => ({
      index,
      role: "build" as const,
      narrativeRole: "transition-build" as const,
      speedRamp: "none" as const,
      freezeFrame: null,
    })),
  };

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
  console.log(`Quality: ${quality} | KenBurns: ${effectiveKenBurnsTier} | codec: ${selectedCodec} | GPU: ${hwAccelResult.isHardwareAccelerated} | segments: ${segments.length}`);

  const ffmpeg = await loadFFmpeg();
  mark("ffmpeg-ready");

  const hasAnyAudioEnabled = sourceAudioEnabled.some(Boolean);
  onPhaseChange?.(hasAnyAudioEnabled ? "Loading video files with audio…" : "Loading video files…");
  onProgress?.(0.01);

  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  // Write all source files to ffmpeg FS upfront.
  // Serialised (not parallel) to keep peak FS memory predictable.
  const inputNames: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const name = `src_${stamp}_${i}.mp4`;
    await ffmpeg.writeFile(name, await getFileDataForFFmpeg(files[i]));
    inputNames.push(name);
    onProgress?.(0.01 + (i + 1) / files.length * 0.03);
  }
  mark("files-written");
  console.log(`[video-engine] File write: ${elapsed("ffmpeg-ready", "files-written")}`);

  let introSourceName: string | null = null;
  if (introClip) {
    introSourceName = `intro_${stamp}.webm`;
    await ffmpeg.writeFile(introSourceName, await getFileDataForFFmpeg(introClip.file));
  }

  let outroSourceName: string | null = null;
  if (outroClip) {
    outroSourceName = `outro_${stamp}.webm`;
    await ffmpeg.writeFile(outroSourceName, await getFileDataForFFmpeg(outroClip.file));
  }

  let watermarkName: string | null = null;
  if (watermark) {
    watermarkName = `wm_${stamp}.png`;
    const watermarkCacheKey = await buildRenderCacheKey("watermark-v1", [w]);
    const cachedWatermark = getCachedBinaryAsset(watermarkCacheKey);
    console.log("[video-engine] checkpoint: before watermark write");
    if (cachedWatermark) {
      await ffmpeg.writeFile(watermarkName, cloneFFmpegData(cachedWatermark));
    } else {
      const data = await generateWatermarkPng(w);
      putCachedBinaryAsset(watermarkCacheKey, data, "image/png");
      await ffmpeg.writeFile(watermarkName, cloneFFmpegData(data));
    }
    console.log("[video-engine] checkpoint: after watermark write");
  }
  let reelTitleName: string | null = null;
  if (cleanedReelTitle) {
    reelTitleName = `reel_title_${stamp}.png`;
    const reelTitleCacheKey = await buildRenderCacheKey("reel-title-v1", [
      w,
      h,
      cleanedReelTitle.text,
      cleanedReelTitle.font,
      cleanedReelTitle.size,
      cleanedReelTitle.color,
    ]);
    const cachedTitle = getCachedBinaryAsset(reelTitleCacheKey);
    if (cachedTitle) {
      await ffmpeg.writeFile(reelTitleName, cloneFFmpegData(cachedTitle));
    } else {
      const data = await generateReelTitlePng(w, h, cleanedReelTitle);
      putCachedBinaryAsset(reelTitleCacheKey, data, "image/png");
      await ffmpeg.writeFile(reelTitleName, cloneFFmpegData(data));
    }
  }
  const sportTelemetryOverlayNames: string[] = [];
  if (style === "sport") {
    for (const focus of [0, 1, 2] as const) {
      const name = `sport_overlay_${focus}_${stamp}.png`;
      const sportOverlayCacheKey = await buildRenderCacheKey("sport-overlay-v2", [
        w,
        h,
        focus,
        routeLabel ?? "",
        gpxStats?.distanceKm ?? "",
        gpxStats?.durationLabel ?? "",
        gpxStats?.elevationGainM ?? "",
        gpxStats?.highestPointM ?? "",
        sportTelemetry?.maxSpeedKmh ?? "",
      ]);
      const cachedOverlay = getCachedBinaryAsset(sportOverlayCacheKey);
      if (cachedOverlay) {
        await ffmpeg.writeFile(name, cloneFFmpegData(cachedOverlay));
      } else {
        const data = await generateSportTelemetryOverlayPng(w, h, routeLabel, gpxStats, sportTelemetry?.maxSpeedKmh ?? null, focus);
        putCachedBinaryAsset(sportOverlayCacheKey, data, "image/png");
        await ffmpeg.writeFile(name, cloneFFmpegData(data));
      }
      sportTelemetryOverlayNames.push(name);
    }
  }

  const planSportTelemetryWindows = (durationSeconds: number) => {
    if (sportTelemetryOverlayNames.length === 0) return [];
    const startBoundary = Math.max(0.35, introDuration + 0.35);
    const endBoundary = Math.max(startBoundary, durationSeconds - Math.max(0.35, outroDuration + 0.35));
    const available = endBoundary - startBoundary;
    if (available < 2.4) return [];
    const segment = available / sportTelemetryOverlayNames.length;
    return sportTelemetryOverlayNames.map((name, index) => {
      const start = startBoundary + index * segment;
      const end = index === sportTelemetryOverlayNames.length - 1 ? endBoundary : startBoundary + (index + 1) * segment;
      return { name, start, end: Math.max(start + 0.8, end) };
    });
  };

  // ── Progress accounting ───────────────────────────────────────────────────
  // IMPORTANT: progress is capped at 0.97 throughout the render loop.
  // The final 3% (0.97→0.99→1.0) are emitted manually after the FS read and
  // blob creation complete — so the bar never shows 100% while the user is
  // still waiting for the file to be available.
  const normalizedClipUnits = (introClip ? 1 : 0) + (outroClip ? 1 : 0);
  const needsComposePass = segments.length + (introClip ? 1 : 0) + (outroClip ? 1 : 0) > 1 || !!watermark;
  let totalUnits = normalizedClipUnits + segments.length + (needsComposePass ? 1 : 0);
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
  console.log("[video-engine] checkpoint: before overlay generation");

  const segmentClipNames: string[] = [];
  const segmentDurations: number[] = [];
  const retainedFinalOutputs = new Set<string>();
  const tempFiles: string[] = [
    ...inputNames,
    ...(introSourceName ? [introSourceName] : []),
    ...(outroSourceName ? [outroSourceName] : []),
    ...(watermarkName ? [watermarkName] : []),
    ...(reelTitleName ? [reelTitleName] : []),
    ...sportTelemetryOverlayNames,
  ];
  const overlayTextNames: string[] = [];

  try {
    for (let i = 0; i < cleanedOverlayTexts.length; i++) {
      const name = `overlay_text_${stamp}_${i}.png`;
      const sportBeat = style === "sport" ? normalizedSportHookSequence[i] : undefined;
      const overlayCacheKey = await buildRenderCacheKey("overlay-text-v2", [
        w,
        h,
        style,
        cleanedOverlayTexts[i],
        sportBeat?.label ?? "",
        sportBeat?.subtitle ?? "",
        sportBeat?.theme ?? "",
        sportBeat?.align ?? "",
        sportBeat?.effect ?? "",
        sportBeat?.font ?? "",
        sportBeat?.size ?? "",
        sportBeat?.color ?? "",
      ]);
      const cachedOverlay = getCachedBinaryAsset(overlayCacheKey);
      console.log(`[video-engine] checkpoint: overlay ${i} start`);
      if (cachedOverlay) {
        await ffmpeg.writeFile(name, cloneFFmpegData(cachedOverlay));
      } else {
        const data = await generateOverlayTextPng(w, h, cleanedOverlayTexts[i], style, sportBeat);
        putCachedBinaryAsset(overlayCacheKey, data, "image/png");
        await ffmpeg.writeFile(name, cloneFFmpegData(data));
      }
      console.log(`[video-engine] checkpoint: overlay ${i} done`);
      overlayTextNames.push(name);
      tempFiles.push(name);
    }

    const appendSportInsertFilters = (baseLabel: string) => ({ finalLabel: baseLabel, inputsUsed: 0 });

    const appendOverlayFilters = (
      filterParts: string[],
      baseLabel: string,
      firstInputIndex: number,
      durationSeconds: number,
      labelPrefix: string
    ) => {
      const titleWindow = cleanedReelTitle
        ? planReelTitleWindow(
          durationSeconds,
          introDuration,
          outroDuration,
          style
          )
        : null;
      const sportWindows = planSportTelemetryWindows(durationSeconds);
      if (overlayTextNames.length === 0 && !titleWindow && sportWindows.length === 0) {
        return { finalLabel: baseLabel, overlaysUsed: 0, usedTitle: false, usedSport: false };
      }

      const overlays = style === "sport"
        ? planSportHookWindows(
          normalizedSportHookSequence,
          durationSeconds,
          introDuration,
          outroDuration,
          titleWindow ? titleWindow.end + 0.45 : 0
          )
        : planOverlayTextWindows(
          cleanedOverlayTexts,
          durationSeconds,
          introDuration,
          outroDuration,
          titleWindow ? titleWindow.end + 0.35 : 0,
          style
          );

      let currentLabel = baseLabel;
      let nextInputIndex = firstInputIndex;

      if (style !== "sport") {
        sportWindows.forEach((window, index) => {
          const inputIndex = nextInputIndex;
          nextInputIndex += 1;
          const sportLabel = `${labelPrefix}_sportsrc_${index}`;
          const sportOutLabel = `${labelPrefix}_sport_${index}`;
          filterParts.push(`[${inputIndex}:v]format=rgba[${sportLabel}]`);
          filterParts.push(
          `[${currentLabel}][${sportLabel}]overlay=0:0:enable='between(t,${window.start.toFixed(3)},${window.end.toFixed(3)})'[${sportOutLabel}]`
          );
          currentLabel = sportOutLabel;
        });
      }

      if (reelTitleName && titleWindow) {
        const inputIndex = nextInputIndex;
        nextInputIndex += 1;
        const titleLabel = `${labelPrefix}_titlesrc`;
        const titleOutLabel = `${labelPrefix}_title`;
        filterParts.push(`[${inputIndex}:v]format=rgba[${titleLabel}]`);
        filterParts.push(
          `[${currentLabel}][${titleLabel}]overlay=(W-w)/2:H*0.08:enable='between(t,${titleWindow.start.toFixed(3)},${titleWindow.end.toFixed(3)})'[${titleOutLabel}]`
        );
        currentLabel = titleOutLabel;
      }

      overlays.forEach((overlay, index) => {
        const inputIndex = nextInputIndex;
        nextInputIndex += 1;
        const textLabel = `${labelPrefix}_txtsrc_${index}`;
        const outLabel = `${labelPrefix}_txt_${index}`;
        if (style === "sport") {
          const sportOverlay = overlay as SportHookWindow;
          const overlayDuration = Math.max(0.45, overlay.end - overlay.start);
          const introFade = Math.min(0.24, overlayDuration * 0.3);
          const outroFade = Math.min(0.14, overlayDuration * 0.24);
          const slideDistance = Math.round(w * 0.045);
          const anchorMargin = Math.round(w * 0.06);
          const xExpr = sportOverlay.align === "right"
          ? `if(lt(t,${(overlay.start + introFade).toFixed(3)}),W-w-${anchorMargin}-${slideDistance} + ${slideDistance} * ((t-${overlay.start.toFixed(3)})/${introFade.toFixed(3)}),W-w-${anchorMargin})`
          : `if(lt(t,${(overlay.start + introFade).toFixed(3)}),${anchorMargin}+${slideDistance} - ${slideDistance} * ((t-${overlay.start.toFixed(3)})/${introFade.toFixed(3)}),${anchorMargin})`;
          const yExpr = sportOverlay.align === "right"
          ? "H*0.55"
          : "H*0.57";
          filterParts.push(
          `[${inputIndex}:v]loop=loop=999:size=1:start=0,trim=duration=${overlayDuration.toFixed(3)},setpts=PTS-STARTPTS,format=rgba,fade=t=in:st=0:d=${introFade.toFixed(3)}:alpha=1,fade=t=out:st=${Math.max(0, overlayDuration - outroFade).toFixed(3)}:d=${outroFade.toFixed(3)}:alpha=1[${textLabel}]`
          );
          filterParts.push(
          `[${currentLabel}][${textLabel}]overlay=${xExpr}:${yExpr}:enable='between(t,${overlay.start.toFixed(3)},${overlay.end.toFixed(3)})'[${outLabel}]`
          );
        } else {
          filterParts.push(`[${inputIndex}:v]format=rgba[${textLabel}]`);
          filterParts.push(
          `[${currentLabel}][${textLabel}]overlay=(W-w)/2:H*0.32:enable='between(t,${overlay.start.toFixed(3)},${overlay.end.toFixed(3)})'[${outLabel}]`
          );
        }
        currentLabel = outLabel;
      });

      return { finalLabel: currentLabel, overlaysUsed: overlays.length, usedTitle: !!titleWindow, usedSport: style !== "sport" && sportWindows.length > 0 };
    };

    const appendAudioChain = (
      filterParts: string[],
      clipDurations: number[],
      transitionDurations: number[],
      audioFlags: boolean[],
    ) => {
      if (audioFlags.length === 0 || !audioFlags.some(Boolean)) return null;

      const labels: string[] = [];
      for (let i = 0; i < audioFlags.length; i++) {
        const label = `a${i}`;
        const duration = clipDurations[i] ?? 0;
        const silent = !audioFlags[i];
        if (silent) {
          filterParts.push(`anullsrc=r=${audioSampleRate}:cl=stereo:d=${duration.toFixed(3)}[${label}]`);
        } else {
          filterParts.push(`[${i}:a]aresample=${audioSampleRate},asetpts=PTS-STARTPTS[${label}]`);
        }
        labels.push(label);
      }

      let currentLabel = labels[0];
      for (let i = 1; i < labels.length; i++) {
        const outLabel = i === labels.length - 1 ? "apre" : `ax${i}`;
        const fadeDuration = transitionDurations[i - 1] ?? 0.25;
        filterParts.push(
          `[${currentLabel}][${labels[i]}]acrossfade=d=${fadeDuration.toFixed(3)}:c1=tri:c2=tri[${outLabel}]`
        );
        currentLabel = outLabel;
      }

      return currentLabel;
    };

    let introName: string | null = null;
    if (introSourceName) {
      onPhaseChange?.("Transcoding map intro…");
      mark("intro-start");
      const introTimeoutMs = renderSpeedProfile === "fast" ? INTRO_TRANSCODE_TIMEOUT_MS_FAST : INTRO_TRANSCODE_TIMEOUT_MS_QUALITY;
      try {
        introName = `intro_norm_${stamp}.mp4`;
        const introCacheKey = await buildRenderCacheKey("intro-norm-v1", [
          fingerprintFile(introClip!.file),
          introDuration,
          quality,
          w,
          h,
          RENDER_FPS,
          selectedCodec,
          renderCodecProfile,
        ]);
        const cachedIntro = getCachedBinaryAsset(introCacheKey);
        if (cachedIntro) {
          await ffmpeg.writeFile(introName, cloneFFmpegData(cachedIntro));
          console.log("[video-engine] Map intro cache hit");
        } else {
          await withTimeout(
            ffmpeg.exec([
              "-fflags", "+genpts",
              "-i", introSourceName,
              "-t", introDuration.toFixed(3),
              "-vf", `fps=${RENDER_FPS},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setpts=PTS-STARTPTS,format=yuv420p`,
              "-r", String(RENDER_FPS),
              ...encoderArgs,
              "-pix_fmt", "yuv420p",
              introName,
            ]),
            introTimeoutMs,
          );
          const data = await ffmpeg.readFile(introName);
          putCachedBinaryAsset(introCacheKey, data as Uint8Array, "video/mp4");
        }
        tempFiles.push(introName);
        completedUnits++;
        mark("intro-done");
        console.log(`[video-engine] Map intro transcode: ${elapsed("intro-start", "intro-done")}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[video-engine] Map intro transcode failed.", message);
        if (preserveRouteIntro) {
          throw error;
        }
        introName = null;
        totalUnits = Math.max(1, totalUnits - 1);
        onPhaseChange?.("Map intro too heavy on this device — continuing without it…");
      }
    }

    let outroName: string | null = null;
    if (outroSourceName) {
      onPhaseChange?.("Transcoding outro card…");
      mark("outro-start");
      outroName = `outro_norm_${stamp}.mp4`;
      const outroCacheKey = await buildRenderCacheKey("outro-norm-v1", [
        fingerprintFile(outroClip!.file),
        outroDuration,
        quality,
        w,
        h,
        RENDER_FPS,
        selectedCodec,
        renderCodecProfile,
      ]);
      const cachedOutro = getCachedBinaryAsset(outroCacheKey);
      if (cachedOutro) {
        await ffmpeg.writeFile(outroName, cloneFFmpegData(cachedOutro));
        console.log("[video-engine] Outro card cache hit");
      } else {
        await ffmpeg.exec([
          "-fflags", "+genpts",
          "-i", outroSourceName,
          "-t", outroDuration.toFixed(3),
          "-vf", `fps=${RENDER_FPS},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setpts=PTS-STARTPTS,format=yuv420p`,
          "-r", String(RENDER_FPS),
          ...encoderArgs,
          "-pix_fmt", "yuv420p",
          outroName,
        ]);
        const data = await ffmpeg.readFile(outroName);
        putCachedBinaryAsset(outroCacheKey, data as Uint8Array, "video/mp4");
      }
      tempFiles.push(outroName);
      completedUnits++;
      mark("outro-done");
      console.log(`[video-engine] Outro transcode: ${elapsed("outro-start", "outro-done")}`);
    }

    // --- Phase 1: extract + Ken Burns zoom each segment (fast seek, small decode) ---
    onPhaseChange?.(fastMode ? `Cutting ${segments.length} clips…` : `Cutting & zooming ${segments.length} clips…`);
    mark("phase1-start");
    for (let i = 0; i < segments.length; i++) {
      const rawSeg = segments[i];
      const seg = rawSeg;
      const clipDuration = seg.length / effectiveSpeed(seg, recipe);
      const segmentFilter = buildSegmentFilter(seg, i, recipe, w, h, RENDER_FPS, fastMode, style);
      const clipName = `seg_${stamp}_${i}.mp4`;
      console.log(`[video-engine] checkpoint: segment ${i} start`);
      const segmentAudioEnabled = sourceAudioEnabled[seg.sourceIndex] ?? true;
      const segmentCacheKey = await buildRenderCacheKey("segment-v1", [
        fingerprintFile(files[seg.sourceIndex]),
        seg.sourceIndex,
        seg.start,
        seg.length,
        recipe.clipDuration,
        recipe.speed,
        recipe.zoom,
        recipe.zoomIntensity,
        fastMode,
        effectiveKenBurnsTier,
        quality,
        renderSpeedProfile,
        mode,
        selectedCodec,
        phase1CodecProfile,
        w,
        h,
        RENDER_FPS,
        segmentAudioEnabled,
        seg.slowMo ?? false,
      ]);
      const cachedSegment = getCachedBinaryAsset(segmentCacheKey);

      if (cachedSegment) {
        await ffmpeg.writeFile(clipName, cloneFFmpegData(cachedSegment));
        console.log(`[video-engine] Segment cache hit: ${i + 1}/${segments.length}`);
      } else {
        await ffmpeg.exec([
          "-ss", seg.start.toFixed(3),
          "-t", seg.length.toFixed(3),
          "-i", inputNames[seg.sourceIndex],
          "-vf", segmentFilter,
          "-r", String(RENDER_FPS),
          ...phase1EncoderArgs,
          ...(segmentAudioEnabled ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"]),
          "-pix_fmt", "yuv420p",
          clipName,
        ]);
        const data = await ffmpeg.readFile(clipName);
        putCachedBinaryAsset(segmentCacheKey, data as Uint8Array, "video/mp4");
      }

      segmentClipNames.push(clipName);
      segmentDurations.push(clipDuration);
      tempFiles.push(clipName);
      completedUnits++;
    }
    mark("phase1-done");
    console.log(`[video-engine] Phase 1 (${segments.length} clips, HW codec, KenBurns=${effectiveKenBurnsTier}): ${elapsed("phase1-start", "phase1-done")}`);

    const finalClipNames = [...(introName ? [introName] : []), ...segmentClipNames, ...(outroName ? [outroName] : [])];
    let finalDurations = [...(introName ? [introDuration] : []), ...segmentDurations, ...(outroName ? [outroDuration] : [])];

    // SPORT mode is the most FS-sensitive path in ffmpeg.wasm, but the reel also
    // needs enough distinct clips to preserve the planned narrative (intro -> action
    // beats -> outro). Keep the final graph compact without collapsing the montage to
    // a single-shot fallback or stripping the required title/hook/outro sequence.
    const composeCap = style === "sport" ? 5 : 6;
    if (finalClipNames.length > composeCap) {
      const preferIntro = introName ? finalClipNames.indexOf(introName) : -1;
      const preferOutro = outroName ? finalClipNames.lastIndexOf(outroName) : -1;
      const keepIndexes = new Set<number>();
      if (preferIntro >= 0) keepIndexes.add(preferIntro);
      if (preferOutro >= 0) keepIndexes.add(preferOutro);
      for (let index = 0; index < finalClipNames.length && keepIndexes.size < composeCap; index++) {
        if (index === preferIntro || index === preferOutro) continue;
        keepIndexes.add(index);
      }
      const trimmed = [...keepIndexes].sort((a, b) => a - b).map((index) => finalClipNames[index]);
      const trimmedDurations = trimmed.map((name) => {
        const index = finalClipNames.indexOf(name);
        return index >= 0 ? finalDurations[index] : 0;
      });
      const reducedTotal = trimmedDurations.reduce((sum, duration) => sum + duration, 0);
      if (reducedTotal > 0.1) {
        finalClipNames.splice(0, finalClipNames.length, ...trimmed);
        finalDurations = trimmedDurations;
      }
    }

    // Keep the final encode and readback on the same FFmpeg instance. The
    // browser-side FS is single-instance and the fresh-instance copy step can
    // leave the output file present in one in-memory FS but unreadable in the
    // actual render/session that is still active.
    const readFinalOutputFile = async (ffmpegInstance: FFmpeg, fileName: string): Promise<Uint8Array> => {
        const candidatePaths = [
          fileName,
          `/home/${fileName}`,
          `/tmp/${fileName}`,
          `home/${fileName}`,
          `tmp/${fileName}`,
        ];
        const joinPath = (base: string, child: string) => {
          if (!base || base === "/") return `/${child}`;
          return `${base.replace(/\/$/, "")}/${child}`;
        };
        const tryReadPath = async (candidatePath: string): Promise<Uint8Array | null> => {
          try {
            const data = await ffmpegInstance.readFile(candidatePath) as Uint8Array;
            if (data.byteLength === 0) {
              console.warn(`[video-engine] finaliseOutput readFile returned empty data for ${candidatePath}`);
              return null;
            }
            console.log(`[video-engine] finaliseOutput readFile succeeded for ${candidatePath} (${data.byteLength} bytes)`);
            return data;
          } catch {
            return null;
          }
        };
        const scanDirectory = async (dirPath: string, depth: number): Promise<{ path: string; data: Uint8Array } | null> => {
          try {
            const entries = await ffmpegInstance.listDir(dirPath);
            console.log(`[video-engine] finaliseOutput scan ${dirPath} for ${fileName}:`, entries.map((entry) => entry.name));
            for (const entry of entries) {
              if (entry.name === "." || entry.name === "..") continue;
              const candidatePath = joinPath(dirPath, entry.name);
              const directData = await tryReadPath(candidatePath);
              if (directData) return { path: candidatePath, data: directData };
              if (depth > 0) {
                const nested = await scanDirectory(candidatePath, depth - 1);
                if (nested) return nested;
              }
            }
          } catch (error) {
            console.log(`[video-engine] finaliseOutput scan failed for ${dirPath}:`, error);
          }
          return null;
        };
        let lastError: unknown;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            if (attempt > 0) {
              await new Promise((resolve) => window.setTimeout(resolve, 150 * attempt));
            }
            for (const candidatePath of candidatePaths) {
              const data = await tryReadPath(candidatePath);
              if (data) return data;
            }
            for (const dirPath of ["/", "/home", "/tmp", "home", "tmp"]) {
              const scanned = await scanDirectory(dirPath, 1);
              if (scanned) return scanned.data;
            }
            const rootEntries = await ffmpegInstance.listDir('/');
            console.log(`[video-engine] finaliseOutput FS root for ${fileName} (attempt ${attempt + 1}):`, rootEntries.map((entry) => entry.name));
            throw new Error(`FFmpeg output file ${fileName} missing from in-memory FS.`);
          } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            if (attempt < 3 && /FS error|ENOENT|No such file|missing from in-memory FS|not found/i.test(message)) {
              console.warn(`[video-engine] Final output read retry ${attempt + 1}/4 for ${fileName}:`, error);
              continue;
            }
            throw error;
          }
        }
        throw lastError ?? new Error(`Failed to read final output ${fileName}.`);
    };

  const finaliseOutput = async (name: string, durationSeconds: number, clipCount: number, outputFFmpeg: FFmpeg = ffmpeg): Promise<BuildMontageResult> => {
      retainedFinalOutputs.add(name);
      onPhaseChange?.("Writing output file…");
      onProgress?.(0.95);
      let data: Uint8Array;
      try {
        data = await readFinalOutputFile(outputFFmpeg, name);
      } catch (error) {
        if (outputFFmpeg !== ffmpeg) {
          try {
            console.warn(`[video-engine] finaliseOutput falling back to primary FFmpeg instance for ${name}.`);
            data = await readFinalOutputFile(ffmpeg, name);
          } catch (primaryError) {
            try {
              const directory = await outputFFmpeg.listDir('/');
              console.error(`[video-engine] finaliseOutput readFile failed for ${name}. Root dir:`, directory.map((entry) => entry.name));
            } catch (dirError) {
              console.error(`[video-engine] finaliseOutput readFile failed for ${name}; failed to inspect FS root.`, dirError);
            }
            console.error(`[video-engine] finaliseOutput readFile failed for ${name}`, primaryError);
            throw primaryError;
          }
        } else {
        try {
          const directory = await outputFFmpeg.listDir('/');
          console.error(`[video-engine] finaliseOutput readFile failed for ${name}. Root dir:`, directory.map((entry) => entry.name));
        } catch (dirError) {
          console.error(`[video-engine] finaliseOutput readFile failed for ${name}; failed to inspect FS root.`, dirError);
        }
        console.error(`[video-engine] finaliseOutput readFile failed for ${name}`, error);
        throw error;
        }
      }
      onProgress?.(0.97);
      onPhaseChange?.("Verifying export…");
      const blob = ensureNonEmptyVideoBlob(data, "video/mp4");
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
      return {
        url,
        blob,
        durationSeconds,
        clipCount,
        appliedEffects: style === "sport" ? ["Editorial sport telemetry overlay"] : [],
        proLockedEffects: [],
        editingPattern: { name: style, description: "" },
      };
    };

    // --- Single clip, no watermark: no re-encode needed, it *is* the final montage ---
    if (finalClipNames.length === 1 && !watermark) {
      const singleSportInsertPlan = appendSportInsertFilters("0:v");
      if (overlayTextNames.length === 0 && !cleanedReelTitle && sportTelemetryOverlayNames.length === 0 && singleSportInsertPlan.inputsUsed === 0) {
        if (sourceAudioEnabled[0] ?? true) {
          return finaliseOutput(finalClipNames[0], finalDurations[0], 1);
        }
        const outputName = `out_${stamp}.mp4`;
        await ffmpeg.exec([
          "-i",
          finalClipNames[0],
          "-vf",
          `fps=${RENDER_FPS},setpts=PTS-STARTPTS,format=yuv420p`,
          "-r",
          String(RENDER_FPS),
          ...encoderArgs,
          "-an",
          "-pix_fmt",
          "yuv420p",
          outputName,
        ]);
        tempFiles.push(outputName);
        completedUnits++;
        return finaliseOutput(outputName, finalDurations[0], 1);
      }

      const outputName = `out_${stamp}.mp4`;
      const filterParts: string[] = [];
      const { finalLabel: afterInsertLabel, inputsUsed: sportInsertInputs } = appendSportInsertFilters("0:v");
      const { finalLabel, overlaysUsed, usedTitle, usedSport } = appendOverlayFilters(
        filterParts,
        afterInsertLabel,
        1 + sportInsertInputs,
        finalDurations[0],
        "single"
      );
      if (overlaysUsed === 0 && !usedTitle && !usedSport && sportInsertInputs === 0) {
        return finaliseOutput(finalClipNames[0], finalDurations[0], 1);
      }
      onPhaseChange?.("Burning in overlay text…");
      await ffmpeg.exec([
        "-i",
        finalClipNames[0],
        ...(style !== "sport" ? sportTelemetryOverlayNames.flatMap((name) => ["-i", name]) : []),
        ...(reelTitleName ? ["-i", reelTitleName] : []),
        ...overlayTextNames.slice(0, overlaysUsed).flatMap((name) => ["-i", name]),
        "-filter_complex",
        filterParts.join(";"),
        "-map",
        `[${finalLabel}]`,
        "-r",
        String(RENDER_FPS),
        ...encoderArgs,
        ...(sourceAudioEnabled[0] ?? true ? ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k"] : ["-an"]),
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
      const filterParts = [`[1:v]format=rgba[wm]`, `[0:v][wm]overlay=${watermarkLeft}:${watermarkTop}[vwm]`];
      const { finalLabel: afterInsertLabel, inputsUsed: sportInsertInputs } = appendSportInsertFilters("vwm");
      const { finalLabel, overlaysUsed } = appendOverlayFilters(filterParts, afterInsertLabel, 2 + sportInsertInputs, finalDurations[0], "singlewm");
      await ffmpeg.exec([
        "-i", finalClipNames[0],
        "-i", watermarkName as string,
        ...(style !== "sport" ? sportTelemetryOverlayNames.flatMap((name) => ["-i", name]) : []),
        ...(reelTitleName ? ["-i", reelTitleName] : []),
        ...overlayTextNames.slice(0, overlaysUsed).flatMap((name) => ["-i", name]),
        "-filter_complex",
        filterParts.join(";"),
        "-map",
        `[${finalLabel}]`,
        "-r", String(RENDER_FPS),
        ...encoderArgs,
        ...(sourceAudioEnabled[0] ?? true ? ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k"] : ["-an"]),
        "-pix_fmt", "yuv420p",
        outputName,
      ]);
      completedUnits++;
      tempFiles.push(outputName);
      return finaliseOutput(outputName, finalDurations[0], 1);
    }

    // --- Phase 2: compose the finished timeline. For SPORT and other dense
    // reels, the xfade chain can be too heavy for browser ffmpeg.wasm at the
    // very end of export, so fall back to a simpler concat path when the clip
    // count is high. This keeps the montage dynamic while avoiding the final
    // 95% crash that comes from a very long transition graph.
    const useCompactConcatFallback = shouldUseCompactConcatFallback(style, finalClipNames.length);
    if (useCompactConcatFallback) {
      onPhaseChange?.(`Compositing ${finalClipNames.length} clips in compact mode…`);
      mark("phase2-start");

      const baseOutputName = `base_${stamp}.mp4`;
      const concatManifestName = `concat_${stamp}.txt`;
      await ffmpeg.writeFile(concatManifestName, buildConcatManifest(finalClipNames));
      tempFiles.push(concatManifestName);
      try {
        await ffmpeg.exec([
          "-f", "concat",
          "-safe", "0",
          "-i", concatManifestName,
          "-c", "copy",
          baseOutputName,
        ]);
      } catch (error) {
        console.warn("[video-engine] compact-concat copy join failed; falling back to re-encode concat", error);
        const concatFilterParts: string[] = [];
        const concatInputs = finalClipNames.map((_, index) => `[${index}:v]`).join("");
        concatFilterParts.push(`${concatInputs}concat=n=${finalClipNames.length}:v=1:a=0[vbase]`);

        const baseExecArgs = finalClipNames.flatMap((name) => ["-i", name]);
        baseExecArgs.push(
          "-filter_complex", concatFilterParts.join(";"),
          "-map", "[vbase]",
          "-an",
          "-r", String(RENDER_FPS),
          ...encoderArgs,
          "-pix_fmt", "yuv420p",
          "-threads", "0",
          baseOutputName
        );
        try {
          await ffmpeg.exec(baseExecArgs);
        } catch (fallbackError) {
          console.error("[video-engine] compact-concat base composition failed", fallbackError);
          throw fallbackError;
        }
      }
      tempFiles.push(baseOutputName);

      const renderDuration = Math.max(finalDurations.reduce((sum, d) => sum + d, 0), 0.5);
      const finalStageFFmpeg = await loadFFmpeg();
      const stageTransferFiles = [
        baseOutputName,
        ...(watermark ? [watermarkName as string] : []),
        ...(reelTitleName ? [reelTitleName] : []),
        ...sportTelemetryOverlayNames,
        ...overlayTextNames,
      ];
      for (const fileName of stageTransferFiles) {
        try {
          const data = await ffmpeg.readFile(fileName) as Uint8Array;
          await finalStageFFmpeg.writeFile(fileName, cloneFFmpegData(data));
        } catch (error) {
          console.warn(`[video-engine] Failed to stage ${fileName} into compact final FFmpeg instance:`, error);
        }
      }

      const overlayFilterParts: string[] = [];
      const overlayExecArgs = ["-i", baseOutputName];
      let currentLabel = "0:v";
      let overlayStartIndex = 1;

      if (watermark) {
        overlayExecArgs.push("-i", watermarkName as string);
        overlayFilterParts.push(`[1:v]format=rgba[wm]`);
        overlayFilterParts.push(`[0:v][wm]overlay=${watermarkLeft}:${watermarkTop}[vwm]`);
        currentLabel = "vwm";
        overlayStartIndex = 2;
      }

      const { finalLabel: afterInsertLabel, inputsUsed: multiSportInsertInputs } = appendSportInsertFilters(currentLabel);
      overlayStartIndex += multiSportInsertInputs;
      const { finalLabel, overlaysUsed } = appendOverlayFilters(
        overlayFilterParts,
        afterInsertLabel,
        overlayStartIndex,
        renderDuration,
        "multi"
      );
      if (style !== "sport") {
        overlayExecArgs.push(...sportTelemetryOverlayNames.flatMap((name) => ["-i", name]));
      }
      if (reelTitleName) overlayExecArgs.push("-i", reelTitleName);
      overlayExecArgs.push(...overlayTextNames.slice(0, overlaysUsed).flatMap((name) => ["-i", name]));

      if (overlayFilterParts.length === 0 && !watermark) {
        tempFiles.push(baseOutputName);
        return finaliseOutput(baseOutputName, renderDuration, finalClipNames.length);
      }

      console.log("[video-engine] compact-overlay debug", {
        baseOutputName,
        outputName: `out_${stamp}.mp4`,
        inputs: overlayExecArgs,
        filterComplex: overlayFilterParts.join(";"),
      });
      const outputName = `out_${stamp}.mp4`;
      overlayExecArgs.push(
        "-filter_complex", overlayFilterParts.join(";"),
        "-map", `[${finalLabel}]`,
        "-an",
        "-r", String(RENDER_FPS),
        ...encoderArgs,
        "-pix_fmt", "yuv420p",
        "-threads", "0",
        outputName
      );

      try {
        await finalStageFFmpeg.exec(overlayExecArgs);
      } catch (error) {
        console.error("[video-engine] compact-concat overlay composition failed", error);
        throw error;
      }
      completedUnits++;
      mark("phase2-done");
      console.log(`[video-engine] Phase 2 (compact-concat compose): ${elapsed("phase2-start", "phase2-done")}`);

      tempFiles.push(outputName);
      return finaliseOutput(outputName, renderDuration, finalClipNames.length, finalStageFFmpeg);
    }

    onPhaseChange?.(`Compositing ${finalClipNames.length} clips with transitions…`);
    mark("phase2-start");
    const filterParts: string[] = [];
    let prevLabel = "0:v";
    let acc = finalDurations[0];
    let prevTransitionName: string | null = null;
    const transitionDurations: number[] = [];

    for (let i = 1; i < finalClipNames.length; i++) {
      const transitionName = pickTransitionName(transitionPool, prevTransitionName);
      const transitionDuration = capTransitionDuration(
        randomTransitionDuration(transitionPool),
        finalDurations[i - 1],
        finalDurations[i]
      );
      prevTransitionName = transitionName;
      transitionDurations.push(transitionDuration);

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
    let overlayStartIndex = finalClipNames.length + (watermark ? 1 : 0);
    if (watermark) {
      const wmInputIndex = finalClipNames.length;
      execArgs.push("-i", watermarkName as string);
      filterParts.push(`[${wmInputIndex}:v]format=rgba[wm]`);
      filterParts.push(`[vpre][wm]overlay=${watermarkLeft}:${watermarkTop}[vout]`);
      mapTarget = "[vout]";
    }
    const { finalLabel: afterInsertLabel, inputsUsed: multiSportInsertInputs } = appendSportInsertFilters(mapTarget.slice(1, -1));
    overlayStartIndex += multiSportInsertInputs;
    const { finalLabel, overlaysUsed } = appendOverlayFilters(
      filterParts,
      afterInsertLabel,
      overlayStartIndex,
      Math.max(acc, 0.5),
      "multi"
    );
    if (style !== "sport") {
      execArgs.push(...sportTelemetryOverlayNames.flatMap((name) => ["-i", name]));
    }
    if (reelTitleName) {
      execArgs.push("-i", reelTitleName);
    }
    execArgs.push(...overlayTextNames.slice(0, overlaysUsed).flatMap((name) => ["-i", name]));
    const finalAudioFlags = [
      ...(introName ? [false] : []),
      ...segmentClipNames.map((_, index) => sourceAudioEnabled[segments[index].sourceIndex] ?? true),
      ...(outroName ? [false] : []),
    ];
    const audioFinalLabel = appendAudioChain(filterParts, finalDurations, transitionDurations, finalAudioFlags);

    const outputName = `out_${stamp}.mp4`;
    execArgs.push(
      "-filter_complex", filterParts.join(";"),
      "-map", `[${finalLabel}]`,
      ...(audioFinalLabel ? ["-map", `[${audioFinalLabel}]`, "-c:a", "aac", "-b:a", "128k"] : ["-an"]),
      "-r", String(RENDER_FPS),
      ...encoderArgs,
      "-pix_fmt", "yuv420p",
      // Harmless no-op on the single-threaded core; lets libx264 use all
      // available pthread workers when the multi-threaded core is active.
      "-threads", "0",
      outputName
    );

    try {
      await ffmpeg.exec(execArgs);
    } catch (error) {
      console.error("[video-engine] xfade final composition failed", error);
      throw error;
    }
    completedUnits++;
    mark("phase2-done");
    console.log(`[video-engine] Phase 2 (compose): ${elapsed("phase2-start", "phase2-done")}`);

    tempFiles.push(outputName);
    return finaliseOutput(outputName, Math.max(acc, 0.5), finalClipNames.length);
  } finally {
    ffmpeg.off("progress", progressHandler);
    for (const name of tempFiles) {
      if (retainedFinalOutputs.has(name)) continue;
      try {
        await ffmpeg.deleteFile(name);
      } catch (error) {
        if (!isIgnorableFsCleanupError(error)) {
          console.warn(`[video-engine] Cleanup skipped for ${name}:`, error);
        }
      }
    }
  }
}
