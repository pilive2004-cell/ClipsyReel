import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } });
const app = express();

type TargetLabel = "motorcycle" | "car";

interface DetectionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: DetectionBoundingBox | null;
}

interface FrameDetectionResult {
  time: number;
  detections: DetectedObject[];
}

interface DetectionProvider {
  detect(image: Buffer, targetLabels: TargetLabel[], frameIndex: number, time: number): Promise<DetectedObject[]>;
}

function parseTargetLabel(value: string): TargetLabel | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "motorcycle" || normalized === "motorbike") return "motorcycle";
  if (normalized === "car" || normalized === "automobile") return "car";
  return null;
}

function parseJsonArray(input: unknown, fieldName: string): unknown[] {
  if (typeof input !== "string") {
    throw new Error(`${fieldName} must be a JSON string array.`);
  }
  const parsed = JSON.parse(input) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} must decode to an array.`);
  }
  return parsed;
}

function parseSampleTimes(input: unknown): number[] {
  const raw = parseJsonArray(input, "sampleTimes");
  const sampleTimes = raw.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0);
  if (sampleTimes.length === 0) {
    throw new Error("sampleTimes must contain at least one non-negative number.");
  }
  return sampleTimes;
}

function parseTargetLabels(input: unknown): TargetLabel[] {
  const raw = parseJsonArray(input, "targetLabels");
  const labels = raw
    .map((value) => (typeof value === "string" ? parseTargetLabel(value) : null))
    .filter((value): value is TargetLabel => value !== null);
  return labels.length > 0 ? Array.from(new Set(labels)) : ["motorcycle", "car"];
}

function downsampleSampleTimes(sampleTimes: number[], maxFrames: number): number[] {
  if (sampleTimes.length <= maxFrames) return sampleTimes;
  const lastIndex = sampleTimes.length - 1;
  const selected = new Set<number>([0, lastIndex]);
  while (selected.size < maxFrames) {
    const ratio = selected.size / Math.max(1, maxFrames - 1);
    selected.add(Math.round(ratio * lastIndex));
  }
  return Array.from(selected)
    .sort((a, b) => a - b)
    .map((index) => sampleTimes[index]);
}

class MockVehicleDetectionProvider implements DetectionProvider {
  async detect(_image: Buffer, targetLabels: TargetLabel[], frameIndex: number): Promise<DetectedObject[]> {
    const label = targetLabels[frameIndex % targetLabels.length] ?? "motorcycle";
    const confidence = label === "motorcycle" ? 0.86 : 0.79;
    return [
      {
        label,
        confidence,
        bbox: {
          x: 0.34 + (frameIndex % 3) * 0.03,
          y: 0.29,
          width: 0.24,
          height: 0.19,
        },
      },
    ];
  }
}

class HttpDetectionProvider implements DetectionProvider {
  private readonly url: string;
  private readonly token: string | null;

  constructor(url: string, token: string | null) {
    this.url = url;
    this.token = token;
  }

  async detect(image: Buffer, targetLabels: TargetLabel[], _frameIndex: number, time: number): Promise<DetectedObject[]> {
    const body = new FormData();
    body.append("image", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), `frame-${time.toFixed(2)}.jpg`);
    body.append("targetLabels", JSON.stringify(targetLabels));

    const response = await fetch(this.url, {
      method: "POST",
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
      body,
    });
    if (!response.ok) {
      throw new Error(`Remote detector returned ${response.status}.`);
    }
    const payload = (await response.json()) as unknown;
    const detections = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { detections?: unknown }).detections)
        ? (payload as { detections: unknown[] }).detections
        : null;
    if (!detections) {
      throw new Error("Remote detector response must be an array or { detections: [] }.");
    }
    return detections
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      .map((entry) => {
        const bboxInput = entry.bbox;
        const bbox =
          bboxInput && typeof bboxInput === "object"
            ? {
                x: Number((bboxInput as Record<string, unknown>).x ?? 0),
                y: Number((bboxInput as Record<string, unknown>).y ?? 0),
                width: Number((bboxInput as Record<string, unknown>).width ?? 0),
                height: Number((bboxInput as Record<string, unknown>).height ?? 0),
              }
            : null;
        return {
          label: typeof entry.label === "string" ? entry.label : "",
          confidence: Number(entry.confidence ?? 0),
          bbox,
        };
      })
      .filter((entry) => entry.label.length > 0 && Number.isFinite(entry.confidence));
  }
}

function createProvider(): DetectionProvider {
  const provider = (process.env.OBJECT_DETECTION_PROVIDER ?? "mock").trim().toLowerCase();
  if (provider === "mock") return new MockVehicleDetectionProvider();
  if (provider === "http") {
    const url = process.env.OBJECT_DETECTION_REMOTE_URL?.trim();
    if (!url) {
      throw new Error("OBJECT_DETECTION_REMOTE_URL is required when OBJECT_DETECTION_PROVIDER=http.");
    }
    return new HttpDetectionProvider(url, process.env.OBJECT_DETECTION_REMOTE_TOKEN?.trim() || null);
  }
  throw new Error(`Unsupported OBJECT_DETECTION_PROVIDER: ${provider}`);
}

async function extractFrameJpeg(videoPath: string, time: number, outputPath: string): Promise<void> {
  const ffmpegBinary = process.env.FFMPEG_BINARY?.trim() || "ffmpeg";
  await execFileAsync(ffmpegBinary, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    time.toFixed(3),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    "scale='min(960,iw)':-2",
    outputPath,
  ]);
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    provider: process.env.OBJECT_DETECTION_PROVIDER ?? "mock",
  });
});

app.post("/detect-objects", upload.single("video"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Missing video file." });
    return;
  }

  let workDir: string | null = null;
  try {
    const sampleTimes = parseSampleTimes(req.body.sampleTimes);
    const targetLabels = parseTargetLabels(req.body.targetLabels);
    const maxFramesRaw = Number(process.env.OBJECT_DETECTION_MAX_FRAMES ?? 12);
    const maxFrames = Number.isFinite(maxFramesRaw) ? Math.max(1, Math.floor(maxFramesRaw)) : 12;
    const selectedTimes = downsampleSampleTimes(sampleTimes, maxFrames);
    const provider = createProvider();

    workDir = await mkdtemp(join(tmpdir(), "clipsyreel-detect-"));
    const videoPath = join(workDir, `${randomUUID()}.mp4`);
    await writeFile(videoPath, req.file.buffer);

    const frames: FrameDetectionResult[] = [];
    for (let i = 0; i < selectedTimes.length; i++) {
      const time = selectedTimes[i];
      const framePath = join(workDir, `frame-${i}.jpg`);
      await extractFrameJpeg(videoPath, time, framePath);
      const image = await readFile(framePath);
      const detections = await provider.detect(image, targetLabels, i, time);
      frames.push({ time, detections });
    }

    res.json({
      provider: process.env.OBJECT_DETECTION_PROVIDER ?? "mock",
      frames,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown detection server error.";
    res.status(500).json({ error: message });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
  }
});

const port = Number(process.env.OBJECT_DETECTION_PORT ?? 8787);
app.listen(port, () => {
  console.log(`Object detection server listening on http://localhost:${port}`);
});
