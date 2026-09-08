import { BestMoment } from "@/types";
import { DetectionFrameResult, fetchOptionalObjectDetections, scoreLandmarkFrame, scoreLocalSubjectFrame, scoreTargetSubjectFrame } from "@/lib/object-detection";
import { classifySceneOnFrame, detectFaceExpression, detectObjectsOnFrame, FaceExpressionResult, MlDetectedObject, SceneClassification } from "@/lib/ml-detection";

/**
 * Real, fully client-side "best moment" detection.
 *
 * Every sampled frame is scored on weighted signals, matching the product
 * spec's "Best Moment Score":
 *   30% Retention      — would a viewer keep watching (motion+sharpness combo, prominence of the spike)
 *   20% Motion          — frame-to-frame pixel difference
 *   20% Visual Impact    — color vividness (saturation) + local contrast
 *   10% Clarity          — gradient/edge sharpness (blurry/shaky frames score low)
 *   10% GPX Context      — route "dynamism" (heading changes / climbs) at the matching point of the track, if a GPX file was imported
 *   10% Emotion          — real smile/expression score from on-device face
 *                          landmark detection when a face is found in the
 *                          frame, falling back to a warm-tone/exposure proxy
 *                          otherwise (see `ml-detection.ts`)
 *   + target-subject boost from a real, on-device COCO-SSD object detector
 *     (person/vehicle/animal/etc. — see `LOCAL_SUBJECT_WEIGHTS` in
 *     `object-detection.ts`), merged with an optional remote/backend
 *     detector's result if `NEXT_PUBLIC_OBJECT_DETECTION_API_URL` is configured
 *   + landmark boost from a real, on-device MobileNet scene classifier —
 *     rewards frames containing a recognizable monument or dramatic scenic
 *     vista (castle, cliff, volcano, suspension bridge, etc. — see
 *     `LANDMARK_CLASS_WEIGHTS` in `object-detection.ts`), which COCO-SSD's
 *     80 everyday-object classes have no notion of
 *
 * The highest-scoring, well-separated peaks become the "best moments" that
 * get cut into the Reel — so the montage actually reflects each video's
 * content instead of picking evenly-spaced/random timestamps. The very
 * first chosen moment additionally rejects candidates that are too blurry
 * to be a good *opener* (see `MIN_OPENER_CLARITY`), even if their overall
 * score would otherwise win — an out-of-focus/shaky first frame is one of
 * the fastest ways to lose a viewer in the first second.
 *
 * ML DETECTION:
 * `ml-detection.ts` runs two real TensorFlow.js models per sampled frame —
 * COCO-SSD (general object detection) and MediaPipe FaceMesh (facial
 * landmarks, used to derive a genuine smile/expression score) — entirely
 * on-device via WebGL. Both are optional/best-effort: if a model fails to
 * load or a single prediction throws (slow device, no WebGL, offline with no
 * cached weights, etc.), the corresponding signal silently falls back to the
 * pre-existing pixel-only heuristic so analysis never breaks.
 *
 * FUTURE BACKEND INTEGRATION:
 * "Retention" is still a pixel-statistics proxy (motion+sharpness), since a
 * true "would a viewer keep watching" signal really needs learned
 * engagement data. A server-side pipeline (real shot/scene detection via
 * PySceneDetect, a larger YOLO model, or an aesthetic-quality model like
 * NIMA) would still improve on this further — the 6-factor weighted formula
 * and `BestMoment.scoreBreakdown` shape are designed to accept those richer
 * signals as drop-in replacements without changing anything downstream.
 */

const SAMPLE_W = 48;
const SAMPLE_H = 27;
/** Larger frame fed to the ML models (COCO-SSD / face landmarks) — the tiny 48x27 pixel-stats canvas is far too small for either model to see faces or object shapes reliably. */
const ML_SAMPLE_W = 320;
const ML_SAMPLE_H = 180;
const MAX_SAMPLES_PER_VIDEO = 36;
const MIN_SAMPLE_INTERVAL = 0.25;
const MAX_SAMPLE_INTERVAL = 1.4;
/** A sample below this normalized clarity is disqualified from being the very first ("opener") moment of a video — a soft/blurry/shaky first beat is one of the fastest ways to lose a viewer. */
const MIN_OPENER_CLARITY = 0.28;

