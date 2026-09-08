"use client";

import { ReelStyle } from "@/types";
import { PIXABAY_TRACKS } from "@/data/pixabayTracks";

/**
 * Procedurally-synthesized "vibe" music for the Reel preview only.
 *
 * There's no licensed music catalog wired up in this MVP (and there
 * shouldn't be a real one played back automatically anyway — Instagram
 * requires the actual track to be added *inside* Instagram itself, see
 * `MusicSuggestionPanel`). So instead of silence, this generates a short,
 * royalty-free-by-construction instrumental loop entirely with the Web
 * Audio API (oscillators + filtered noise, no samples/files at all) tuned
 * to each style's genre/mood/BPM from `MUSIC_BY_STYLE` in `src/data/mock.ts`
 * — just enough to *feel* the pacing a real track would add.
 *
 * IMPORTANT: this audio graph is completely separate from the ffmpeg.wasm
 * render pipeline in `video-engine.ts` — it only ever plays through the
 * browser's speakers while previewing, and is never mixed into the
 * exported MP4. The UI must always make it clear this is a preview-only
 * placeholder (see the badge in `ReelPreview.tsx`).
 *
 * FUTURE INTEGRATION: if a real licensed-music search (e.g. Epidemic Sound,
 * Artlist, or Meta's own Reels audio API) is ever added, this whole module
 * can be swapped for "fetch a real preview clip URL and play it" without
 * changing the calling component's API surface.
 */

interface StyleSoundProfile {
  bpm: number;
  /** Root note of the loop, in Hz. */
  rootHz: number;
  /** Scale degrees (semitones from root) the bassline/pad can draw from. */
  scale: number[];
  /** 16 steps (one bar of 16th notes) — true = kick hit. */
  kick: boolean[];
  /** 16 steps — true = hi-hat/shaker hit. */
  hat: boolean[];
  /** 16 steps — index into `scale` for a bass note, or null for silence. */
  bass: (number | null)[];
  /** Sustained pad/drone chord (semitones from root), or empty for none. */
  pad: number[];
  bassWave: OscillatorType;
  padWave: OscillatorType;
  hatColorHz: number;
  swing: number; // 0-0.12, delays odd 16th steps for groove
  masterGain: number;
}

const PROFILES: Record<ReelStyle, StyleSoundProfile> = {
  viral: {
    bpm: 140,
    rootHz: 98, // G2
    scale: [0, 3, 5, 7, 10],
    kick: [true, false, false, false, false, false, true, false, false, false, true, false, false, false, false, false],
    hat: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    bass: [0, null, null, 0, null, null, 3, null, 0, null, null, 0, null, 5, null, null],
    pad: [],
    bassWave: "sawtooth",
    padWave: "sine",
    hatColorHz: 9000,
    swing: 0.04,
    masterGain: 0.22,
  },
  travel: {
    bpm: 96,
    rootHz: 130.81, // C3
    scale: [0, 2, 4, 7, 9],
    kick: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
    hat: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
    bass: [0, null, null, null, 4, null, null, null, 0, null, null, null, 7, null, null, null],
    pad: [0, 4, 7],
    bassWave: "triangle",
    padWave: "sine",
    hatColorHz: 6000,
    swing: 0.08,
    masterGain: 0.18,
  },
  adventure: {
    bpm: 128,
    rootHz: 110, // A2
    scale: [0, 3, 5, 7, 10],
    kick: [true, false, true, false, true, false, false, true, true, false, true, false, true, false, false, true],
    hat: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    bass: [0, null, null, null, 0, null, null, null, 5, null, null, null, 3, null, null, null],
    pad: [0, 5, 7],
    bassWave: "sawtooth",
    padWave: "triangle",
    hatColorHz: 5000,
    swing: 0.02,
    masterGain: 0.22,
  },
  sport: {
    bpm: 150,
    rootHz: 92.5, // F#2
    scale: [0, 2, 3, 7, 10],
    kick: [true, false, false, true, false, false, true, false, true, false, false, true, false, false, true, false],
    hat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
    bass: [0, null, 3, null, 0, null, 2, null, 0, null, 3, null, 7, null, 3, null],
    pad: [],
    bassWave: "sawtooth",
    padWave: "sine",
    hatColorHz: 10000,
    swing: 0,
    masterGain: 0.24,
  },
  cinematic: {
    bpm: 72,
    rootHz: 65.41, // C2
    scale: [0, 3, 5, 7, 8],
    kick: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    hat: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    bass: [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null],
    pad: [0, 3, 7, 12],
    bassWave: "sine",
    padWave: "sine",
    hatColorHz: 4000,
    swing: 0,
    masterGain: 0.2,
  },
  luxury: {
    bpm: 118,
    rootHz: 116.54, // A#2
    scale: [0, 2, 4, 7, 9],
    kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    hat: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
    bass: [0, null, null, null, null, null, null, null, 4, null, null, null, null, null, null, null],
    pad: [0, 4, 7, 11],
    bassWave: "triangle",
    padWave: "sine",
    hatColorHz: 8000,
    swing: 0.05,
    masterGain: 0.16,
  },
};

function semitoneToRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/** Plays one short percussive "kick" hit — a pitched sine burst with a fast pitch+amplitude drop. */
function scheduleKick(ctx: AudioContext, dest: AudioNode, time: number, gainAmount: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.09);
  gain.gain.setValueAtTime(gainAmount, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
  osc.connect(gain).connect(dest);
  osc.start(time);
  osc.stop(time + 0.24);
}

