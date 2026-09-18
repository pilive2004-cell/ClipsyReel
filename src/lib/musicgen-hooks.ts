import { useState, useCallback } from "react";

export type ReelStyle = "viral" | "sport" | "luxury" | "cinematic" | "adventure" | "motivational";

interface UseMusicGenOptions {
  style: ReelStyle;
  duration: number; // seconds
  bpm?: number;
  intensity?: number;
}

interface MusicGenState {
  isLoading: boolean;
  error: string | null;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

export function useMusicGen() {
  const [state, setState] = useState<MusicGenState>({
    isLoading: false,
    error: null,
    audioBlob: null,
    audioUrl: null,
  });

  const generateMusic = useCallback(
    async (options: UseMusicGenOptions) => {
      setState({
        isLoading: true,
        error: null,
        audioBlob: null,
        audioUrl: null,
      });

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch("/api/generate-music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(options),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to generate music");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        setState({
          isLoading: false,
          error: null,
          audioBlob: blob,
          audioUrl: url,
        });

        return blob;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setState({
          isLoading: false,
          error: message,
          audioBlob: null,
          audioUrl: null,
        });
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    setState({
      isLoading: false,
      error: null,
      audioBlob: null,
      audioUrl: null,
    });
  }, [state.audioUrl]);

  return {
    ...state,
    generateMusic,
    reset,
  };
}

export function useMuxAudio() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muxAudio = useCallback(
    async (videoFile: File, audioBlob: Blob): Promise<Blob> => {
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("audio", audioBlob, "audio.wav");

        const response = await fetch("/api/mux-audio", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to mux audio");
        }

        const blob = await response.blob();
        setIsLoading(false);
        return blob;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setError(message);
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    muxAudio,
    reset,
  };
}
