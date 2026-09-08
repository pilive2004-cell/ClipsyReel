import { buildStory } from "./StoryEngine";
import type {
  ClipScores,
  DSLArgument,
  DSLComparisonExpression,
  DSLComparisonOperator,
  DSLConditionalExpression,
  DSLExpression,
  DSLIdentifierValue,
  DSLInstruction,
  DSLInstructionType,
  DSLNumberValue,
  EditingClipCandidate,
  EditingInterpreterContext,
  EditingTimeline,
  ResolvedEditingInstruction,
  StoryAssignment,
  StoryPhase,
  TimelineOverlayType,
} from "./types";
import { appendOverlay, buildTimelineClip, recalculateTimeline, stableCandidateSort } from "./timeline-helpers";

const SUPPORTED_INSTRUCTIONS: readonly DSLInstructionType[] = [
  "HOOK",
  "BEST_SHOT",
  "SYNC_BEAT",
  "CUT",
  "SHOW_MAP",
  "SHOW_SPEED",
  "SHOW_ALTITUDE",
  "SHOW_LOCATION",
  "SHOW_TEXT",
  "SLOW_MOTION",
  "DRONE_REVEAL",
  "ENDING",
] as const;

export const DEFAULT_DSL_CLIP_DURATION_SECONDS = 3.4;
export const DEFAULT_DSL_HOOK_DURATION_SECONDS = 2;
export const DEFAULT_DSL_ENDING_DURATION_SECONDS = 3;

const SCORE_IDENTIFIER_MAP: Record<string, keyof ClipScores> = {
  score: "QualityScore",
  quality: "QualityScore",
  QualityScore: "QualityScore",
  action: "ActionScore",
  ActionScore: "ActionScore",
  beauty: "BeautyScore",
  BeautyScore: "BeautyScore",
  emotion: "EmotionScore",
  EmotionScore: "EmotionScore",
  stability: "StabilityScore",
  StabilityScore: "StabilityScore",
  motion: "MotionScore",
  MotionScore: "MotionScore",
  landscape: "LandscapeScore",
  LandscapeScore: "LandscapeScore",
  cinematic: "CinematicScore",
  CinematicScore: "CinematicScore",
};

function parseNumber(token: string): DSLNumberValue | null {
  const value = Number(token);
  return Number.isFinite(value) ? { kind: "number", value } : null;
}

function parseIdentifier(token: string): DSLIdentifierValue {
  return { kind: "identifier", value: token.trim() };
}

function parseComparison(source: string): DSLComparisonExpression | null {
  const match = source.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*)$/);
  if (!match) return null;
  const [, left, operator, right] = match;
  return {
    kind: "comparison",
    left: parseIdentifier(left),
    operator: operator as DSLComparisonOperator,
    right: parseNumber(right) ?? parseIdentifier(right),
  };
}

function parseExpression(source: string): DSLExpression {
  const trimmed = source.trim();
  if (trimmed.length === 0) throw new Error("Empty DSL argument is not valid.");
  if (/^if\s+/i.test(trimmed)) {
    const comparison = parseComparison(trimmed.replace(/^if\s+/i, ""));
    if (!comparison) throw new Error(`Invalid conditional DSL expression: ${source}`);
    return { kind: "conditional", condition: comparison } satisfies DSLConditionalExpression;
  }
  const comparison = parseComparison(trimmed);
  if (comparison) return comparison;
  const numeric = parseNumber(trimmed);
  if (numeric) return numeric;
  return parseIdentifier(trimmed);
}

function parseArgument(source: string): DSLArgument {
  const namedMatch = source.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
  if (namedMatch) {
    return {
      kind: "named",
      name: namedMatch[1],
      value: parseExpression(namedMatch[2]),
    };
  }
  return {
    kind: "positional",
    value: parseExpression(source),
  };
}

/**
 * Tiny hand-rolled parser for a deliberately tiny DSL.
 *
 * Keeping the grammar small and explicit makes the resulting timeline easier
 * to debug than a black-box parser-generator would for this MVP.
 */
