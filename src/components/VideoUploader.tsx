"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileVideo, CheckCircle2, X, Plus, Volume2, VolumeX, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVideoDuration } from "@/lib/video-engine";
import { readVideoMetadata } from "@/lib/video-metadata";
import { UploadedVideo } from "@/types";

interface VideoUploaderProps {
  videos: UploadedVideo[];
  onChange: (videos: UploadedVideo[]) => void;
  maxVideos?: number;
  keepOriginalAudio: boolean;
  onKeepOriginalAudioChange: (value: boolean) => void;
}

const DEFAULT_MAX = 3;

/**
 * FUTURE BACKEND INTEGRATION:
 * `onChange` currently just stores local file metadata + an object URL for
 * client-side preview per file. In production, selecting a file here should
 * kick off an upload to your backend/storage (e.g. `POST /api/upload`
 * streaming to S3/Supabase Storage), and the returned asset URL/id should be
 * what gets passed to the real analysis job instead of the raw File object.
 */
export default function VideoUploader({
  videos,
  onChange,
  maxVideos = DEFAULT_MAX,
  keepOriginalAudio,
  onKeepOriginalAudioChange,
}: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const canAddMore = videos.length < maxVideos;

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || !canAddMore) return;
      if (!file.type.startsWith("video/")) return;

      setIsUploading(true);
      setProgress(0);
      setPendingFile(file);
    },
    [canAddMore]
  );

  // Simulated upload progress — replace with real upload progress events later.
  useEffect(() => {
    if (!pendingFile) return;

    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + 8 + Math.random() * 14;
        return next >= 100 ? 100 : next;
      });
    }, 140);

    return () => clearInterval(interval);
  }, [pendingFile]);

  // Note: setState calls below run inside the async IIFE (a nested function),
  // not synchronously in the effect body itself, which avoids the "cascading
  // renders" / "update during render" warnings React raises when setState
  // calls fire synchronously during an effect's commit phase.
  useEffect(() => {
    if (!pendingFile || progress < 100) return;
    const file = pendingFile;
    let cancelled = false;

    (async () => {
      const previewUrl = URL.createObjectURL(file);
      const durationSeconds = await getVideoDuration(file);
      const metadata = await readVideoMetadata(file);
      if (cancelled) return;
      setIsUploading(false);
      setPendingFile(null);
      onChange([
        ...videos,
        {
          name: file.name,
          sizeMb: Math.round((file.size / (1024 * 1024)) * 10) / 10,
          previewUrl,
          file,
          durationSeconds,
          metadata,
        },
      ]);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, pendingFile]);

  const removeAt = (index: number) => onChange(videos.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {videos.map((v, i) => (
        <div key={v.previewUrl} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-black">
              <video src={v.previewUrl} className="h-full w-full object-cover" muted />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white/90">{v.name}</p>
              <p className="text-xs text-white/50">
                {v.sizeMb} MB · clip {i + 1} · ready to craft
              </p>
              <p className="text-[11px] text-white/35">
                {v.metadata.gps
                  ? `GPS ${v.metadata.gps.lat.toFixed(3)}, ${v.metadata.gps.lng.toFixed(3)}`
                  : v.metadata.technicalReason ?? "Location unknown"}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <button
              onClick={() => removeAt(i)}
              className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Remove video"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        role="switch"
        aria-checked={keepOriginalAudio}
        onClick={() => onKeepOriginalAudioChange(!keepOriginalAudio)}
        className={cn(
          "group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
          keepOriginalAudio
            ? "border-emerald-400/35 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.10)]"
            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
        )}
      >
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition",
            keepOriginalAudio ? "brand-gradient shadow-lg shadow-emerald-500/20" : "bg-white/5"
          )}
        >
          {keepOriginalAudio ? (
            <Volume2 className="h-5 w-5 text-white" />
          ) : (
            <VolumeX className="h-5 w-5 text-white/60" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white/90">Keep original audio</p>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
              keepOriginalAudio ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-white/40"
            )}>
              {keepOriginalAudio ? "ON" : "OFF"}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-white/45">
            {keepOriginalAudio
              ? "Your exported reel will keep the sound from the uploaded clips."
              : "The exported reel will be silent and ready for a new soundtrack."}
          </p>
        </div>
        <Sparkles className={cn("h-4.5 w-4.5 shrink-0 transition", keepOriginalAudio ? "text-emerald-300" : "text-white/25")} />
      </button>

      {canAddMore && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition",
              isDragging ? "border-fuchsia-400/60 bg-fuchsia-500/5" : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
            )}
          >
            <AnimatePresence mode="wait">
              {isUploading ? (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex w-full flex-col items-center gap-3"
                >
                  <FileVideo className="h-8 w-8 text-fuchsia-400" />
                  <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full brand-gradient"
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-xs text-white/50">Uploading… {Math.min(100, Math.round(progress))}%</p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient shadow-lg shadow-fuchsia-500/20">
                    {videos.length === 0 ? <UploadCloud className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">
                      {videos.length === 0 ? "Tap to upload your MP4" : `Add another clip (${videos.length}/${maxVideos})`}
                    </p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {videos.length === 0 ? "or drag & drop · up to 500MB" : "Combine up to 3 clips into one montage"}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      )}

      {!canAddMore && <p className="text-center text-[11px] text-white/35">Maximum of {maxVideos} clips per montage.</p>}
    </div>
  );
}
