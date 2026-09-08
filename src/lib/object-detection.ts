const TARGET_LABELS = ["motorcycle", "car"] as const;
type TargetLabel = (typeof TARGET_LABELS)[number];

/**
 * Broader label set scored for the local, in-browser COCO-SSD detector (see
 * `ml-detection.ts`). Unlike the narrow `TARGET_LABELS` above — which is the
 * external/remote backend's contract (motorcycle/car only) — COCO-SSD
 * recognizes 80 general classes, so this weights every class that's a
 * plausible "main subject" for adventure/travel/action footage. Higher
 * weight = more likely to be the intentional subject of the shot.
 */
const LOCAL_SUBJECT_WEIGHTS: Record<string, number> = {
  motorcycle: 1,
  car: 0.82,
  bicycle: 0.8,
  person: 0.75,
  truck: 0.68,
  bus: 0.6,
  boat: 0.72,
  train: 0.55,
  dog: 0.6,
  horse: 0.65,
  "surfboard": 0.7,
  "skis": 0.7,
  "snowboard": 0.7,
  "kite": 0.55,
};

/**
 * Landmark/scenic-vista keywords scored against MobileNet's whole-frame
 * ImageNet classification (see `classifySceneOnFrame` in `ml-detection.ts`).
 * COCO-SSD has no concept of "castle" or "cliff" — it only knows ~80 everyday
 * object categories — so this is what actually lets the analyzer reward a
 * frame for containing a recognizable monument or dramatic terrain feature,
 * which matters a lot for Adventure/Travel/Luxury footage.
 *
 * Matching is substring-based against the lowercased, comma-joined
 * `className` MobileNet returns (e.g. "cliff, drop, drop-off" or "alp"),
 * since real ImageNet labels are frequently several comma-separated synonyms
 * for the same class. Higher weight = more distinctive/scenic a landmark
 * this class represents.
 */
const LANDMARK_CLASS_WEIGHTS: Record<string, number> = {
  // Man-made monuments / landmark architecture
  castle: 1,
  palace: 0.95,
  monastery: 0.9,
  "triumphal arch": 1,
  "steel arch bridge": 0.85,
  megalith: 0.95,
  obelisk: 0.95,
  stupa: 0.9,
  dome: 0.8,
  mosque: 0.9,
  church: 0.75,
  "bell cote": 0.7,
  lighthouse: 0.85,
  "suspension bridge": 0.85,
  viaduct: 0.75,
  "cliff dwelling": 0.85,
  boathouse: 0.5,
  // Dramatic / scenic terrain (mountains, coasts, water features)
  alp: 0.9,
  cliff: 0.85,
  volcano: 0.95,
  valley: 0.7,
  promontory: 0.8,
  geyser: 0.85,
  lakeside: 0.7,
  seashore: 0.75,
  sandbar: 0.6,
  "coral reef": 0.8,
};

const LANDMARK_ENTRIES = Object.entries(LANDMARK_CLASS_WEIGHTS);

export interface DetectionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: DetectionBoundingBox | null;
}

export interface DetectionFrameResult {
  time: number;
  detections: DetectedObject[];
}

