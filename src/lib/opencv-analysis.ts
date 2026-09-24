export interface OpenCvFrameMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  motionIntensity: number;
  sceneChange: number;
  stability: number;
  dynamicEnergy: number;
}

export interface OpenCvAnalysisSummary {
  frameMetrics: OpenCvFrameMetrics[];
  averageBrightness: number;
  averageContrast: number;
  averageSharpness: number;
  averageMotion: number;
  averageSceneChange: number;
  averageStability: number;
  dynamicEnergy: number;
  interestingTimestamps: number[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function summarizeOpenCvMetrics(
  series: Array<{
    brightness: number;
    contrast: number;
    sharpness: number;
    motion: number;
  }>
): OpenCvAnalysisSummary {
  const frameMetrics = series.map((sample, index, items) => {
    const previous = items[index - 1];
    const brightness = clamp01(sample.brightness);
    const contrast = clamp01(sample.contrast);
    const sharpness = clamp01(sample.sharpness);
    const motionIntensity = clamp01(sample.motion);
    const sceneChange = previous
      ? clamp01(
          Math.abs(sample.motion - previous.motion) * 0.65 +
            Math.abs(sample.sharpness - previous.sharpness) * 0.35
        )
      : clamp01(sample.motion * 0.45);
    const stability = 1 - clamp01(motionIntensity * 0.75 + sceneChange * 0.25);
    const dynamicEnergy = clamp01(motionIntensity * 0.65 + sceneChange * 0.35);

    return {
      brightness,
      contrast,
      sharpness,
      motionIntensity,
      sceneChange,
      stability,
      dynamicEnergy,
    };
  });

  const averageBrightness =
    frameMetrics.reduce((sum, metric) => sum + metric.brightness, 0) / (frameMetrics.length || 1);
  const averageContrast =
    frameMetrics.reduce((sum, metric) => sum + metric.contrast, 0) / (frameMetrics.length || 1);
  const averageSharpness =
    frameMetrics.reduce((sum, metric) => sum + metric.sharpness, 0) / (frameMetrics.length || 1);
  const averageMotion =
    frameMetrics.reduce((sum, metric) => sum + metric.motionIntensity, 0) / (frameMetrics.length || 1);
  const averageSceneChange =
    frameMetrics.reduce((sum, metric) => sum + metric.sceneChange, 0) / (frameMetrics.length || 1);
  const averageStability =
    frameMetrics.reduce((sum, metric) => sum + metric.stability, 0) / (frameMetrics.length || 1);
  const dynamicEnergy =
    frameMetrics.reduce((sum, metric) => sum + metric.dynamicEnergy, 0) / (frameMetrics.length || 1);

  const interestingTimestamps = frameMetrics
    .map((metric, index) => ({ index, score: metric.dynamicEnergy + metric.sceneChange * 0.5 }))
    .filter((entry) => entry.score > 0.72)
    .map((entry) => entry.index);

  return {
    frameMetrics,
    averageBrightness,
    averageContrast,
    averageSharpness,
    averageMotion,
    averageSceneChange,
    averageStability,
    dynamicEnergy,
    interestingTimestamps,
  };
}
