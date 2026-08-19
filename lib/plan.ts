// The daily study plan.
//
// A child should not have to decide what to study. The system builds a short,
// time-boxed plan every day and orders it by what actually matters:
//   1. skills at risk of being forgotten (protect what was already learned)
//   2. current weak skills (close the gaps)
//   3. new material (make progress)
//   4. a challenge (keep it enjoyable for skills already mastered)

import { listDueReviews, listWeakAreas } from "./adaptive";
import type { WeakArea } from "./types";
import type { TeachingMode } from "./pedagogy";

export type PlanKind = "review" | "practice" | "learn" | "challenge";

export interface PlanItem {
  kind: PlanKind;
  /** Minutes this should take. */
  minutes: number;
  emoji: string;
  /** Child-facing title, e.g. "Quick Review". */
  title: string;
  /** What they'll actually work on. */
  skill: string;
  /** The weak-area id to open. */
  weakAreaId: string;
  /** Mode to request when opening it. */
  mode: TeachingMode;
  /** One line of why this is here. */
  why: string;
}

const KIND_META: Record<PlanKind, { emoji: string; title: string; minutes: number; mode: TeachingMode }> = {
  review: { emoji: "🟢", title: "Quick Review", minutes: 3, mode: "practice" },
  practice: { emoji: "🔵", title: "Strengthen a Skill", minutes: 8, mode: "auto" },
  learn: { emoji: "🟣", title: "Learn Something New", minutes: 7, mode: "auto" },
  challenge: { emoji: "🟠", title: "Fun Challenge", minutes: 4, mode: "challenge" },
};

function item(kind: PlanKind, area: WeakArea, why: string): PlanItem {
  const m = KIND_META[kind];
  return {
    kind,
    minutes: m.minutes,
    emoji: m.emoji,
    title: m.title,
    skill: area.aspect,
    weakAreaId: area.id,
    mode: m.mode,
    why,
  };
}

/**
 * Build today's plan. Caps at four items so it always feels finishable, and
 * never repeats the same skill twice in one day.
 */
export function buildDailyPlan(studentId: string): PlanItem[] {
  const due = listDueReviews(studentId);
  const all = listWeakAreas(studentId);
  const used = new Set<string>();
  const plan: PlanItem[] = [];

  const take = (kind: PlanKind, area: WeakArea | undefined, why: string) => {
    if (!area || used.has(area.id) || plan.length >= 4) return;
    used.add(area.id);
    plan.push(item(kind, area, why));
  };

  // 1. Protect what is fading.
  take("review", due[0], "You learned this before. A quick check keeps it from fading.");

  // 2. The weakest skill still to be learned.
  const weak = all.filter((w) => w.status !== "mastered").sort((a, b) => a.mastery - b.mastery);
  take("practice", weak[0], "This is the skill that will help you most right now.");

  // 3. Something new (the next unstarted skill).
  take("learn", weak.find((w) => w.mastery === 0 && !used.has(w.id)) ?? weak[1], "Time to add something new.");

  // 4. Finish on something enjoyable, using a skill they own.
  const mastered = all.filter((w) => w.status === "mastered");
  take("challenge", mastered[0], "You have this one. Let's make it interesting.");

  // A second review is better filler than nothing at all.
  if (plan.length < 3) take("review", due[1], "One more quick refresher.");

  return plan;
}

export function planTotalMinutes(plan: PlanItem[]): number {
  return plan.reduce((n, p) => n + p.minutes, 0);
}
