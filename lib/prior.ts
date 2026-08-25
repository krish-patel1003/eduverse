// Cold-start method prior.
//
// A brand-new learner has no teaching history, so bestForSkill() returns null
// and the router falls back to a generic default. But the diagnostic they just
// sat already contains method-relevant evidence we were throwing away:
//
//   * items WITH a figure vs WITHOUT     -> is this learner helped by visuals?
//   * recognition (mcq) vs production    -> can they recognise but not execute?
//   * consistency across similar items   -> is this a fluency problem?
//   * blank vs attempted                 -> is this a confidence problem?
//
// None of it needs an extra model call. It turns the very first assessment into
// a real starting hypothesis instead of a coin flip.

import type { AnswerEvidence, ErrorType } from "./types";
import type { ConcreteMode, TeachingMethod } from "./pedagogy";

export interface MethodPrior {
  mode: ConcreteMode;
  method: TeachingMethod;
  /** Why, for the parent view and for debugging. */
  reason: string;
  /** 0..1, how strongly the evidence supports this. */
  confidence: number;
}

const RECOGNITION = new Set(["mcq", "multi_mcq"]);
const PRODUCTION = new Set(["short_answer", "math_multistep", "essay", "pseudocode", "code_write"]);

const pct = (xs: AnswerEvidence[]) => (xs.length ? xs.filter((e) => e.correct).length / xs.length : 0);

/**
 * Error types map directly onto a teaching approach. This is the link between
 * "we know what went wrong" and "we know how to teach it".
 */
export const ERROR_TO_APPROACH: Record<ErrorType, { mode: ConcreteMode; method: TeachingMethod; why: string }> = {
  procedural_slip: { mode: "practice", method: "kumon", why: "the method is known, execution needs to become automatic" },
  concept_gap: { mode: "show_me", method: "singapore", why: "the idea itself needs building from concrete to abstract" },
  prerequisite_gap: { mode: "step_by_step", method: "mastery", why: "an earlier skill has to be secured first" },
  cannot_justify: { mode: "explain_why", method: "japanese", why: "the answer is there but the reasoning is not" },
  transfer_failure: { mode: "challenge", method: "russian", why: "routine work is solid, novel problems need deeper reasoning" },
  notation_error: { mode: "step_by_step", method: "fading", why: "the understanding is there, the writing of it needs modelling" },
  guessing: { mode: "step_by_step", method: "mastery", why: "there is no method yet to build on" },
};

/** The most common error type in the evidence, if there is a clear one. */
export function dominantErrorType(evidence: AnswerEvidence[]): ErrorType | null {
  const counts = new Map<ErrorType, number>();
  for (const e of evidence) {
    if (!e.correct && e.errorType) counts.set(e.errorType, (counts.get(e.errorType) ?? 0) + 1);
  }
  if (!counts.size) return null;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [top, n] = sorted[0];
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  // Only call it dominant if it is at least 40% of the classified errors.
  return n / total >= 0.4 ? top : null;
}

/**
 * Read a starting hypothesis out of how the learner answered. Returns null when
 * the evidence is too thin or too ambiguous to justify one, in which case the
 * router keeps its normal defaults.
 */
export function methodPriorFrom(evidence: AnswerEvidence[]): MethodPrior | null {
  if (evidence.length < 4) return null;

  const withFig = evidence.filter((e) => e.hadVisual);
  const noFig = evidence.filter((e) => !e.hadVisual);
  const recog = evidence.filter((e) => RECOGNITION.has(e.type));
  const produce = evidence.filter((e) => PRODUCTION.has(e.type));
  const blanks = evidence.filter((e) => !e.learnerAnswer || !e.learnerAnswer.trim()).length;

  // 1. Figures clearly help. Strongest and most actionable signal we have.
  if (withFig.length >= 2 && noFig.length >= 2 && pct(withFig) - pct(noFig) >= 0.34) {
    return {
      mode: "show_me",
      method: "singapore",
      reason: "you did markedly better on questions that had a picture or model",
      confidence: Math.min(1, pct(withFig) - pct(noFig) + 0.3),
    };
  }

  // 2. Can pick the right answer but cannot produce one: model it, then fade.
  if (recog.length >= 2 && produce.length >= 2 && pct(recog) - pct(produce) >= 0.34) {
    return {
      mode: "step_by_step",
      method: "fading",
      reason: "you could recognise correct answers but not produce them unaided",
      confidence: Math.min(1, pct(recog) - pct(produce) + 0.25),
    };
  }

  // 3. Lots of blanks: this is a confidence and entry-point problem.
  if (blanks / evidence.length >= 0.4) {
    return {
      mode: "step_by_step",
      method: "mastery",
      reason: "you left a few questions blank, so we will start smaller and build up",
      confidence: 0.6,
    };
  }

  // 4. A clear dominant error type.
  const dom = dominantErrorType(evidence);
  if (dom) {
    const a = ERROR_TO_APPROACH[dom];
    return { mode: a.mode, method: a.method, reason: a.why, confidence: 0.55 };
  }

  return null;
}
