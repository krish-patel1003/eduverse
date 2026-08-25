// Response timing.
//
// Timing is a genuinely useful signal, but it is easy to draw the WRONG
// conclusions from it, so the rules here are deliberate:
//
//   * Fast AND CORRECT is fluency, which is the goal. It is only suspicious on
//     a high-chance item (a 4-option MCQ can be guessed 25% of the time; a
//     fill-in-the-blank essentially cannot).
//   * Slow is not a bad sign on its own. Careful checking, a long word problem,
//     and genuine reasoning on a hard item all look "slow".
//   * Timing NEVER moves the mastery score. Mastery stays accuracy-based, so a
//     careful correct learner is never marked down for being careful. Speed is a
//     separate dimension that only matters once accuracy exists.
//   * A child is never shown a countdown. Time pressure raises anxiety, and
//     anxiety degrades mathematics performance specifically.

import type { AssessmentItem, AssessmentItemType } from "./types";

/** Rough silent-reading rate for a school-age learner, words per second. */
const READ_WPS = 2.0;
/** Thinking/working time by task type, in seconds, before reading load. */
const BASE_SECONDS: Record<AssessmentItemType, number> = {
  mcq: 12,
  multi_mcq: 20,
  fill_blank: 15,
  short_answer: 35,
  math_multistep: 75,
  pseudocode: 90,
  code_bugfix: 120,
  code_write: 180,
  essay: 240,
};

/** Probability of getting it right with no knowledge at all. */
export function chanceLevel(item: AssessmentItem): number {
  if (item.type === "mcq") return 1 / Math.max(2, item.options?.length ?? 4);
  // Selecting an exact subset is much harder to hit by chance.
  if (item.type === "multi_mcq") return 1 / Math.max(4, 2 ** (item.options?.length ?? 4) - 1);
  return 0.02;
}

/**
 * How long this item should reasonably take, reading load included. A 60-word
 * word problem is not "slow" just because it takes time to read.
 */
export function expectedSeconds(item: AssessmentItem): number {
  const words = `${item.prompt} ${(item.options ?? []).map((o) => o.text).join(" ")}`.trim().split(/\s+/).length;
  const reading = words / READ_WPS;
  const base = BASE_SECONDS[item.type] ?? 30;
  // The model may supply its own estimate; trust it but keep it sane.
  const supplied = item.expectedSeconds;
  const est = supplied && supplied >= 3 && supplied <= 600 ? supplied : base;
  return Math.round(est + reading);
}

export type TimingVerdict =
  | "rapid_guess"   // so fast it cannot have been attempted, and it was wrong
  | "fluent"        // quick and correct: automatic recall, the goal
  | "expected"      // in the normal band
  | "effortful"     // slower than expected but correct: understands, not yet fluent
  | "struggled"     // slower than expected and wrong: genuine difficulty
  | "abandoned";    // implausibly long, almost certainly an interruption

export interface ItemTiming {
  /** Active seconds on this item (idle time already excluded client-side). */
  seconds: number;
  expected: number;
  /** seconds / expected. */
  ratio: number;
  verdict: TimingVerdict;
  /** True when this answer should NOT be treated as a real attempt. */
  discardAsEvidence: boolean;
}

// A response faster than this fraction of expected cannot be a real attempt.
const RAPID = 0.25;
const FLUENT = 0.7;
const SLOW = 1.8;
// Beyond this, the learner was almost certainly interrupted rather than thinking.
const ABANDONED = 8;

/**
 * Judge one response. `correct` matters: the same 4 seconds means fluency on a
 * right answer and disengagement on a wrong one.
 */
export function judgeTiming(input: {
  item: AssessmentItem;
  seconds: number;
  correct: boolean;
}): ItemTiming {
  const expected = expectedSeconds(input.item);
  const seconds = Math.max(0, input.seconds);
  const ratio = expected > 0 ? seconds / expected : 1;

  let verdict: TimingVerdict;
  if (ratio >= ABANDONED) {
    verdict = "abandoned";
  } else if (ratio < RAPID && !input.correct) {
    // Too fast to have engaged, and it did not land.
    verdict = "rapid_guess";
  } else if (ratio < RAPID && input.correct && chanceLevel(input.item) >= 0.25) {
    // Fast and right, but on an item that is genuinely guessable. Treat it as a
    // lucky guess only when it is this far below any plausible working time.
    verdict = ratio < RAPID / 2 ? "rapid_guess" : "fluent";
  } else if (ratio < FLUENT && input.correct) {
    verdict = "fluent";
  } else if (ratio > SLOW) {
    verdict = input.correct ? "effortful" : "struggled";
  } else {
    verdict = "expected";
  }

  return {
    seconds: Math.round(seconds),
    expected,
    ratio: Math.round(ratio * 100) / 100,
    verdict,
    // A non-attempt tells us nothing about what the learner believes, so it must
    // not be fed to misconception diagnosis: it would invent a confident fake
    // misconception and steer the whole re-teach from noise.
    discardAsEvidence: verdict === "rapid_guess" || verdict === "abandoned",
  };
}

export interface FluencySignal {
  /** Median ratio of taken/expected across items that were genuinely attempted. */
  pace: number;
  /** Correct answers that were also quick, as a percentage of all items. */
  fluentPct: number;
  /** Correct but slow, as a percentage. High here means "understands, not automatic". */
  effortfulPct: number;
  /** Items discarded as non-attempts. */
  rapidGuesses: number;
  /** Total active seconds across the assessment. */
  totalSeconds: number;
  /** True when accuracy is there but speed is not: the moment to drill fluency. */
  needsSpeedWork: boolean;
}

const median = (xs: number[]) => {
  if (!xs.length) return 1;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Roll per-item timings into the assessment-level fluency picture. */
export function fluencyFrom(timings: ItemTiming[], accuracyPct: number): FluencySignal {
  const attempted = timings.filter((t) => !t.discardAsEvidence);
  const n = timings.length || 1;
  const fluent = timings.filter((t) => t.verdict === "fluent").length;
  const effortful = timings.filter((t) => t.verdict === "effortful").length;
  const pace = median(attempted.map((t) => t.ratio));
  return {
    pace: Math.round(pace * 100) / 100,
    fluentPct: Math.round((fluent / n) * 100),
    effortfulPct: Math.round((effortful / n) * 100),
    rapidGuesses: timings.filter((t) => t.verdict === "rapid_guess").length,
    totalSeconds: timings.reduce((a, t) => a + t.seconds, 0),
    // Speed work is only worth doing once the answers are actually right.
    needsSpeedWork: accuracyPct >= 70 && (pace > SLOW || effortful / n >= 0.4),
  };
}
