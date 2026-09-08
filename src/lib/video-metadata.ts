import type { VideoGeoMetadata, VideoResolution } from "@/types";

const QUICKTIME_EPOCH_MS = Date.UTC(1904, 0, 1, 0, 0, 0);
const SAMPLE_BYTES = 12 * 1024 * 1024;

function decodeLatin1(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes);
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function trimPrintable(value: string) {
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
}

function findAsciiSequence(haystack: string, needle: string) {
  return haystack.indexOf(needle);
}

function parseIso6709(text: string): { lat: number; lng: number } | null {
  const match = text.match(/([+-]\d{1,2}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?\/?/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function extractNearbyText(bytes: Uint8Array, around: number, radius = 220) {
  const from = clamp(around - radius, 0, bytes.length);
  const to = clamp(around + radius, 0, bytes.length);
  return trimPrintable(decodeUtf8(bytes.subarray(from, to)));
}

function extractFollowingText(bytes: Uint8Array, start: number, length = 220) {
  const from = clamp(start, 0, bytes.length);
  const to = clamp(start + length, 0, bytes.length);
  return trimPrintable(decodeUtf8(bytes.subarray(from, to)));
}

function parseMvhdCreationDate(bytes: Uint8Array) {
  const text = decodeLatin1(bytes);
  const offset = findAsciiSequence(text, "mvhd");
  if (offset < 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint8(offset + 4);
  try {
    let createdSeconds = 0;
    if (version === 1) {
      const upper = view.getUint32(offset + 8);
      const lower = view.getUint32(offset + 12);
      if (upper !== 0) return null;
      createdSeconds = lower;
    } else {
      createdSeconds = view.getUint32(offset + 8);
    }
    if (!createdSeconds) return null;
    const date = new Date(QUICKTIME_EPOCH_MS + createdSeconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function parseCreationDateFromText(bytes: Uint8Array) {
  const text = decodeUtf8(bytes);
  const iso = text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
  if (iso) {
    const date = new Date(iso[0]);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const exifStyle = text.match(/\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/);
  if (exifStyle) {
    const normalized = exifStyle[0].replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T").replace(" ", "T") + "Z";
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function parseGps(bytes: Uint8Array) {
  const text = decodeLatin1(bytes);
  const keys = ["com.apple.quicktime.location.ISO6709", "©xyz", "location.ISO6709"];
  for (const key of keys) {
    const offset = findAsciiSequence(text, key);
    if (offset >= 0) {
      const nearby = extractFollowingText(bytes, offset + key.length, 160);
      const parsed = parseIso6709(nearby);
      if (parsed) return parsed;
    }
  }
  return null;
}

function parseCameraModel(bytes: Uint8Array) {
  const text = decodeUtf8(bytes);
  const knownMarkers = [
    "com.apple.quicktime.model",
    "GoPro",
    "DJI",
    "Insta360",
    "Canon",
    "NIKON",
    "SONY",
  ];
  for (const marker of knownMarkers) {
    const offset = text.indexOf(marker);
    if (offset >= 0) {
      const nearby = extractNearbyText(bytes, offset, 120);
      const lines = nearby.split(/ {2,}|[\r\n]/).map(trimPrintable).filter(Boolean);
      const withMarker = lines.find((line) => line.includes(marker));
      if (withMarker) {
        return withMarker.replace("com.apple.quicktime.model", "").trim() || marker;
      }
      return marker;
    }
  }
  return null;
}

async function loadHtmlVideoDetails(file: File): Promise<{ durationSeconds: number | null; resolution: VideoResolution | null; technicalReason: string | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finalize = (durationSeconds: number | null, resolution: VideoResolution | null, technicalReason: string | null) => {
      URL.revokeObjectURL(url);
      resolve({ durationSeconds, resolution, technicalReason });
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      finalize(
        Number.isFinite(video.duration) ? video.duration : null,
        video.videoWidth > 0 && video.videoHeight > 0 ? { width: video.videoWidth, height: video.videoHeight } : null,
        null
      );
    };
    video.onerror = () => {
      const mediaError = video.error;
      const detail = mediaError ? `HTML video metadata load failed (MediaError ${mediaError.code}${mediaError.message ? `: ${mediaError.message}` : ""})` : "HTML video metadata load failed";
      finalize(null, null, detail);
    };
    video.src = url;
    video.load();
  });
}

async function sampleMetadataBytes(file: File) {
  const head = new Uint8Array(await file.slice(0, SAMPLE_BYTES).arrayBuffer());
  if (file.size <= SAMPLE_BYTES * 2) return head;
  const tail = new Uint8Array(await file.slice(file.size - SAMPLE_BYTES).arrayBuffer());
  const combined = new Uint8Array(head.length + tail.length);
  combined.set(head, 0);
  combined.set(tail, head.length);
  return combined;
}

/**
 * Extracts real metadata from MP4/MOV/QuickTime files in the browser.
 *
 * Implementation notes:
 * - GPS is read from common QuickTime/MP4 metadata atoms such as
 *   `com.apple.quicktime.location.ISO6709` and `©xyz`.
 * - Creation date is read from `mvhd` when available, then falls back to
 *   textual ISO/EXIF-style timestamps found in the sampled metadata bytes.
 * - Duration + resolution come from the browser decoder (`<video>` metadata),
 *   which is more reliable than parsing track atoms by hand.
 *
 * Limitations:
 * - Browser-side parsing cannot cover every proprietary action-camera atom.
 * - When GPS is absent or stored in an unsupported format, we return
 *   `location unknown` with a technical reason instead of inventing a route
 *   placement.
 */
export async function readVideoMetadata(file: File): Promise<VideoGeoMetadata> {
  const fallbackId = `${file.name}-${file.size}-${file.lastModified}`;
  const htmlVideo = await loadHtmlVideoDetails(file);

  let gps: VideoGeoMetadata["gps"] = null;
  let capturedAt: Date | null = null;
  let cameraModel: string | null = null;
  let technicalReason: string | null = htmlVideo.technicalReason;
  let metadataSource: VideoGeoMetadata["metadataSource"] = htmlVideo.durationSeconds || htmlVideo.resolution ? "html-video" : "none";

  try {
    const bytes = await sampleMetadataBytes(file);
    gps = parseGps(bytes);
    capturedAt = parseMvhdCreationDate(bytes) ?? parseCreationDateFromText(bytes);
    cameraModel = parseCameraModel(bytes);
    if (gps || capturedAt || cameraModel) {
      metadataSource = "quicktime";
      if (!gps) {
        technicalReason = "No embedded GPS metadata atom was found in the sampled MP4/MOV metadata.";
      } else {
        technicalReason = null;
      }
    } else if (!technicalReason) {
      technicalReason = "No supported QuickTime/MP4 metadata atoms with GPS or creation data were found.";
    }
  } catch (error) {
    technicalReason = error instanceof Error ? error.message : "Unknown metadata parsing error.";
  }

  const result: VideoGeoMetadata = {
    videoId: fallbackId,
    name: file.name,
    gps,
    capturedAt,
    cameraModel,
    durationSeconds: htmlVideo.durationSeconds,
    resolution: htmlVideo.resolution,
    technicalReason,
    metadataSource,
  };

  if (process.env.NODE_ENV !== "production") {
    console.info("[video-metadata]", {
      file: file.name,
      creationDate: result.capturedAt?.toISOString() ?? null,
      gpsLatitude: result.gps?.lat ?? null,
      gpsLongitude: result.gps?.lng ?? null,
      cameraModel: result.cameraModel,
      durationSeconds: result.durationSeconds,
      resolution: result.resolution ? `${result.resolution.width}x${result.resolution.height}` : null,
      metadataSource: result.metadataSource,
      technicalReason: result.technicalReason,
    });
  }

  return result;
}