export interface TargetSubjectFrameScore {
  score: number;
  topLabel: TargetLabel | null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function normalizeLabel(label: string): TargetLabel | null {
  const normalized = label.trim().toLowerCase();
  if (normalized === "motorcycle" || normalized === "motorbike") return "motorcycle";
  if (normalized === "car" || normalized === "automobile") return "car";
  return null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function scoreFramedDetection(bbox: DetectionBoundingBox | null | undefined, confidence: number, classWeight: number): number {
  if (!bbox) return confidence * classWeight;
  const centerX = clamp01(bbox.x + bbox.width / 2);
  const centerY = clamp01(bbox.y + bbox.height / 2);
  const dx = Math.abs(centerX - 0.5) / 0.5;
  const dy = Math.abs(centerY - 0.46) / 0.54;
  const centerScore = Math.max(0, 1 - (dx * 0.58 + dy * 0.42));
  const areaScore = clamp01((bbox.width * bbox.height) / 0.2);
  const framedScore = 0.45 * centerScore + 0.25 * areaScore + 0.3 * confidence;
  return framedScore * classWeight;
}

function scoreDetection(detection: DetectedObject): TargetSubjectFrameScore {
  const label = normalizeLabel(detection.label);
  if (!label) return { score: 0, topLabel: null };
  const classWeight = label === "motorcycle" ? 1 : 0.82;
  const confidence = clamp01(detection.confidence);
  return { score: scoreFramedDetection(detection.bbox, confidence, classWeight), topLabel: label };
}

/**
 * Same "is this a well-framed main subject" scoring as `scoreDetection`, but
 * over the full 80-class COCO-SSD label set (see `LOCAL_SUBJECT_WEIGHTS`)
 * rather than only motorcycle/car — used for the local, in-browser detector.
 * `topLabel` is returned as a free-form string (not restricted to `TargetLabel`)
 * since COCO-SSD can report any of its 80 classes.
 */
export function scoreLocalSubjectFrame(detections: DetectedObject[]): { score: number; topLabel: string | null } {
  let best = { score: 0, topLabel: null as string | null };
  for (const detection of detections) {
    const label = detection.label.trim().toLowerCase();
    const weight = LOCAL_SUBJECT_WEIGHTS[label];
    if (!weight) continue;
    const score = scoreFramedDetection(detection.bbox, clamp01(detection.confidence), weight);
    if (score > best.score) best = { score, topLabel: label };
  }
  return best;
}

/**
 * Scores a frame's MobileNet whole-frame scene classifications against
 * `LANDMARK_CLASS_WEIGHTS` — a real (if coarse) "does this frame show a
 * recognizable monument or dramatic scenic vista" signal, unlike
 * `scoreLocalSubjectFrame` which only knows everyday COCO-SSD objects. Since
 * this is a whole-frame classification (no bounding box), the model's own
 * `probability` stands in for "how confidently framed" the landmark is —
 * there's no bbox to score centering/area against.
 */
export function scoreLandmarkFrame(predictions: { className: string; probability: number }[] | null | undefined): {
  score: number;
  topLabel: string | null;
} {
  let best = { score: 0, topLabel: null as string | null };
  if (!predictions) return best;
  for (const prediction of predictions) {
    const className = prediction.className.trim().toLowerCase();
    for (const [keyword, weight] of LANDMARK_ENTRIES) {
      if (!className.includes(keyword)) continue;
      const score = clamp01(prediction.probability) * weight;
      if (score > best.score) best = { score, topLabel: keyword };
      break; // first (highest-weighted-iteration-order) keyword match wins for this prediction
    }
  }
  return best;
}

function parseFrames(payload: unknown): DetectionFrameResult[] | null {
  if (!payload || typeof payload !== "object") return null;
  const frames = (payload as { frames?: unknown }).frames;
  if (!Array.isArray(frames)) return null;
  const parsed: DetectionFrameResult[] = [];
  for (const frame of frames) {
    if (!frame || typeof frame !== "object") continue;
    const time = Number((frame as { time?: unknown }).time);
    const detectionsRaw = (frame as { detections?: unknown }).detections;
    if (!Number.isFinite(time) || !Array.isArray(detectionsRaw)) continue;
    const detections: DetectedObject[] = detectionsRaw
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      .map((entry) => ({
        label: typeof entry.label === "string" ? entry.label : "",
        confidence: Number(entry.confidence ?? 0),
        bbox:
          entry.bbox && typeof entry.bbox === "object"
            ? {
                x: Number((entry.bbox as Record<string, unknown>).x ?? 0),
                y: Number((entry.bbox as Record<string, unknown>).y ?? 0),
                width: Number((entry.bbox as Record<string, unknown>).width ?? 0),
                height: Number((entry.bbox as Record<string, unknown>).height ?? 0),
              }
            : null,
      }))
      .filter((entry) => entry.label.length > 0 && Number.isFinite(entry.confidence));
    parsed.push({ time, detections });
  }
  return parsed.length > 0 ? parsed : null;
}

export async function fetchOptionalObjectDetections(file: File, sampleTimes: number[]): Promise<DetectionFrameResult[] | null> {
  const endpoint = process.env.NEXT_PUBLIC_OBJECT_DETECTION_API_URL?.trim();
  if (!endpoint || sampleTimes.length === 0) return null;

  const body = new FormData();
  body.append("video", file, file.name);
  body.append("sampleTimes", JSON.stringify(sampleTimes));
  body.append("targetLabels", JSON.stringify(TARGET_LABELS));

  try {
    const response = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        body,
      }),
      4500
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    return parseFrames(payload);
  } catch {
    return null;
  }
}

export function scoreTargetSubjectFrame(frame: DetectionFrameResult | null | undefined): TargetSubjectFrameScore {
  if (!frame || frame.detections.length === 0) return { score: 0, topLabel: null };
  let best: TargetSubjectFrameScore = { score: 0, topLabel: null };
  for (const detection of frame.detections) {
    const scored = scoreDetection(detection);
    if (scored.score > best.score) best = scored;
  }
  return best;
}