interface FrameSample {
  t: number;
  brightness: number; // 0-1
  sharpness: number; // raw gradient energy, normalized later
  motion: number; // raw frame diff, normalized later
  saturation: number; // 0-1, average colorfulness — feeds "Visual Impact"
  contrast: number; // raw local luma stddev, normalized later — feeds "Visual Impact"
  warmth: number; // -1..1, red/orange bias vs. blue — weak "Emotion" proxy fallback
  subjectCenterBias: number; // 0-1, moving subject near center scores higher
  subjectCompactness: number; // 0-1, compact moving subject beats full-frame shake
  mlObjects: MlDetectedObject[] | null; // real COCO-SSD detections for this frame, null if the model was unavailable
  mlFace: FaceExpressionResult | null; // real face landmark result for this frame, null if the model was unavailable
  mlScene: SceneClassification[] | null; // real MobileNet scene classifications for this frame, null if the model was unavailable
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
    video.addEventListener(
      "error",
      () => {
        const me = video.error;
        const detail = me ? ` (MediaError code ${me.code}: ${me.message || "unknown"})` : "";
        URL.revokeObjectURL(url);
        reject(new Error(`Could not load video for analysis${detail}`));
      },
      { once: true }
    );
    // Explicitly trigger load (required in some browsers when the element is not attached to the DOM)
    video.load();
  });
}

/** Draws the current video frame onto a tiny canvas and returns grayscale pixel data + brightness/saturation/warmth. */
function sampleFrame(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D
): { gray: Float32Array; brightness: number; saturation: number; warmth: number } {
  ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
  const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
  const gray = new Float32Array(SAMPLE_W * SAMPLE_H);
  let sum = 0;
  let satSum = 0;
  let warmSum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gLuma = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    gray[p] = gLuma;
    sum += gLuma;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    satSum += max === 0 ? 0 : (max - min) / max; // 0-1 HSV-style saturation
    warmSum += (r - b) / 255; // -1..1, positive = warm (red/orange bias)
  }
  const n = gray.length;
  return { gray, brightness: sum / n, saturation: satSum / n, warmth: warmSum / n };
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

/** Local luma standard deviation — a cheap "local contrast" estimate that, combined with saturation, forms the "Visual Impact" signal. */
function contrastOf(gray: Float32Array): number {
  let mean = 0;
  for (let i = 0; i < gray.length; i++) mean += gray[i];
  mean /= gray.length;
  let variance = 0;
  for (let i = 0; i < gray.length; i++) variance += (gray[i] - mean) ** 2;
  return Math.sqrt(variance / gray.length);
}

function motionStatsBetween(a: Float32Array, b: Float32Array): { amount: number; subjectCenterBias: number; subjectCompactness: number } {
  let total = 0;
  let weightedX = 0;
  let weightedY = 0;
  let activeWeight = 0;
  let activePixels = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i]);
    total += diff;
    if (diff < 0.08) continue;
    const x = i % SAMPLE_W;
    const y = Math.floor(i / SAMPLE_W);
    activeWeight += diff;
    weightedX += x * diff;
    weightedY += y * diff;
    activePixels++;
  }
  if (activeWeight <= 1e-6) {
    return { amount: total / a.length, subjectCenterBias: 0.35, subjectCompactness: 0.35 };
  }
  const centerX = weightedX / activeWeight / Math.max(1, SAMPLE_W - 1);
  const centerY = weightedY / activeWeight / Math.max(1, SAMPLE_H - 1);
  const dx = Math.abs(centerX - 0.5) / 0.5;
  const dy = Math.abs(centerY - 0.45) / 0.55;
  const centerBias = Math.max(0, 1 - (dx * 0.55 + dy * 0.45));
  const activeFraction = activePixels / a.length;
  const compactness = Math.max(0, 1 - Math.min(1, Math.max(0, activeFraction - 0.04) / 0.22));
  return {
    amount: total / a.length,
    subjectCenterBias: centerBias,
    subjectCompactness: compactness,
  };
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range < 1e-6) return values.map(() => 0.5);
  return values.map((v) => (v - min) / range);
}

