/**
 * Hardware acceleration detection and codec selection.
 *
 * Detects available GPU-accelerated encoders and builds a fallback chain:
 * 1. NVIDIA: h264_nvenc / hevc_nvenc
 * 2. Apple Silicon/Intel Mac: videotoolbox
 * 3. Intel: libmfx (QuickSync)
 * 4. AMD: hevc_amf / h264_amf
 * 5. Fallback: libx264 (software)
 */

// WebGL extension type for debug renderer info
interface WebGLDebugRendererInfo {
  UNMASKED_VENDOR_WEBGL: number;
  UNMASKED_RENDERER_WEBGL: number;
}

export type HardwareCodec = 'h264_nvenc' | 'hevc_nvenc' | 'videotoolbox' | 'hevc_qsv' | 'h264_qsv' | 'hevc_amf' | 'h264_amf' | 'libx264';

export interface HardwareDetectionResult {
  codec: HardwareCodec;
  isHardwareAccelerated: boolean;
  gpuDetected: string | null; // 'nvidia', 'apple', 'intel', 'amd', or null
  supportedCodecs: HardwareCodec[];
  preset: string;
  crf: number;
  notes: string;
}

/**
 * Detect system GPU and available hardware encoders.
 * This is best-effort; actual codec availability depends on FFmpeg build.
 */
export async function detectHardwareAcceleration(): Promise<HardwareDetectionResult> {
  const result: HardwareDetectionResult = {
    codec: 'libx264',
    isHardwareAccelerated: false,
    gpuDetected: null,
    supportedCodecs: ['libx264'],
    preset: 'ultrafast',
    crf: 27,
    notes: 'Fallback: CPU encoding (libx264)',
  };

  // ffmpeg.wasm is a browser-side WebAssembly build, not a native desktop FFmpeg
  // binary. Vendor-specific encoders such as videotoolbox/nvenc/qsv/amf are not
  // available in the bundled core and trigger opaque browser FS errors when used.
  // Keep the client render path fully compatible by forcing the portable libx264
  // encoder, while preserving the native codec detection logic for future server-side
  // deployments that use a full FFmpeg binary.
  if (typeof window !== 'undefined') {
    return result;
  }

  try {
    // Attempt to detect GPU via WebGL
    const gpuInfo = detectGPU();
    result.gpuDetected = gpuInfo;

    if (gpuInfo === 'apple') {
      // Apple Silicon / Intel Mac: videotoolbox
      result.supportedCodecs = ['videotoolbox', 'libx264'];
      result.codec = 'videotoolbox';
      result.isHardwareAccelerated = true;
      result.preset = 'fast'; // videotoolbox presets: fast, medium, slow
      result.crf = 23;
      result.notes = 'Using Apple VideoToolbox (HW accelerated)';
    } else if (gpuInfo === 'nvidia') {
      // NVIDIA: prefer H.265 (30-40% faster), fallback to H.264
      result.supportedCodecs = ['hevc_nvenc', 'h264_nvenc', 'libx264'];
      result.codec = 'hevc_nvenc';
      result.isHardwareAccelerated = true;
      result.preset = 'fast'; // nvenc presets: slow, medium, fast
      result.crf = 23;
      result.notes = 'Using NVIDIA NVENC (HEVC, HW accelerated)';
    } else if (gpuInfo === 'intel') {
      // Intel QuickSync: prefer HEVC
      result.supportedCodecs = ['hevc_qsv', 'h264_qsv', 'libx264'];
      result.codec = 'hevc_qsv';
      result.isHardwareAccelerated = true;
      result.preset = 'fast'; // qsv presets: veryfast, faster, fast, medium, slow
      result.crf = 23;
      result.notes = 'Using Intel QuickSync (HEVC, HW accelerated)';
    } else if (gpuInfo === 'amd') {
      // AMD VCE: use HEVC
      result.supportedCodecs = ['hevc_amf', 'h264_amf', 'libx264'];
      result.codec = 'hevc_amf';
      result.isHardwareAccelerated = true;
      result.preset = 'fast'; // amf presets: speed, balanced, quality
      result.crf = 23;
      result.notes = 'Using AMD VCE (HEVC, HW accelerated)';
    } else {
      // No GPU detected
      result.codec = 'libx264';
      result.isHardwareAccelerated = false;
      result.preset = 'ultrafast';
      result.crf = 27;
      result.notes = 'No GPU detected; using CPU encoding (libx264)';
    }
  } catch (err) {
    console.warn('[hw-acceleration] Detection failed:', err);
    // Fallback to libx264
  }

  return result;
}

