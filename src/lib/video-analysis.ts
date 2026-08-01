import { BestMoment } from "@/types";

/**
 * Real, fully client-side "best moment" detection.
 *
 * This samples frames across the whole video and scores each sample on:
 * - motion (frame-to-frame pixel difference)
 * - sharpness (gradient/edge energy — blurry/shaky frames score low)
 * - exposure (penalizes frames that are too dark or blown out)
 *
 * The highest-scoring, well-separated peaks become the "best moments" that
 * get cut into the Reel — so the montage actually reflects each video's
 * content instead of picking evenly-spaced/random timestamps.
 *
 * FUTURE BACKEND INTEGRATION:
 * This heuristic is a lightweight stand-in for a real model. In production,
 * replace it with a backend job that runs a proper shot/scene detector and a
 * saliency or aesthetic-quality model (e.g. PySceneDetect + a small vision
 * model) on the original-resolution frames, and optionally add face/smile
 * detection for the "peak facial expression" signal.
 */

const SAMPLE_W = 48;
const SAMPLE_H = 27;
const MAX_SAMPLES_PER_VIDEO = 36;
const MIN_SAMPLE_INTERVAL = 0.25;
const MAX_SAMPLE_INTERVAL = 1.4;

interface FrameSample {
  t: number;
  brightness: number; // 0-1
  sharpness: number; // raw gradient energy, normalized later
  motion: number; // raw frame diff, normalized later
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      resolve();
    };
    const timeout = setTimeout(done, 800); // fallback in case 'seeked' never fires for this codec/browser
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = time;
  });
}

function loadVideo(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("loadedmetadata", () => resolve({ video, url }), { once: true });
    video.addEventListener("error", () => reject(new Error("Could not load video for analysis")), { once: true });
  });
}

/** Draws the current video frame onto a tiny canvas and returns grayscale pixel data + brightness. */
function sampleFrame(video: HTMLVideoElement, ctx: CanvasRenderingContext2D): { gray: Float32Array; brightness: number } {
  ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
  const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
  const gray = new Float32Array(SAMPLE_W * SAMPLE_H);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    gray[p] = g;
    sum += g;
  }
  return { gray, brightness: sum / gray.length };
}

/** Simple gradient-magnitude sharpness estimate on the downsampled grayscale frame. */
function sharpnessOf(gray: Float32Array): number {
  let total = 0;
  for (let y = 1; y < SAMPLE_H - 1; y++) {
    for (let x = 1; x < SAMPLE_W - 1; x++) {
      const idx = y * SAMPLE_W + x;
      const gx = gray[idx + 1] - gray[idx - 1];
      const gy = gray[idx + SAMPLE_W] - gray[idx - SAMPLE_W];
      total += gx * gx + gy * gy;
    }
  }
  return total / ((SAMPLE_W - 2) * (SAMPLE_H - 2));
}

function motionBetween(a: Float32Array, b: Float32Array): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range < 1e-6) return values.map(() => 0.5);
  return values.map((v) => (v - min) / range);
}

const REASONS = {
  motion: ["High motion + sharp focus detected", "Sudden speed or action spike", "Dynamic movement across the frame"],
  sharpness: ["Strong composition and lighting change", "Crisp, well-focused frame", "Detailed, high-clarity shot"],
  exposure: ["Well-lit, balanced composition", "Scene transition with high visual contrast", "Great exposure and framing"],
} as const;

function pickReason(motion: number, sharpness: number, exposure: number, seed: number): string {
  const top = motion >= sharpness && motion >= exposure ? "motion" : sharpness >= exposure ? "sharpness" : "exposure";
  const pool = REASONS[top];
  return pool[seed % pool.length];
}