/**
 * Route "dynamism" at a given point 0-1 through a GPX track — turns
 * (heading change) and climbs both make for a more visually interesting
 * moment to cut to. This is a coarse proxy: it assumes video playback time
 * maps linearly onto the track's point order, which is the best we can do
 * without a real per-frame GPS/timestamp match (see `video-location-matcher.ts`
 * for the richer per-video matching used elsewhere in the app).
 */
function gpxDynamismAt(points: { lat: number; lng: number }[] | null | undefined, ratio: number): number {
  if (!points || points.length < 3) return 0.5;
  const idx = Math.min(points.length - 2, Math.max(1, Math.round(ratio * (points.length - 1))));
  const prev = points[idx - 1], cur = points[idx], next = points[idx + 1];
  const bearing = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.atan2(b.lng - a.lng, b.lat - a.lat);
  let turn = Math.abs(bearing(prev, cur) - bearing(cur, next));
  if (turn > Math.PI) turn = 2 * Math.PI - turn;
  return Math.min(1, turn / (Math.PI / 2)); // a ~90°+ turn already maxes this out
}

const REASONS = {
  motion: ["High motion + sharp focus detected", "Sudden speed or action spike", "Dynamic movement across the frame"],
  sharpness: ["Strong composition and lighting change", "Crisp, well-focused frame", "Detailed, high-clarity shot"],
  exposure: ["Well-lit, balanced composition", "Scene transition with high visual contrast", "Great exposure and framing"],
  visual: ["Vivid color and strong contrast", "Punchy, high-impact frame", "Eye-catching color pop"],
  gpx: ["Route turn / elevation change — scenic beat", "Matches a dynamic section of the GPX track"],
  subject: ["Main subject stays centered through the action", "The shot keeps the moving subject clearly in focus"],
  landmark: ["Recognizable landmark / scenic vista detected", "Strong scenery — a real landmark feature was spotted"],
} as const;

function pickReason(
  motion: number,
  sharpness: number,
  exposure: number,
  visualImpact: number,
  gpxContext: number,
  subjectFocus: number,
  landmarkScore: number,
  seed: number
): string {
  const scores = { motion, sharpness, exposure, visual: visualImpact, gpx: gpxContext, subject: subjectFocus, landmark: landmarkScore };
  const top = (Object.keys(scores) as (keyof typeof scores)[]).reduce((a, b) => (scores[b] > scores[a] ? b : a));
  const pool = REASONS[top];
  return pool[seed % pool.length];
}

