"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileVideo, CheckCircle2, X, Plus, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectVideoHasAudio, getVideoDuration } from "@/lib/video-engine";
import { readVideoMetadata } from "@/lib/video-metadata";
import { UploadedVideo } from "@/types";
import { useLocale } from "@/lib/i18n";

interface VideoUploaderProps {
  videos: UploadedVideo[];
  onChange: (videos: UploadedVideo[]) => void;
  maxVideos?: number;
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
}: VideoUploaderProps) {
  const { copy } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const videosRef = useRef(videos);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const canAddMore = videos.length < maxVideos;

  useEffect(() => {
   videosRef.current = videos;
  }, [videos]);

  const handleFiles = useCallback(
   async (files: FileList | File[] | undefined) => {
     const list = Array.from(files ?? []).filter((file) => file.type.startsWith("video/"));
     if (list.length === 0 || !canAddMore) return;

     const simulateUpload = () =>
       new Promise<void>((resolve) => {
         let current = 0;
         const interval = window.setInterval(() => {
           current += 8 + Math.random() * 14;
           if (current >= 100) {
             setProgress(100);
             window.clearInterval(interval);
             resolve();
           } else {
             setProgress(current);
           }
         }, 140);
       });

     const makeUploadedVideo = async (file: File): Promise<UploadedVideo> => {
       const previewUrl = URL.createObjectURL(file);
       const [durationSeconds, metadata, hasAudio] = await Promise.all([
         getVideoDuration(file),
         readVideoMetadata(file),
         detectVideoHasAudio(file),
       ]);

       return {
         name: file.name,
         sizeMb: Math.round((file.size / (1024 * 1024)) * 10) / 10,
         previewUrl,
         file,
         durationSeconds,
         metadata,
         keepAudio: hasAudio,
       };
     };

     for (const file of list) {
       if (videosRef.current.length >= maxVideos) break;
       setIsUploading(true);
       setProgress(0);

       await simulateUpload();
       if (videosRef.current.length >= maxVideos) continue;

       const uploadedVideo = await makeUploadedVideo(file);
       onChange([
         ...videosRef.current,
         uploadedVideo,
       ]);
       videosRef.current = [...videosRef.current, uploadedVideo];
     }

     setIsUploading(false);
     setProgress(0);
   },
   [canAddMore, maxVideos, onChange]
  );

  const removeAt = (index: number) => onChange(videos.filter((_, i) => i !== index));
  const toggleAudioAt = (index: number) =>
    onChange(videos.map((video, i) => (i === index ? { ...video, keepAudio: !video.keepAudio } : video)));

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
                {v.sizeMb} MB · clip {i + 1} · {copy.upload.ready}
              </p>
              <p className="text-[11px] text-white/35">
                {v.metadata.gps
                  ? `GPS ${v.metadata.gps.lat.toFixed(3)}, ${v.metadata.gps.lng.toFixed(3)}`
                  : v.metadata.technicalReason ?? "Location unknown"}
              </p>
            </div>
            <button
              onClick={() => toggleAudioAt(i)}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition",
                v.keepAudio
                  ? "bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
                  : "bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/70"
              )}
              aria-label={v.keepAudio ? copy.upload.audioOn : copy.upload.audioOff}
              title={v.keepAudio ? copy.upload.audioOn : copy.upload.audioOff}
            >
              {v.keepAudio ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
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

      {canAddMore && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files ?? undefined)}
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
              handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-4 py-10 text-center transition",
              isDragging
                ? "border-fuchsia-300/60 bg-[#121024] shadow-[0_0_0_1px_rgba(217,70,239,0.2),0_18px_40px_rgba(124,58,237,0.2)]"
                : "border-white/10 bg-[#0b0f17] hover:border-white/22 hover:bg-[#0f1522]"
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_78%_at_50%_-8%,rgba(217,70,239,0.2),transparent_58%),radial-gradient(100%_90%_at_50%_120%,rgba(124,58,237,0.16),transparent_62%)]" />
            <div className="pointer-events-none absolute inset-[1px] rounded-[15px] border border-white/5" />
            <AnimatePresence mode="wait">
              {isUploading ? (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative z-10 flex w-full flex-col items-center gap-3"
                >
                  <FileVideo className="h-8 w-8 text-fuchsia-400" />
                  <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full brand-gradient"
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-xs text-white/50">{copy.upload.upload} {Math.min(100, Math.round(progress))}%</p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative z-10 flex flex-col items-center gap-3"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient shadow-lg shadow-fuchsia-500/20">
                    {videos.length === 0 ? <UploadCloud className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">
                      {videos.length === 0 ? copy.upload.tap : `${copy.upload.add} (${videos.length}/${maxVideos})`}
                    </p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {videos.length === 0 ? copy.upload.drag : copy.upload.combine}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      )}

      {!canAddMore && <p className="text-center text-[11px] text-white/35">{copy.upload.max.replace("{maxVideos}", String(maxVideos))}</p>}
    </div>
  );
}
