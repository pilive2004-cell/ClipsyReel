"use client";

import React, { useState, useEffect } from "react";
import { Music, Download, X } from "lucide-react";
import { useMuxAudio } from "@/lib/musicgen-hooks";

interface ExportWithMusicDialogProps {
  isOpen: boolean;
  videoFile: File | null;
  audioBlob: Blob | null;
  onClose: () => void;
  onExport: (blob: Blob, filename: string) => void;
}

export function ExportWithMusicDialog({
  isOpen,
  videoFile,
  audioBlob,
  onClose,
  onExport,
}: ExportWithMusicDialogProps) {
  const [includeMusic, setIncludeMusic] = useState(true);
  const { isLoading, error, muxAudio } = useMuxAudio();

  const handleExport = async () => {
    if (!videoFile) return;

    try {
      let finalBlob: Blob = videoFile;

      if (includeMusic && audioBlob) {
        // Mux video + audio
        finalBlob = await muxAudio(videoFile, audioBlob);
      }

      onExport(finalBlob, "reel.mp4");
      onClose();
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Music className="w-5 h-5" />
            Export Options
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={includeMusic}
                onChange={() => setIncludeMusic(true)}
                disabled={!audioBlob || isLoading}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">Export with Generated Music</div>
                <div className="text-sm text-gray-500">
                  Includes adaptive background music
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={!includeMusic}
                onChange={() => setIncludeMusic(false)}
                disabled={isLoading}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">Export without Music</div>
                <div className="text-sm text-gray-500">
                  Use Instagram library music instead
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading || !videoFile}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                Processing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