/**
 * Detect GPU vendor via WebGL.
 * Returns 'nvidia', 'apple', 'intel', 'amd', or null.
 */
function detectGPU(): string | null {
  try {
    // Create canvas and WebGL context
    const canvas = document.createElement('canvas');
    const glContext = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!glContext) {
      return null;
    }

    // Cast to WebGLRenderingContext to access getExtension
    const gl = glContext as WebGLRenderingContext;

    // Get debugger extension
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info') as WebGLDebugRendererInfo | null;
    if (!debugInfo) {
      return null;
    }

    // Get GPU name
    const gpuName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)?.toLowerCase() || '';

    // Detect vendor
    if (gpuName.includes('nvidia') || gpuName.includes('geforce') || gpuName.includes('quadro')) {
      return 'nvidia';
    } else if (
      gpuName.includes('apple') ||
      gpuName.includes('metal') ||
      gpuName.includes('m1') ||
      gpuName.includes('m2') ||
      gpuName.includes('m3')
    ) {
      return 'apple';
    } else if (
      gpuName.includes('intel') ||
      gpuName.includes('iris') ||
      gpuName.includes('uhd') ||
      gpuName.includes('hd graphics')
    ) {
      return 'intel';
    } else if (
      gpuName.includes('amd') ||
      gpuName.includes('radeon') ||
      gpuName.includes('rx') ||
      gpuName.includes('ryzen')
    ) {
      return 'amd';
    }

    return null;
  } catch (err) {
    console.warn('[hw-acceleration] WebGL detection failed:', err);
    return null;
  }
}

/**
 * Build FFmpeg encoder arguments for a given codec.
 * Handles variant presets and CRF values for quality balance.
 */
export function buildEncoderArgs(
  codec: HardwareCodec,
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow' = 'fast',
  crf: number = 23
): string[] {
  const effectiveCodec: HardwareCodec = typeof window !== 'undefined' ? 'libx264' : codec;
  const args: string[] = ['-c:v', effectiveCodec];

  switch (effectiveCodec) {
    case 'hevc_nvenc':
    case 'h264_nvenc':
      // NVIDIA NVENC
      args.push('-preset', preset === 'ultrafast' ? 'fast' : preset);
      args.push('-rc', 'vbr'); // Use VBR for better quality
      args.push('-cq', String(crf));
      break;

    case 'videotoolbox':
      // Apple VideoToolbox
      args.push('-q', String(31 - Math.round(crf))); // Quality: 0-51 (inverse of libx264 CRF)
      args.push('-allow_sw', '1'); // Allow software fallback
      break;

    case 'hevc_qsv':
    case 'h264_qsv':
      // Intel QuickSync
      args.push('-preset', preset);
      args.push('-global_quality', String(51 - crf)); // Quality: 0-51 (inverse of CRF)
      break;

    case 'hevc_amf':
    case 'h264_amf':
      // AMD VCE
      args.push('-quality', preset === 'ultrafast' ? 'speed' : preset === 'fast' ? 'speed' : 'balanced');
      args.push('-rc', 'vbr');
      args.push('-qp_i', String(crf));
      break;

    case 'libx264':
    default:
      // Software fallback
      args.push('-preset', preset);
      args.push('-crf', String(crf));
      break;
  }

  return args;
}

/**
 * Get human-readable codec name.
 */
export function getCodecName(codec: HardwareCodec): string {
  const names: Record<HardwareCodec, string> = {
    h264_nvenc: 'NVIDIA H.264',
    hevc_nvenc: 'NVIDIA H.265',
    videotoolbox: 'Apple VideoToolbox',
    hevc_qsv: 'Intel QuickSync (H.265)',
    h264_qsv: 'Intel QuickSync (H.264)',
    hevc_amf: 'AMD VCE (H.265)',
    h264_amf: 'AMD VCE (H.264)',
    libx264: 'Software (libx264)',
  };
  return names[codec] || codec;
}

/**
 * Caching: Store detection result in sessionStorage so we don't re-detect every render.
 */
let cachedResult: HardwareDetectionResult | null = null;

export async function getHardwareAcceleration(): Promise<HardwareDetectionResult> {
  if (cachedResult) {
    return cachedResult;
  }

  cachedResult = await detectHardwareAcceleration();
  return cachedResult;
}

export function clearHardwareAccelerationCache() {
  cachedResult = null;
}
