// End-of-lesson feedback: a small set of one-tap reactions (no stars) plus an
// optional text note. This is not a vanity metric. Each reaction carries a
// pedagogical signal that feeds two things:
//   1. the learner model (pace / analogy / example density on the profile), so
//      EVERY future lesson is generated a little closer to what works for them, and
//   2. the adaptive loop, so the very next re-teach reacts to how the last one felt.

import type { LearningStyle } from "./types";

export interface Reaction {
  id: string;
  emoji: string;
  label: string;
  /** Positive sentiment (helped) vs a signal that something was off. */
  tone: "good" | "signal" | "bad";
}

/** The canonical reaction set shown under a finished lesson. */
export const REACTIONS: Reaction[] = [
  { id: "loved", emoji: "😍", label: "Loved it", tone: "good" },
  { id: "got_it", emoji: "👍", label: "Got it", tone: "good" },
  { id: "confusing", emoji: "🤔", label: "Confusing", tone: "signal" },
  { id: "too_fast", emoji: "🚀", label: "Too fast", tone: "signal" },
  { id: "too_slow", emoji: "🐢", label: "Too slow", tone: "signal" },
  { id: "not_helpful", emoji: "👎", label: "Didn't help", tone: "bad" },
];

const REACTION_IDS = new Set(REACTIONS.map((r) => r.id));

/** Keep only known reaction ids, de-duplicated. */
export function normalizeReactions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(String).filter((id) => REACTION_IDS.has(id)))];
}

const clamp3 = (n: number) => Math.max(0, Math.min(3, n));

/**
 * Turn reactions into a patch on the learner's structural preferences. Conservative
 * on purpose: one lesson's reaction nudges by a single step, it does not overwrite
 * everything. Returns an empty object when nothing should change.
 */
export function feedbackStylePatch(reactions: string[], current: LearningStyle): Partial<LearningStyle> {
  const has = (id: string) => reactions.includes(id);
  const patch: Partial<LearningStyle> = {};

  // Pace. "Too fast" and "too slow" are direct, unambiguous signals.
  if (has("too_fast")) patch.pace = "slow";
  else if (has("too_slow")) patch.pace = "fast";

  // Confusion => lean harder on concrete scaffolding: more worked examples and
  // more analogies, and ease the pace unless they explicitly said it was slow.
  if (has("confusing") || has("not_helpful")) {
    patch.examples = clamp3((current.examples ?? 1) + 1);
    patch.analogies = clamp3((current.analogies ?? 1) + 1);
    if (!has("too_slow")) patch.pace = "slow";
  }

  return patch;
}

/**
 * A short instruction for the NEXT adaptive lesson, so the re-teach responds to
 * how the last one landed. Empty when the last lesson felt fine.
 */
export function feedbackTeachingHint(reactions: string[], text?: string): string {
  const bits: string[] = [];
  if (reactions.includes("too_fast")) bits.push("The learner felt the last lesson went too fast, so slow down and take smaller steps.");
  if (reactions.includes("too_slow")) bits.push("The learner felt the last lesson dragged, so keep it tighter and move a little quicker.");
  if (reactions.includes("confusing")) bits.push("The learner found the last lesson confusing, so simplify the language and add a concrete, everyday example early.");
  if (reactions.includes("not_helpful")) bits.push("The last lesson did not help, so take a clearly different approach from before.");
  if (text && text.trim()) bits.push(`The learner wrote this about the last lesson: "${text.trim().slice(0, 300)}". Address it directly.`);
  return bits.join(" ");
}

/** Suggest a sharper delivery change when a lesson missed. */
export function feedbackWantsModeChange(reactions: string[]): boolean {
  return reactions.includes("confusing") || reactions.includes("not_helpful") || reactions.includes("too_fast");
}
