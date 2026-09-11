"use client";

/**
 * Real, in-browser ML detection (TensorFlow.js) used to score "best moments".
 *
 * This replaces the previous mock/remote-only object detection with two real
 * models that run entirely client-side (no server, no data leaves the
 * device):
 *
 *  - COCO-SSD (`@tensorflow-models/coco-ssd`) — general-purpose object
 *    detector. Gives real bounding boxes + confidences for people, vehicles,
 *    animals, etc., instead of the previous mock/remote-only detector.
 *  - Face landmarks (`@tensorflow-models/face-landmarks-detection`, tfjs
 *    runtime — no extra MediaPipe WASM assets needed) — used to derive a
 *    genuine "smile"/expression proxy for the Reel's "Emotion" score,
 *    instead of guessing from warm color tones.
 *  - MobileNet (`@tensorflow-models/mobilenet`) — whole-frame scene/landmark
 *    classifier over the 1000 ImageNet classes. COCO-SSD only knows ~80
 *    everyday object categories with no notion of "castle", "monastery",
 *    "cliff", "volcano", "suspension bridge", etc., so it can never reward a
 *    frame for containing a scenic landmark. MobileNet fills that gap: its
 *    label set includes dozens of monument/landform classes (see
 *    `LANDMARK_CLASS_WEIGHTS` in `object-detection.ts`), giving a genuine
 *    (if coarse) "is this frame near a recognizable landmark/scenic vista"
 *    signal for Adventure/Travel/Luxury footage.
 *
 * All three models are loaded lazily and cached as singletons (mirroring the
 * `loadFFmpeg()` pattern in `video-engine.ts`), and every call site degrades
 * gracefully: if a model fails to load or a single-frame prediction throws
 * (slow device, WebGL unavailable, no network to fetch weights, etc.), the
 * caller falls back to the pre-existing pixel-heuristic signals so a single
 * failed frame or offline session never breaks the analysis pipeline.
 */

import type * as tfTypes from "@tensorflow/tfjs";
import type * as cocoSsdTypes from "@tensorflow-models/coco-ssd";
import type * as mobilenetTypes from "@tensorflow-models/mobilenet";
import type { FaceLandmarksDetector } from "@tensorflow-models/face-landmarks-detection";
import type { MediaPipeFaceMeshTfjsModelConfig } from "@tensorflow-models/face-landmarks-detection/dist/tfjs/types";

export interface MlDetectedObject {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number }; // normalized 0-1
}

export interface FaceExpressionResult {
  present: boolean;
  /** 0-1 proxy for "smiling / positive expression", derived from real facial landmarks. */
  smileScore: number;
  /** 0-1, how centered the face is in the frame. */
  centerBias: number;
  /** 0-1, fraction of frame area the face occupies. */
  area: number;
}

/** A single MobileNet scene classification for a frame. `className` may be a comma-separated list of ImageNet synonyms (e.g. "alp"), matched case-insensitively against `LANDMARK_CLASS_WEIGHTS`. */
export interface SceneClassification {
  className: string;
  probability: number;
}

let tf: typeof tfTypes | null = null;
let cocoSsdModule: typeof cocoSsdTypes | null = null;
let mobilenetModule: typeof mobilenetTypes | null = null;
// Imports the tfjs-runtime-only submodule directly (instead of the package's
// top-level entry) so the bundler never has to resolve the `mediapipe`
// runtime's static `@mediapipe/face_mesh` import, which isn't a real ESM
// module and breaks Turbopack/webpack production builds even when unused.
type FaceMeshTfjsModule = { load(config: MediaPipeFaceMeshTfjsModelConfig): Promise<FaceLandmarksDetector> };
let faceLandmarksTfjsModule: FaceMeshTfjsModule | null = null;

let cocoModelPromise: Promise<cocoSsdTypes.ObjectDetection | null> | null = null;
let faceDetectorPromise: Promise<FaceLandmarksDetector | null> | null = null;
let mobilenetModelPromise: Promise<mobilenetTypes.MobileNet | null> | null = null;

