// Teaching Effectiveness Profile.
//
// The key insight this encodes: a learner does not have one fixed "learning
// style". The approach that works best CHANGES BY CONCEPT. A child might learn
// fractions best from visual models but multiplication best from repetition, so
// effectiveness is recorded per (child, skill, mode, method) rather than as a
// single global preference.
//
// Over time this becomes the most valuable thing the product knows:
//   Decimals        -> visual model 94%, guided example 88%, repetition 82%
//   Multiplication  -> repetition 96%, guided example 90%, visual 76%

import { db, newId, now } from "./db";
import type { ConcreteMode, TeachingMethod } from "./pedagogy";
import { isTeachingMethod } from "./pedagogy";

export interface TeachingOutcome {
  skill: string;
  mode: ConcreteMode;
  method: TeachingMethod;
  beforeScore?: number;
  afterScore?: number;
  successful: boolean;
}

/** Normalize a skill name so "Adding Fractions" and "adding fractions" agree. */
export function skillKey(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

/** Record how one teaching attempt actually went. */
export function recordTeachingOutcome(studentId: string, topic: string, o: TeachingOutcome): void {
  db()
    .prepare(
      `INSERT INTO teaching_outcomes
         (id, student_id, skill, topic, mode, method, before_score, after_score, successful, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      newId("tout"),
      studentId,
      skillKey(o.skill),
      topic,
      o.mode,
      o.method,
      o.beforeScore ?? null,
      o.afterScore ?? null,
      o.successful ? 1 : 0,
      now()
    );
}

export interface MethodStat {
  mode: ConcreteMode;
  method: TeachingMethod;
  attempts: number;
  wins: number;
  /** Success rate 0..100. */
  rate: number;
  /** Mean point gain from before to after, when both were recorded. */
  avgGain: number | null;
}

interface StatRow {
  mode: string;
  method: string;
  attempts: number;
  wins: number;
  avg_gain: number | null;
}

function mapStat(r: StatRow): MethodStat {
  return {
    mode: r.mode as ConcreteMode,
    method: r.method as TeachingMethod,
    attempts: r.attempts,
    wins: r.wins,
    rate: r.attempts ? Math.round((r.wins / r.attempts) * 100) : 0,
    avgGain: r.avg_gain == null ? null : Math.round(r.avg_gain),
  };
}

/** Effectiveness of each approach for one child on one skill, best first. */
export function statsForSkill(studentId: string, skill: string): MethodStat[] {
  const rows = db()
    .prepare(
      `SELECT mode, method,
              COUNT(*) AS attempts,
              SUM(successful) AS wins,
              AVG(CASE WHEN before_score IS NOT NULL AND after_score IS NOT NULL
                       THEN after_score - before_score END) AS avg_gain
         FROM teaching_outcomes
        WHERE student_id = ? AND skill = ?
        GROUP BY mode, method`
    )
    .all(studentId, skillKey(skill)) as StatRow[];
  return rows
    .map(mapStat)
    .sort((a, b) => b.rate - a.rate || b.attempts - a.attempts);
}

/**
 * The approach that has worked best for this child on this skill. Requires at
 * least one recorded success, so an untried approach is never "best" by default.
 */
export function bestForSkill(
  studentId: string,
  skill: string
): { mode: ConcreteMode; method: TeachingMethod } | null {
  const winners = statsForSkill(studentId, skill).filter((s) => s.wins > 0);
  if (!winners.length) return null;
  const top = winners[0];
  return { mode: top.mode, method: top.method };
}

/**
 * Fallback for a brand-new skill: the method that most often works for this
 * child ACROSS skills. Weaker evidence than bestForSkill, used only when the
 * skill itself has no history.
 */
export function bestOverallMethod(studentId: string): TeachingMethod | null {
  const r = db()
    .prepare(
      `SELECT method, SUM(successful) AS wins, COUNT(*) AS attempts
         FROM teaching_outcomes
        WHERE student_id = ?
        GROUP BY method
       HAVING wins > 0
        ORDER BY (CAST(wins AS REAL) / attempts) DESC, attempts DESC
        LIMIT 1`
    )
    .get(studentId) as { method: string } | undefined;
  return r && isTeachingMethod(r.method) ? r.method : null;
}

/** Every skill this child has effectiveness data for (parent/teacher view). */
export function effectivenessOverview(
  studentId: string
): { skill: string; topic?: string; stats: MethodStat[] }[] {
  const skills = db()
    .prepare(
      `SELECT skill, MAX(topic) AS topic FROM teaching_outcomes
        WHERE student_id = ? GROUP BY skill ORDER BY MAX(created_at) DESC LIMIT 40`
    )
    .all(studentId) as { skill: string; topic: string | null }[];
  return skills.map((s) => ({
    skill: s.skill,
    topic: s.topic ?? undefined,
    stats: statsForSkill(studentId, s.skill),
  }));
}