export function parseEditingDSL(source: string): DSLInstruction[] {
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ raw: line.trim(), line: index + 1 }))
    .filter((entry) => entry.raw.length > 0)
    .map((entry) => {
      const match = entry.raw.match(/^([A-Z_]+)\((.*)\)$/);
      if (!match) throw new Error(`Invalid DSL syntax on line ${entry.line}: ${entry.raw}`);
      const instructionType = match[1] as DSLInstructionType;
      if (!SUPPORTED_INSTRUCTIONS.includes(instructionType)) {
        throw new Error(`Unknown DSL instruction on line ${entry.line}: ${instructionType}`);
      }
      const argsSource = match[2].trim();
      const args = argsSource.length === 0 ? [] : argsSource.split(",").map((part) => parseArgument(part));
      return {
        type: instructionType,
        line: entry.line,
        raw: entry.raw,
        args,
      } satisfies DSLInstruction;
    });
}

function getNamedNumberArg(args: readonly DSLArgument[], name: string): number | null {
  const argument = args.find((entry) => entry.kind === "named" && entry.name === name);
  return argument?.kind === "named" && argument.value.kind === "number" ? argument.value.value : null;
}

function getFirstPositionalArg(args: readonly DSLArgument[]): DSLExpression | null {
  const argument = args.find((entry) => entry.kind === "positional");
  return argument?.kind === "positional" ? argument.value : null;
}

function scoreValue(identifier: string, clip: EditingClipCandidate): number {
  const mapped = SCORE_IDENTIFIER_MAP[identifier];
  return mapped ? clip.scores[mapped] : 0;
}

function compareValues(left: number, operator: DSLComparisonOperator, right: number): boolean {
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  if (operator === "<=") return left <= right;
  if (operator === "==") return left === right;
  return left !== right;
}

function matchesExpression(expression: DSLExpression | null, clip: EditingClipCandidate): boolean {
  if (!expression) return true;
  if (expression.kind === "conditional") return matchesExpression(expression.condition, clip);
  if (expression.kind !== "comparison") return true;
  const left = scoreValue(expression.left.value, clip);
  const right = expression.right.kind === "number" ? expression.right.value : scoreValue(expression.right.value, clip);
  return compareValues(left, expression.operator, right);
}

function orderForSelection(candidate: EditingClipCandidate, assignmentMap: Map<string, StoryAssignment>): number {
  return assignmentMap.get(candidate.momentId)?.orderIndex ?? candidate.sequenceIndex ?? Number.MAX_SAFE_INTEGER;
}

function rankCandidates(
  candidates: readonly EditingClipCandidate[],
  assignmentMap: Map<string, StoryAssignment>,
  scorer: (candidate: EditingClipCandidate) => number
): EditingClipCandidate[] {
  return [...candidates].sort((a, b) => {
    const scoreDelta = scorer(b) - scorer(a);
    if (scoreDelta !== 0) return scoreDelta;
    const orderDelta = orderForSelection(a, assignmentMap) - orderForSelection(b, assignmentMap);
    if (orderDelta !== 0) return orderDelta;
    return a.momentId.localeCompare(b.momentId);
  });
}

function durationForPhase(phase: StoryPhase, context: EditingInterpreterContext): number {
  const profile = context.profile;
  if (!profile) {
    if (phase === "hook") return DEFAULT_DSL_HOOK_DURATION_SECONDS;
    if (phase === "ending") return DEFAULT_DSL_ENDING_DURATION_SECONDS;
    return context.defaultClipDuration ?? DEFAULT_DSL_CLIP_DURATION_SECONDS;
  }
  if (phase === "hook") return profile.clipDuration.hookSeconds;
  if (phase === "build_up") return profile.clipDuration.buildUpSeconds;
  if (phase === "climax") return profile.clipDuration.climaxSeconds;
  if (phase === "breathing_moment") return profile.clipDuration.breathingSeconds;
  if (phase === "ending") return profile.clipDuration.endingSeconds;
  return profile.clipDuration.standardSeconds;
}

function phaseForMoment(momentId: string, assignmentMap: Map<string, StoryAssignment>, fallback: StoryPhase): StoryPhase {
  return assignmentMap.get(momentId)?.phase ?? fallback;
}