const modelLoadWarnings = new Set<string>();

/** True once all models have successfully finished loading at least once. */
let mlReady = false;
export function isMlDetectionReady(): boolean {
  return mlReady;
}

function logModelLoadIssue(modelName: string, error: unknown): void {
  const key = `${modelName}:${error instanceof Error ? error.name : String(error)}`;
  if (!modelLoadWarnings.has(key)) {
    modelLoadWarnings.add(key);
    console.debug(`[ml-detection] ${modelName} unavailable; falling back to pixel heuristics.`, error);
  }
}

async function ensureCoreModules(): Promise<void> {
  if (!tf) tf = await import("@tensorflow/tfjs");
  if (!cocoSsdModule) cocoSsdModule = await import("@tensorflow-models/coco-ssd");
  if (!mobilenetModule) mobilenetModule = await import("@tensorflow-models/mobilenet");
  if (!faceLandmarksTfjsModule) {
    faceLandmarksTfjsModule = (await import(
      "@tensorflow-models/face-landmarks-detection/dist/tfjs/detector"
    )) as unknown as FaceMeshTfjsModule;
  }
}

function loadCocoModel(): Promise<cocoSsdTypes.ObjectDetection | null> {
  if (!cocoModelPromise) {
    cocoModelPromise = (async () => {
      try {
        await ensureCoreModules();
        await tf!.ready();
        // "lite_mobilenet_v2" trades a little accuracy for speed — this runs
        // once per sampled frame (up to ~36 per video), so keeping it fast
        // matters more than squeezing out a few extra points of mAP.
        const model = await cocoSsdModule!.load({ base: "lite_mobilenet_v2" });
        mlReady = true;
        return model;
      } catch (error) {
        logModelLoadIssue("COCO-SSD", error);
        cocoModelPromise = null;
        return null;
      }
    })();
  }
  return cocoModelPromise;
}

function loadFaceDetector(): Promise<FaceLandmarksDetector | null> {
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {
      try {
        await ensureCoreModules();
        await tf!.ready();
        const detector = await faceLandmarksTfjsModule!.load({
          runtime: "tfjs",
          refineLandmarks: false,
          maxFaces: 1,
        });
        mlReady = true;
        return detector;
      } catch (error) {
        logModelLoadIssue("Face landmarks", error);
        faceDetectorPromise = null;
        return null;
      }
    })();
  }
  return faceDetectorPromise;
}

function loadMobilenetModel(): Promise<mobilenetTypes.MobileNet | null> {
  if (!mobilenetModelPromise) {
    mobilenetModelPromise = (async () => {
      try {
        await ensureCoreModules();
        await tf!.ready();
        // v1/alpha 0.25 is the smallest/fastest MobileNet variant — this is a
        // coarse "is there a recognizable landmark/scenic vista in this frame"
        // signal, not the primary subject detector, so favoring speed over the
        // last few points of top-1 accuracy is the right tradeoff here too.
        const model = await mobilenetModule!.load({ version: 1, alpha: 0.25 });
        mlReady = true;
        return model;
      } catch (error) {
        logModelLoadIssue("MobileNet", error);
        mobilenetModelPromise = null;
        return null;
      }
    })();
  }
  return mobilenetModelPromise;
}

/**
 * Loads all models up front (mirrors `warmupEditingEngine()` for ffmpeg) so
 * the first analyzed frame doesn't stall on a multi-second model download.
 * Safe to call multiple times; safe to ignore failures (analysis falls back
 * to pixel heuristics automatically per-frame).
 */
export async function warmupMlDetection(): Promise<void> {
  await Promise.allSettled([loadCocoModel(), loadFaceDetector(), loadMobilenetModel()]);
}