/** Plays one short filtered-noise "hat" hit. */
function scheduleHat(ctx: AudioContext, dest: AudioNode, time: number, colorHz: number, gainAmount: number) {
  const bufferSize = Math.round(ctx.sampleRate * 0.05);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = colorHz;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainAmount, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

  noise.connect(filter).connect(gain).connect(dest);
  noise.start(time);
  noise.stop(time + 0.06);
}

/** Plays one short bass note. */
function scheduleBassNote(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number, wave: OscillatorType, gainAmount: number) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, time);
  filter.type = "lowpass";
  filter.frequency.value = 900;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainAmount, time + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(filter).connect(gain).connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

const LOOKAHEAD_MS = 50;
const SCHEDULE_AHEAD_S = 0.15;

/**
 * A small step-sequencer engine that procedurally plays a style-matched
 * instrumental loop for the Reel preview. Uses the standard Web Audio
 * "lookahead scheduler" pattern for sample-accurate timing regardless of
 * `setInterval` jitter.
 */
export class MusicPreviewEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timerId: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private profile: StyleSoundProfile;
  private stepDuration: number;
  private padOscillators: OscillatorNode[] = [];

  constructor(style: ReelStyle) {
    this.profile = PROFILES[style];
    this.stepDuration = 60 / this.profile.bpm / 4; // 16th notes
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextCtor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.profile.masterGain;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private startPad(ctx: AudioContext) {
    if (this.profile.pad.length === 0 || !this.master) return;
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0, ctx.currentTime);
    padGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2);
    padGain.connect(this.master);

    for (const semis of this.profile.pad) {
      const osc = ctx.createOscillator();
      osc.type = this.profile.padWave;
      osc.frequency.value = this.profile.rootHz * semitoneToRatio(semis) * 2;
      osc.connect(padGain);
      osc.start();
      this.padOscillators.push(osc);
    }
  }

  private scheduler = () => {
    if (!this.ctx || !this.master) return;
    while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      const i = this.step % 16;
      const swungTime = i % 2 === 1 ? this.nextStepTime + this.profile.swing * this.stepDuration : this.nextStepTime;

      if (this.profile.kick[i]) scheduleKick(this.ctx, this.master, swungTime, 0.9);
      if (this.profile.hat[i]) scheduleHat(this.ctx, this.master, swungTime, this.profile.hatColorHz, 0.35);
      const bassIdx = this.profile.bass[i];
      if (bassIdx !== null && bassIdx !== undefined) {
        const freq = this.profile.rootHz * semitoneToRatio(this.profile.scale[bassIdx % this.profile.scale.length] ?? 0);
        scheduleBassNote(this.ctx, this.master, swungTime, freq, this.stepDuration * 1.7, this.profile.bassWave, 0.55);
      }

      this.nextStepTime += this.stepDuration;
      this.step++;
    }
    this.timerId = window.setTimeout(this.scheduler, LOOKAHEAD_MS);
  };

  /** Starts (or resumes) the loop. Must be called from a user gesture (e.g. a click) for browser autoplay policies. */
  async start() {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    if (this.timerId !== null) return; // already running
    this.nextStepTime = ctx.currentTime + 0.05;
    this.step = 0;
    this.startPad(ctx);
    this.scheduler();
  }

  stop() {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    for (const osc of this.padOscillators) {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
    }
    this.padOscillators = [];
  }

  dispose() {
    this.stop();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
  }
}

/**
 * Plays a real, style-matched royalty-free preview track from Pixabay Music
 * (see `src/data/pixabayTracks.ts`) — same preview-only contract as
 * `MusicPreviewEngine` above (never exported, browser speakers only).
 *
 * This gives a much more convincing "feel" for the final Reel's vibe than
 * the synthesized loop. If the network request for the MP3 fails for any
 * reason (offline, CDN hiccup, ad-blocker, etc.) it transparently falls
 * back to `MusicPreviewEngine`'s procedural loop so the feature never just
 * silently breaks.
 */
export class RealTrackPreviewPlayer {
  private audio: HTMLAudioElement | null = null;
  private fallback: MusicPreviewEngine | null = null;
  private usingFallback = false;
  readonly track = PIXABAY_TRACKS[this.style];

  constructor(private style: ReelStyle) {}

  async start() {
    if (this.usingFallback) {
      await this.fallback?.start();
      return;
    }
    if (!this.audio) {
      const el = new Audio(this.track.mp3Url);
      el.loop = true;
      el.volume = 0.55;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      this.audio = el;
    }
    try {
      await this.audio.play();
    } catch {
      // Autoplay/network/CORS issue — fall back to the synthesized loop
      // rather than leaving the preview silently silent.
      this.usingFallback = true;
      this.fallback = new MusicPreviewEngine(this.style);
      await this.fallback.start();
    }
  }

  stop() {
    if (this.usingFallback) {
      this.fallback?.stop();
      return;
    }
    this.audio?.pause();
    if (this.audio) this.audio.currentTime = 0;
  }

  dispose() {
    this.stop();
    this.audio = null;
    this.fallback?.dispose();
    this.fallback = null;
  }

  get isFallback() {
    return this.usingFallback;
  }
}