function overlayNameToType(instruction: DSLInstructionType): TimelineOverlayType | null {
  if (instruction === "SHOW_MAP") return "map";
  if (instruction === "SHOW_SPEED") return "speed";
  if (instruction === "SHOW_ALTITUDE") return "altitude";
  if (instruction === "SHOW_LOCATION") return "location";
  if (instruction === "SHOW_TEXT") return "text";
  return null;
}

function selectBest(
  candidates: readonly EditingClipCandidate[],
  assignmentMap: Map<string, StoryAssignment>,
  usedMomentIds: Set<string>,
  scorer: (candidate: EditingClipCandidate) => number,
  filter?: (candidate: EditingClipCandidate) => boolean
): { candidate: EditingClipCandidate; reused: boolean } | null {
  const filtered = candidates.filter((candidate) => (filter ? filter(candidate) : true));
  const fresh = filtered.filter((candidate) => !usedMomentIds.has(candidate.momentId));
  const pool = fresh.length > 0 ? fresh : filtered;
  const ranked = rankCandidates(pool, assignmentMap, scorer);
  const candidate = ranked[0];
  if (!candidate) return null;
  return { candidate, reused: usedMomentIds.has(candidate.momentId) };
}

function attachOverlayToLatest(timeline: EditingTimeline, overlay: TimelineOverlayType): EditingTimeline {
  if (timeline.clips.length === 0) return timeline;
  const clips = [...timeline.clips];
  clips[clips.length - 1] = appendOverlay(clips[clips.length - 1], overlay);
  return { ...timeline, clips };
}

function resolveInstruction(
  instruction: DSLInstruction,
  timeline: EditingTimeline,
  resolved: Omit<ResolvedEditingInstruction, "id" | "notes">,
  notes: string[]
): EditingTimeline {
  return {
    ...timeline,
    instructions: [
      ...timeline.instructions,
      {
        ...resolved,
        id: `${instruction.type.toLowerCase()}-${instruction.line}-${timeline.instructions.length}`,
        notes,
      },
    ],
  };
}

/**
 * Interprets parsed editing instructions against scored clips to build an
 * explicit, deterministic timeline. Heuristics stay intentionally simple so
 * each chosen clip can still be explained after the fact.
 */