function secondsToLabel(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Analyzes one uploaded video by sampling frames across its full length and
 * scoring each sample for motion, sharpness and exposure — then picks the
 * highest-scoring, well-separated moments as the "best moments" to cut into
 * the Reel. Runs entirely in the browser; nothing is uploaded to a server.
 */
export async function analyzeVideoMoments(
  file: File,
  sourceIndex: number,
  durationSeconds: number,
  onProgress?: (ratio: number) => void
): Promise<BestMoment[]> {
  const total = Math.max(durationSeconds, 1.5);
  const interval = Math.min(MAX_SAMPLE_INTERVAL, Math.max(MIN_SAMPLE_INTERVAL, total / MAX_SAMPLES_PER_VIDEO));
  const sampleTimes: number[] = [];
  for (let t = Math.min(0.15, total * 0.02); t < total; t += interval) sampleTimes.push(t);
  if (sampleTimes.length === 0) sampleTimes.push(0);

  const { video, url } = await loadVideo(file);
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

  const samples: FrameSample[] = [];
  let prevGray: Float32Array | null = null;

  try {
    for (let i = 0; i < sampleTimes.length; i++) {
      await seekTo(video, sampleTimes[i]);
      const { gray, brightness } = sampleFrame(video, ctx);
      const sharpness = sharpnessOf(gray);
      const motion = prevGray ? motionBetween(gray, prevGray) : 0;
      samples.push({ t: sampleTimes[i], brightness, sharpness, motion });
      prevGray = gray;
      onProgress?.((i + 1) / sampleTimes.length);
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  if (samples.length === 0) return [];

  const motionNorm = normalize(samples.map((s) => s.motion));
  const sharpnessNorm = normalize(samples.map((s) => s.sharpness));
  // Exposure "quality" peaks around mid-bright frames, penalizes near-black/blown-out ones.
  const exposureScore = samples.map((s) => 1 - Math.min(1, Math.abs(s.brightness - 0.55) / 0.55));

  const composite = samples.map((_, i) => 0.45 * motionNorm[i] + 0.35 * sharpnessNorm[i] + 0.2 * exposureScore[i]);
  // Light smoothing so a single noisy sample doesn't dominate the pick.
  const smoothed = composite.map((v, i) => {
    const prev = composite[i - 1] ?? v;
    const next = composite[i + 1] ?? v;
    return (prev + v * 2 + next) / 4;
  });

  const momentCount = Math.max(1, Math.min(4, Math.floor(total / 4)));
  const minGap = Math.max(1.5, total / (momentCount * 2.2));

  const ranked = smoothed.map((score, i) => ({ score, i })).sort((a, b) => b.score - a.score);

  const chosen: number[] = [];
  for (const { i } of ranked) {
    if (chosen.length >= momentCount) break;
    if (chosen.every((c) => Math.abs(samples[c].t - samples[i].t) >= minGap)) chosen.push(i);
  }
  chosen.sort((a, b) => samples[a].t - samples[b].t);

  return chosen.map((idx, order) => {
    const peakT = samples[idx].t;
    const length = Math.max(1.8, Math.min(4.5, 2.4 + smoothed[idx] * 2.2));
    const start = Math.max(0, Math.min(peakT - length * 0.35, total - length));
    const end = Math.min(total, start + length);
    return {
      id: `moment-${sourceIndex}-${order}-${Math.random().toString(36).slice(2, 7)}`,
      startSeconds: start,
      endSeconds: end,
      timestampLabel: `${secondsToLabel(start)} - ${secondsToLabel(end)}`,
      confidence: Math.round(62 + Math.min(1, smoothed[idx]) * 36),
      reason: pickReason(motionNorm[idx], sharpnessNorm[idx], exposureScore[idx], idx + order),
      sourceIndex,
    };
  });
}

/** Runs `analyzeVideoMoments` across all uploaded videos, aggregating overall progress. */
export async function analyzeAllVideos(
  videos: { file: File; durationSeconds: number }[],
  onProgress?: (ratio: number) => void
): Promise<BestMoment[]> {
  const perVideoWeight = 1 / videos.length;
  let acc = 0;
  const all: BestMoment[] = [];
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const moments = await analyzeVideoMoments(v.file, i, v.durationSeconds, (ratio) => {
      onProgress?.(acc + ratio * perVideoWeight);
    });
    acc += perVideoWeight;
    onProgress?.(acc);
    all.push(...moments);
  }
  return all;
}