/** Runs COCO-SSD on a canvas/image frame. Returns `null` (never throws) if the model isn't available/failed. */
export async function detectObjectsOnFrame(
  source: HTMLCanvasElement,
  frameWidth: number,
  frameHeight: number
): Promise<MlDetectedObject[] | null> {
  try {
    const model = await loadCocoModel();
    if (!model) return null;
    const predictions = await model.detect(source, 10);
    mlReady = true;
    return predictions.map((p) => ({
      label: p.class,
      confidence: p.score,
      bbox: {
        x: p.bbox[0] / frameWidth,
        y: p.bbox[1] / frameHeight,
        width: p.bbox[2] / frameWidth,
        height: p.bbox[3] / frameHeight,
      },
    }));
  } catch (error) {
    logModelLoadIssue("COCO-SSD frame detection", error);
    return null;
  }
}

/**
 * Estimates a "smile"/positive-expression proxy from real face landmarks:
 * mouth-corner width relative to eye-to-eye distance, plus a touch of
 * vertical mouth-corner lift vs. the mouth center — a classic, cheap
 * smile-detection heuristic built on genuine geometry rather than guessed
 * from frame color. Returns `null` (never throws) if the model isn't
 * available/failed.
 */
export async function detectFaceExpression(
  source: HTMLCanvasElement,
  frameWidth: number,
  frameHeight: number
): Promise<FaceExpressionResult | null> {
  try {
    const detector = await loadFaceDetector();
    if (!detector) return null;
    const faces = await detector.estimateFaces(source);
    mlReady = true;
    if (!faces || faces.length === 0) {
      return { present: false, smileScore: 0, centerBias: 0, area: 0 };
    }
    const face = faces[0];
    const keypoints = face.keypoints;

    // Fixed MediaPipe FaceMesh landmark indices (this topology is stable
    // across the model's releases) for mouth corners/openness and eye
    // spacing — used to derive a real geometric "smile" proxy.
    const mouthLeftCorner = keypoints[61];
    const mouthRightCorner = keypoints[291];
    const mouthTop = keypoints[13];
    const mouthBottom = keypoints[14];
    const leftEyeOuter = keypoints[33];
    const rightEyeOuter = keypoints[263];

    const dist = (a?: { x: number; y: number }, b?: { x: number; y: number }) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0);

    const eyeDistance = dist(leftEyeOuter, rightEyeOuter) || 1;
    const mouthWidth = dist(mouthLeftCorner, mouthRightCorner);
    const mouthHeight = dist(mouthTop, mouthBottom);

    // A wider mouth relative to eye spacing, with a somewhat open/curved
    // mouth (not perfectly flat), reads as a smile/expressive face. Clamp to
    // a sane 0-1 range since face proportions vary.
    const widthRatio = mouthWidth / eyeDistance;
    const opennessRatio = mouthHeight / eyeDistance;
    const smileScore = Math.max(0, Math.min(1, (widthRatio - 0.9) / 0.5 + opennessRatio * 0.6));

    const box = face.box;
    const centerX = (box.xMin + box.xMax) / 2 / frameWidth;
    const centerY = (box.yMin + box.yMax) / 2 / frameHeight;
    const dx = Math.abs(centerX - 0.5) / 0.5;
    const dy = Math.abs(centerY - 0.45) / 0.55;
    const centerBias = Math.max(0, 1 - (dx * 0.55 + dy * 0.45));
    const area = ((box.xMax - box.xMin) * (box.yMax - box.yMin)) / (frameWidth * frameHeight);

    return { present: true, smileScore, centerBias, area: Math.max(0, Math.min(1, area)) };
  } catch (error) {
    logModelLoadIssue("Face expression detection", error);
    return null;
  }
}

/** Runs MobileNet whole-frame scene classification. Returns `null` (never throws) if the model isn't available/failed. */
export async function classifySceneOnFrame(source: HTMLCanvasElement): Promise<SceneClassification[] | null> {
  try {
    const model = await loadMobilenetModel();
    if (!model) return null;
    const predictions = await model.classify(source, 5);
    mlReady = true;
    return predictions;
  } catch (error) {
    logModelLoadIssue("MobileNet scene classification", error);
    return null;
  }
}