export function interpretEditingDSL(
  instructions: DSLInstruction[],
  clips: EditingClipCandidate[],
  context: EditingInterpreterContext = {}
): EditingTimeline {
  const candidates = stableCandidateSort(clips);
  const storyAssignments = context.storyAssignments ?? buildStory(candidates, context.gpxMoments);
  const assignmentMap = new Map(storyAssignments.map((assignment) => [assignment.momentId, assignment]));
  const usedMomentIds = new Set<string>();
  const clipCatalog = new Map(candidates.map((candidate) => [candidate.momentId, candidate]));
  const defaultTransition = context.transitionPool?.[0] ?? context.profile?.transitions.preferred[0] ?? null;

  let timeline: EditingTimeline = {
    clips: [],
    instructions: [],
    markers: [],
    totalDurationSeconds: 0,
  };

  const ensureCarrierClip = (): { candidate: EditingClipCandidate; reused: boolean } | null =>
    selectBest(candidates, assignmentMap, usedMomentIds, (candidate) => candidate.scores.BeautyScore + candidate.scores.CinematicScore, (candidate) => {
      const phase = phaseForMoment(candidate.momentId, assignmentMap, "introduction");
      return phase === "hook" || phase === "introduction" || phase === "build_up";
    });

  instructions.forEach((instruction) => {
    const positional = getFirstPositionalArg(instruction.args);
    const notes: string[] = [];

    const appendSelectedClip = (
      selection: { candidate: EditingClipCandidate; reused: boolean } | null,
      phase: StoryPhase,
      durationSeconds: number,
      extra: { slowMotion?: boolean; playbackRate?: number; note?: string } = {}
    ) => {
      if (!selection) {
        timeline = resolveInstruction(
          instruction,
          timeline,
          { type: instruction.type, line: instruction.line, momentId: null, clipIndex: null, args: instruction.args },
          ["No matching clip was available."]
        );
        return;
      }
      if (selection.reused) notes.push("Reused an existing clip because no fresh candidate matched the instruction.");
      if (extra.note) notes.push(extra.note);
      const clipPhase = phaseForMoment(selection.candidate.momentId, assignmentMap, phase);
      timeline = recalculateTimeline({
        ...timeline,
        clips: [
          ...timeline.clips,
          buildTimelineClip({
            candidate: selection.candidate,
            phase: phase === "hook" || phase === "ending" ? phase : clipPhase,
            durationSeconds,
            transitionAfter: defaultTransition,
            slowMotion: extra.slowMotion,
            playbackRate: extra.playbackRate,
            emphasis: phase === "climax" ? "climax" : phase === "hook" ? "highlight" : "normal",
            notes,
          }),
        ],
      });
      usedMomentIds.add(selection.candidate.momentId);
      timeline = resolveInstruction(
        instruction,
        timeline,
        {
          type: instruction.type,
          line: instruction.line,
          momentId: selection.candidate.momentId,
          clipIndex: timeline.clips.length - 1,
          args: instruction.args,
        },
        notes
      );
    };

    if (instruction.type === "HOOK") {
      const selection = selectBest(
        candidates,
        assignmentMap,
        usedMomentIds,
        (candidate) => candidate.scores.QualityScore * 0.45 + candidate.scores.StabilityScore * 0.25 + candidate.scores.BeautyScore * 0.2,
        (candidate) => phaseForMoment(candidate.momentId, assignmentMap, "hook") === "hook"
      );
      appendSelectedClip(selection, "hook", getNamedNumberArg(instruction.args, "duration") ?? durationForPhase("hook", context));
      return;
    }

    if (instruction.type === "BEST_SHOT") {
      const selection = selectBest(
        candidates,
        assignmentMap,
        usedMomentIds,
        (candidate) => candidate.scores.QualityScore,
        (candidate) => matchesExpression(positional, candidate)
      );
      appendSelectedClip(selection, "climax", durationForPhase("climax", context));
      return;
    }

    if (instruction.type === "CUT") {
      const cutTarget = positional?.kind === "identifier" ? positional.value : "action";
      const selection = selectBest(
        candidates,
        assignmentMap,
        usedMomentIds,
        (candidate) => scoreValue(cutTarget, candidate) * 0.75 + candidate.scores.QualityScore * 0.25,
        (candidate) => scoreValue(cutTarget, candidate) > 0
      );
      appendSelectedClip(selection, cutTarget === "action" ? "action" : "build_up", durationForPhase("build_up", context));
      return;
    }

    if (instruction.type === "DRONE_REVEAL") {
      const selection = selectBest(
        candidates,
        assignmentMap,
        usedMomentIds,
        (candidate) =>
          (candidate.cameraAngle === "drone" ? 30 : 0) +
          candidate.scores.LandscapeScore * 0.5 +
          candidate.scores.CinematicScore * 0.35 +
          candidate.scores.QualityScore * 0.15
      );
      appendSelectedClip(selection, "build_up", durationForPhase("build_up", context), { note: "Resolved as a reveal-oriented scenic beat." });
      return;
    }

    if (instruction.type === "ENDING") {
      const endingMode = positional?.kind === "identifier" ? positional.value : "bestLandscape";
      const selection = selectBest(
        candidates,
        assignmentMap,
        usedMomentIds,
        (candidate) =>
          (endingMode === "bestLandscape" ? candidate.scores.LandscapeScore * 0.55 : candidate.scores.QualityScore * 0.3) +
          candidate.scores.EmotionScore * 0.2 +
          candidate.scores.CinematicScore * 0.15 +
          candidate.scores.QualityScore * 0.1
      );
      appendSelectedClip(selection, "ending", durationForPhase("ending", context));
      return;
    }

    if (instruction.type === "SLOW_MOTION") {
      const lastClipIndex = timeline.clips.length - 1;
      const lastClip = lastClipIndex >= 0 ? timeline.clips[lastClipIndex] : null;
      const lastCandidate = lastClip ? clipCatalog.get(lastClip.momentId) ?? null : null;
      const shouldRetarget = !lastCandidate || !matchesExpression(positional, lastCandidate);
      if (shouldRetarget) {
        const selection = selectBest(
          candidates,
          assignmentMap,
          usedMomentIds,
          (candidate) => candidate.scores.ActionScore * 0.45 + candidate.scores.QualityScore * 0.35 + candidate.scores.MotionScore * 0.2,
          (candidate) => matchesExpression(positional, candidate)
        );
        appendSelectedClip(selection, "climax", durationForPhase("climax", context), {
          slowMotion: true,
          playbackRate: context.profile?.clipDuration.slowMotionRate ?? 0.72,
          note: "Slow motion was resolved against the strongest matching key moment.",
        });
      } else {
        const clipsWithSlowmo = [...timeline.clips];
        clipsWithSlowmo[lastClipIndex] = {
          ...clipsWithSlowmo[lastClipIndex],
          slowMotion: true,
          playbackRate: context.profile?.clipDuration.slowMotionRate ?? 0.72,
          notes: [...clipsWithSlowmo[lastClipIndex].notes, "Slow motion applied by DSL."],
        };
        timeline = resolveInstruction(
          instruction,
          recalculateTimeline({ ...timeline, clips: clipsWithSlowmo }),
          { type: instruction.type, line: instruction.line, momentId: clipsWithSlowmo[lastClipIndex].momentId, clipIndex: lastClipIndex, args: instruction.args },
          ["Applied slow motion to the most recent clip."]
        );
      }
      return;
    }

    if (instruction.type === "SYNC_BEAT") {
      timeline = resolveInstruction(
        instruction,
        {
          ...timeline,
          markers: [
            ...timeline.markers,
            {
              type: "beat_sync",
              timeSeconds: timeline.totalDurationSeconds,
              label: context.beatGrid?.bpm ? `Beat sync requested (${context.beatGrid.bpm} BPM)` : "Beat sync requested",
            },
          ],
        },
        { type: instruction.type, line: instruction.line, momentId: null, clipIndex: null, args: instruction.args },
        [context.beatGrid ? "Beat sync marker added." : "Beat sync requested without a beat grid; downstream rules can no-op cleanly."]
      );
      return;
    }

    const overlay = overlayNameToType(instruction.type);
    if (overlay) {
      if (timeline.clips.length === 0) {
        const carrier = ensureCarrierClip();
        if (carrier) {
          timeline = recalculateTimeline({
            ...timeline,
            clips: [
              ...timeline.clips,
              buildTimelineClip({
                candidate: carrier.candidate,
                phase: phaseForMoment(carrier.candidate.momentId, assignmentMap, "introduction"),
                durationSeconds: durationForPhase("introduction", context),
                transitionAfter: defaultTransition,
                overlays: [overlay],
                notes: [`${overlay} overlay created a carrier clip.`],
              }),
            ],
          });
          usedMomentIds.add(carrier.candidate.momentId);
          notes.push("Created a carrier clip because the overlay appeared before any clip instruction.");
          timeline = resolveInstruction(
            instruction,
            timeline,
            {
              type: instruction.type,
              line: instruction.line,
              momentId: carrier.candidate.momentId,
              clipIndex: timeline.clips.length - 1,
              args: instruction.args,
            },
            notes
          );
        } else {
          timeline = resolveInstruction(
            instruction,
            timeline,
            { type: instruction.type, line: instruction.line, momentId: null, clipIndex: null, args: instruction.args },
            ["No clip was available to carry the overlay."]
          );
        }
      } else {
        timeline = resolveInstruction(
          instruction,
          recalculateTimeline(attachOverlayToLatest(timeline, overlay)),
          {
            type: instruction.type,
            line: instruction.line,
            momentId: timeline.clips[timeline.clips.length - 1].momentId,
            clipIndex: timeline.clips.length - 1,
            args: instruction.args,
          },
          [`Attached ${overlay} overlay to the latest clip.`]
        );
      }
    }
  });

  return recalculateTimeline(timeline);
}
