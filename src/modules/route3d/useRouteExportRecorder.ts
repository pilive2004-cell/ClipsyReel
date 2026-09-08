import { useCallback, useRef, useState } from "react";
import type { Route3DFrameInput, Route3DStageHandle } from "./Route3DCinematicStage";
import type { VehicleKind } from "./types";

/** Short, cinematic — this is a highlight insert for the Reel montage, not a full replay of the whole GPX track. */
const EXPORT_DURATION_SECONDS = 8;

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(candidate)) return candidate;
  }
  return "video/webm";
}

/** Loads a Blob into a detached `<video>` element just long enough to read its real decoded duration. */
function readVideoDurationSeconds(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      const duration = Number.isFinite(el.duration) ? el.duration : EXPORT_DURATION_SECONDS;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(EXPORT_DURATION_SECONDS);
    };
  });
}

export interface RouteExportResult {
  file: File;
  durationSeconds: number;
}

export interface UseRouteExportRecorderResult {
  isExporting: boolean;
  exportProgress: number;
  exportError: string | null;
  /** Records a short cinematic flythrough of the route and resolves with a ready-to-insert clip. */
  startExport: (params: { stageRef: React.RefObject<Route3DStageHandle | null>; vehicleKind: VehicleKind }) => Promise<RouteExportResult | null>;
}

/**
 * Records the 3D stage's own canvas via `captureStream` + `MediaRecorder` —
 * no server round-trip, no extra render pass: what the user sees is exactly
 * what gets exported, at real 60fps capture.
 */
export function useRouteExportRecorder(): UseRouteExportRecorderResult {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const startExport = useCallback(
    async ({
      stageRef,
      vehicleKind,
    }: {
      stageRef: React.RefObject<Route3DStageHandle | null>;
      vehicleKind: VehicleKind;
    }): Promise<RouteExportResult | null> => {
      const stage = stageRef.current;
      const canvas = stage?.getCanvas();
      if (!stage || !canvas || !stage.isReady()) {
        setExportError("La scène 3D n'est pas encore prête.");
        return null;
      }
      if (typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
        setExportError("L'enregistrement vidéo n'est pas supporté par ce navigateur.");
        return null;
      }

      setIsExporting(true);
      setExportProgress(0);
      setExportError(null);

      try {
        const stream = canvas.captureStream(60);
        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };

        const stopped = new Promise<Blob>((resolve) => {
          recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        });

        recorder.start(250);

        const startedAt = performance.now();
        let lastNowMs = performance.now();
        await new Promise<void>((resolveLoop) => {
          const tick = (nowMs: number) => {
            const elapsedSeconds = (nowMs - startedAt) / 1000;
            const progress = Math.min(1, elapsedSeconds / EXPORT_DURATION_SECONDS);
            const dt = Math.max(0, Math.min(0.1, (nowMs - lastNowMs) / 1000));
            lastNowMs = nowMs;

            const frame: Route3DFrameInput = { progress, vehicleKind, dt, cameraMode: "overview" };
            stage.renderFrame(frame);
            setExportProgress(progress);

            if (progress >= 1) {
              resolveLoop();
              return;
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        });

        recorder.stop();
        const blob = await stopped;
        const durationSeconds = await readVideoDurationSeconds(blob);
        const file = new File([blob], `route-3d-story-${Date.now()}.webm`, { type: mimeType });
        return { file, durationSeconds };
      } catch (error) {
        setExportError(error instanceof Error ? error.message : "Échec de l'export de la séquence 3D.");
        return null;
      } finally {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setIsExporting(false);
      }
    },
    []
  );

  return { isExporting, exportProgress, exportError, startExport };
}
