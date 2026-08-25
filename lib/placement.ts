// Adaptive placement.
//
// The old diagnostic asked 14-20 fixed questions, all pitched at the grade the
// learner TYPED IN. That has two failure modes:
//
//   * a Grade 5 child actually working at Grade 2 gets everything wrong. We learn
//     "all weak" but not WHERE TO START, which is the only thing that matters.
//   * a strong child is never stretched, so we never find the ceiling.
//
// Worse, the stated grade was then stamped onto every weak area, so the initial
// misjudgement propagated into every ladder, lesson and assessment afterwards.
//
// This replaces it with staged probing: a short probe, then move UP or DOWN a
// band based on how it went, converging on the band where the learner is
// actually working. Typically 10-14 questions instead of 20, and the answer is
// a real working level rather than an assumption.

import { bandRank, parseBand, type Band } from "./gradeband";

/** Bands we can move between, easiest first. */
const LADDER: Band[] = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "undergrad"];

/** Items per probe. Small on purpose: three of these is still a short sitting. */
export const PROBE_SIZE = 5;
/** Hard cap on probes, so the sitting always ends. */
export const MAX_STAGES = 3;

/** Score windows that decide which way to move. */
const TOO_EASY = 80; // at or above -> probe higher
const TOO_HARD = 40; // below -> probe lower

export interface PlacementStage {
  stage: number;
  band: Band;
  score: number;
  /** Item ids asked at this stage, so we never repeat one. */
  aspects: string[];
}

export interface PlacementState {
  topic: string;
  /** What the learner (or parent) said. */
  statedBand: Band;
  /** Where we are probing right now. */
  currentBand: Band;
  stages: PlacementStage[];
  /** Set once probing has converged. */
  workingBand?: Band;
  done: boolean;
}

export function startPlacement(topic: string, level?: string): PlacementState {
  const stated = parseBand(level) ?? "5";
  return { topic, statedBand: stated, currentBand: stated, stages: [], done: false };
}

function step(band: Band, delta: number): Band {
  const i = LADDER.findIndex((b) => b === band);
  if (i === -1) return band;
  return LADDER[Math.max(0, Math.min(LADDER.length - 1, i + delta))];
}

export const bandLabel = (b: Band): string =>
  b === "K" ? "Kindergarten" : b === "undergrad" ? "undergraduate" : b === "adult" ? "adult" : `Grade ${b}`;

export interface PlacementDecision {
  /** Continue probing at this band, or null when placement is finished. */
  nextBand: Band | null;
  workingBand: Band;
  done: boolean;
  /** Why we moved, for the results screen and for debugging. */
  reason: string;
}

/**
 * Decide what to do after a probe.
 *
 * Converges when a probe lands in the middle window (the learner can do some of
 * it but not all, which is exactly where teaching should start), when we run out
 * of bands, or when the stage budget is spent.
 */
export function decideNext(state: PlacementState, score: number): PlacementDecision {
  const band = state.currentBand;
  const stagesDone = state.stages.length;
  const atFloor = bandRank(band) <= bandRank("K");
  const atCeiling = band === "undergrad";

  // Landed in the productive middle: this is the working level.
  if (score >= TOO_HARD && score < TOO_EASY) {
    return { nextBand: null, workingBand: band, done: true, reason: `Working level found at ${bandLabel(band)}.` };
  }

  if (stagesDone >= MAX_STAGES) {
    // Out of budget. Take the best evidence we have rather than guessing high:
    // if the last probe was too hard, place one band below it.
    const wb = score < TOO_HARD ? step(band, -1) : band;
    return { nextBand: null, workingBand: wb, done: true, reason: `Placed at ${bandLabel(wb)}.` };
  }

  if (score >= TOO_EASY) {
    if (atCeiling) return { nextBand: null, workingBand: band, done: true, reason: `Already working at the top band.` };
    const up = step(band, 1);
    return { nextBand: up, workingBand: up, done: false, reason: `That was comfortable, so let's try ${bandLabel(up)}.` };
  }

  // score < TOO_HARD
  if (atFloor) return { nextBand: null, workingBand: "K", done: true, reason: `Starting from the very beginning.` };
  const down = step(band, -1);
  return { nextBand: down, workingBand: down, done: false, reason: `Let's find the right starting point at ${bandLabel(down)}.` };
}

/** Aspects already probed, so later stages ask about different things. */
export function askedAspects(state: PlacementState): string[] {
  return [...new Set(state.stages.flatMap((s) => s.aspects))];
}

/**
 * How many questions the learner has answered so far, for the progress meter.
 * Upper bound is deliberately shown as an estimate, not a promise, because
 * placement stops as soon as it has converged.
 */
export function progress(state: PlacementState): { asked: number; estimatedTotal: number } {
  const asked = state.stages.length * PROBE_SIZE;
  const remaining = state.done ? 0 : Math.min(MAX_STAGES - state.stages.length, 1) * PROBE_SIZE;
  return { asked, estimatedTotal: asked + remaining };
}