function secondsToLabel(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function nearestDetectionFrame(frames: DetectionFrameResult[] | null, time: number): DetectionFrameResult | null {
  if (!frames || frames.length === 0) return null;
  let best = frames[0];
  let bestDistance = Math.abs(best.time - time);
  for (let i = 1; i < frames.length; i++) {
    const distance = Math.abs(frames[i].time - time);
    if (distance < bestDistance) {
      best = frames[i];
      bestDistance = distance;
    }
  }
  return best;
}

function momentLengthForScore(score: number) {
  return Math.max(3.6, Math.min(7.2, 4.4 + score * 2.8));
}

function overlapRatio(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  const minLen = Math.max(0.001, Math.min(aEnd - aStart, bEnd - bStart));
  return overlap / minLen;
}

/**
 * Analyzes one uploaded video by sampling frames across its full length and
 * scoring each sample with the weighted "Best Moment Score" (retention,
 * motion, visual impact, clarity, GPX context, emotion) — then picks the
 * highest-scoring, well-separated moments as the "best moments" to cut into
 * the Reel. Runs entirely in the browser; nothing is uploaded to a server.
 *
 * `gpxPoints` is optional — pass the imported route's points to let the GPX
 * Context signal contribute; omitted/empty, it falls back to a neutral 0.5.
 */
export async function analyzeVideoMoments(
  file: File,
  sourceIndex: number,
  durationSeconds: number,
  onProgress?: (ratio: number) => void,
  gpxPoints?: { lat: number; lng: number }[] | null,
  signal?: AbortSignal
): Promise<BestMoment[]> {
  const total = Math.max(durationSeconds, 1.5);
  const interval = Math.min(MAX_SAMPLE_INTERVAL, Math.max(MIN_SAMPLE_INTERVAL, total / MAX_SAMPLES_PER_VIDEO));
  const sampleTimes: number[] = [];
  for (let t = Math.min(0.15, total * 0.02); t < total; t += interval) sampleTimes.push(t);
  if (sampleTimes.length === 0) sampleTimes.push(0);
  const detectionFramesPromise = fetchOptionalObjectDetections(file, sampleTimes);

  const { video, url } = await loadVideo(file);
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

  // Separate, larger canvas for the ML models (COCO-SSD / face landmarks) —
  // they need to actually see object shapes and facial features, which the
  // tiny 48x27 pixel-stats canvas can't provide.
  const mlCanvas = document.createElement("canvas");
  mlCanvas.width = ML_SAMPLE_W;
  mlCanvas.height = ML_SAMPLE_H;
  const mlCtx = mlCanvas.getContext("2d") as CanvasRenderingContext2D;

  const samples: FrameSample[] = [];
  let prevGray: Float32Array | null = null;

  try {
    for (let i = 0; i < sampleTimes.length; i++) {
      // Bail out promptly once the caller has given up (e.g. the UI's
      // analysis timeout fired). Without this, an abandoned analysis kept
      // running in the background — still seeking/decoding/redrawing the
      // same video element — and could fight the subsequent render step for
      // CPU/memory/file-handle resources, which was a likely contributor to
      // sporadic "NotReadableError" failures when reading the source file
      // for the montage shortly after a timed-out analysis.
      if (signal?.aborted) break;
      await seekTo(video, sampleTimes[i]);
      const { gray, brightness, saturation, warmth } = sampleFrame(video, ctx);
      const sharpness = sharpnessOf(gray);
      const contrast = contrastOf(gray);
      const motionStats = prevGray
        ? motionStatsBetween(gray, prevGray)
        : { amount: 0, subjectCenterBias: 0.35, subjectCompactness: 0.35 };

      mlCtx.drawImage(video, 0, 0, ML_SAMPLE_W, ML_SAMPLE_H);
      const [mlObjects, mlFace, mlScene] = await Promise.all([
        detectObjectsOnFrame(mlCanvas, ML_SAMPLE_W, ML_SAMPLE_H),
        detectFaceExpression(mlCanvas, ML_SAMPLE_W, ML_SAMPLE_H),
        classifySceneOnFrame(mlCanvas),
      ]);

      samples.push({
        t: sampleTimes[i],
        brightness,
        sharpness,
        motion: motionStats.amount,
        saturation,
        contrast,
        warmth,
        subjectCenterBias: motionStats.subjectCenterBias,
        subjectCompactness: motionStats.subjectCompactness,
        mlObjects,
        mlFace,
        mlScene,
      });
      prevGray = gray;
      onProgress?.((i + 1) / sampleTimes.length);
    }
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }

  if (samples.length === 0) return [];

  const motionNorm = normalize(samples.map((s) => s.motion));
  const sharpnessNorm = normalize(samples.map((s) => s.sharpness)); // "Clarity"
  const contrastNorm = normalize(samples.map((s) => s.contrast));
  const saturationNorm = normalize(samples.map((s) => s.saturation));
  // Exposure "quality" peaks around mid-bright frames, penalizes near-black/blown-out ones.
  const exposureScore = samples.map((s) => 1 - Math.min(1, Math.abs(s.brightness - 0.55) / 0.55));
  // "Visual Impact" = how punchy/vivid the frame reads (saturation + local contrast).
  const visualImpact = samples.map((_, i) => 0.55 * saturationNorm[i] + 0.45 * contrastNorm[i]);
  // "GPX Context" = route dynamism at the point of the track this timestamp's ratio-through-the-video maps to.
  const gpxContext = samples.map((s) => gpxDynamismAt(gpxPoints, s.t / total));
  // "Emotion" — real signal when a face was detected on-device (genuine smile/expression
  // geometry from face landmarks), falling back to the warm-tone/exposure proxy otherwise.
  const emotionFallback = samples.map((s, i) => 0.6 * Math.max(0, Math.min(1, (s.warmth + 0.15) / 0.3)) + 0.4 * exposureScore[i]);
  const emotion = samples.map((s, i) => (s.mlFace?.present ? 0.75 * s.mlFace.smileScore + 0.25 * emotionFallback[i] : emotionFallback[i]));
  const detectionFrames = await detectionFramesPromise;
  const targetSubjectDetections = samples.map((s) => {
    // Merge the optional remote/backend detector (motorcycle/car only, if configured)
    // with the real on-device COCO-SSD detections (80 classes) — take whichever
    // scores higher for this frame.
    const remote = scoreTargetSubjectFrame(nearestDetectionFrame(detectionFrames, s.t));
    const local = s.mlObjects ? scoreLocalSubjectFrame(s.mlObjects) : { score: 0, topLabel: null };
    return local.score >= remote.score ? local : remote;
  });
  // "Landmark" — real MobileNet scene classification boost for frames containing a
  // recognizable monument/dramatic terrain feature (castle, cliff, volcano, etc.),
  // which COCO-SSD has no classes for at all. 0 when no landmark keyword matched.
  const landmarkDetections = samples.map((s) => scoreLandmarkFrame(s.mlScene));
  // "Subject Focus" — compact moving subject near the frame center. In riding footage this
  // tends to favor the bike/rider staying tracked cleanly over generic whole-frame shake.
  const subjectFocus = samples.map((s, i) => {
    const heuristicFocus = motionNorm[i] * (0.58 * s.subjectCenterBias + 0.42 * s.subjectCompactness);
    const detectedFocus = targetSubjectDetections[i].score;
    return detectedFocus > 0 ? Math.max(heuristicFocus, heuristicFocus * 0.55 + detectedFocus * 0.7) : heuristicFocus;
  });
  // "Retention" — proxy for "would a viewer keep watching": a blend of motion + clarity, since a sharp frame with
  // real movement is what tends to hold attention (a static blurry frame is the opposite).
  const retention = samples.map((_, i) => 0.42 * motionNorm[i] + 0.33 * sharpnessNorm[i] + 0.25 * subjectFocus[i]);
  // Landmark presence folds into the "visual" pillar (rather than adding a new top-level
  // weight) so a well-framed scenic monument reads as extra visual impact, same spirit as
  // how a well-tracked subject already boosts this score.
  const visualWithSubject = samples.map(
    (_, i) => 0.6 * visualImpact[i] + 0.22 * subjectFocus[i] + 0.18 * landmarkDetections[i].score
  );

  const composite = samples.map(
    (_, i) =>
      0.25 * retention[i] +
      0.16 * motionNorm[i] +
      0.18 * visualWithSubject[i] +
      0.1 * sharpnessNorm[i] +
      0.08 * gpxContext[i] +
      0.08 * emotion[i] +
      0.15 * subjectFocus[i]
  );
  // Light smoothing so a single noisy sample doesn't dominate the pick.
  const smoothed = composite.map((v, i) => {
    const prev = composite[i - 1] ?? v;
    const next = composite[i + 1] ?? v;
    return (prev + v * 2 + next) / 4;
  });

  // Cap scales with how much footage there actually is, so a single long
  // clip can still supply enough distinct moments to build a fuller,
  // closer-to-Instagram's-max-length Reel instead of always topping out at
  // a handful of moments regardless of source length.
  const momentCount = Math.max(1, Math.min(14, Math.floor(total / 3)));
  const minGap = Math.max(2.6, total / (momentCount * 2.2));

  const ranked = smoothed.map((score, i) => ({ score, i })).sort((a, b) => b.score - a.score);

  const chosen: number[] = [];
  for (const { i } of ranked) {
    if (chosen.length >= momentCount) break;
    // The very first pick doubles as this video's opener — reject an
    // otherwise-high-scoring but too-soft/blurry candidate for that slot so
    // a shaky/out-of-focus frame never opens the Reel.
    if (chosen.length === 0 && sharpnessNorm[i] < MIN_OPENER_CLARITY && ranked.some((r) => sharpnessNorm[r.i] >= MIN_OPENER_CLARITY)) {
      continue;
    }
    const candidateLength = momentLengthForScore(smoothed[i]);
    const candidateStart = Math.max(0, Math.min(samples[i].t - candidateLength * 0.35, total - candidateLength));
    const candidateEnd = Math.min(total, candidateStart + candidateLength);
    if (
      chosen.every((c) => Math.abs(samples[c].t - samples[i].t) >= minGap) &&
      chosen.every((c) => {
        const existingLength = momentLengthForScore(smoothed[c]);
        const existingStart = Math.max(0, Math.min(samples[c].t - existingLength * 0.35, total - existingLength));
        const existingEnd = Math.min(total, existingStart + existingLength);
        return (
          (Math.abs(samples[c].t - samples[i].t) >= 1.4 || Math.abs(samples[c].t - samples[i].t) / total > 0.14) &&
          overlapRatio(candidateStart, candidateEnd, existingStart, existingEnd) < 0.24
        );
      })
    ) {
      chosen.push(i);
    }
  }
  chosen.sort((a, b) => samples[a].t - samples[b].t);

  return chosen.map((idx, order) => {
    const peakT = samples[idx].t;
    const length = momentLengthForScore(smoothed[idx]);
    const start = Math.max(0, Math.min(peakT - length * 0.35, total - length));
    const end = Math.min(total, start + length);
    return {
      id: `moment-${sourceIndex}-${order}-${Math.random().toString(36).slice(2, 7)}`,
      startSeconds: start,
      endSeconds: end,
      timestampLabel: `${secondsToLabel(start)} - ${secondsToLabel(end)}`,
      confidence: Math.round(62 + Math.min(1, smoothed[idx]) * 36),
      reason:
        targetSubjectDetections[idx].score >= 0.55 && targetSubjectDetections[idx].topLabel
          ? `Tracking detected ${targetSubjectDetections[idx].topLabel} through the frame`
          : landmarkDetections[idx].score >= 0.45 && landmarkDetections[idx].topLabel
            ? `Landmark detected: ${landmarkDetections[idx].topLabel}`
            : pickReason(
                motionNorm[idx],
                sharpnessNorm[idx],
                exposureScore[idx],
                visualWithSubject[idx],
                gpxContext[idx],
                subjectFocus[idx],
                landmarkDetections[idx].score,
                idx + order
              ),
      sourceIndex,
      scoreBreakdown: {
        retention: retention[idx],
        motion: motionNorm[idx],
        visualImpact: visualWithSubject[idx],
        clarity: sharpnessNorm[idx],
        gpxContext: gpxContext[idx],
        emotion: emotion[idx],
        subjectFocus: subjectFocus[idx],
        targetSubject: targetSubjectDetections[idx].score,
        landmark: landmarkDetections[idx].score,
      },
    };
  });
}

/** Runs `analyzeVideoMoments` across all uploaded videos, aggregating overall progress. */
export async function analyzeAllVideos(
  videos: { file: File; durationSeconds: number }[],
  onProgress?: (ratio: number) => void,
  gpxPoints?: { lat: number; lng: number }[] | null,
  signal?: AbortSignal
): Promise<BestMoment[]> {
  if (videos.length === 0) return [];
  const progressByVideo = new Array(videos.length).fill(0);
  const momentGroups = await Promise.all(
    videos.map((v, i) =>
      analyzeVideoMoments(
        v.file,
        i,
        v.durationSeconds,
        (ratio) => {
          progressByVideo[i] = ratio;
          onProgress?.(progressByVideo.reduce((sum, value) => sum + value, 0) / videos.length);
        },
        gpxPoints,
        signal
      )
    )
  );
  onProgress?.(1);
  return momentGroups.flat();
}
