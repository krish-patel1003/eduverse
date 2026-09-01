// Guided learning paths.
//
// There are two legitimate reasons to open the tutor, and they want opposite
// behaviour:
//
//   "I don't know where I stand"  -> run a diagnostic, find the weak spots.
//   "Teach me Measurement and Data" -> there is nothing to discover. The
//                                      curriculum already says what the skills
//                                      are and what order they go in.
//
// A path is the second case. It skips placement entirely and walks the standards
// of one domain in sequence, unlocking the next only when the current one is
// mastered, because a curriculum IS a sequence and letting a learner jump to
// angle arithmetic before they can measure an angle helps nobody.

import { db, newId, now } from "./db";
import { listStandards, type Standard } from "./standards";
import { getWeakArea, upsertWeakArea } from "./adaptive";

export type StepStatus = "locked" | "available" | "done";

export interface PathStep {
  id: string;
  idx: number;
  standardCode: string;
  title: string;
  weakAreaId?: string;
  status: StepStatus;
  completedAt?: number;
  /** Live mastery of the linked weak area, when one exists. */
  mastery?: number;
}

export interface LearningPath {
  id: string;
  subject: string;
  grade: string;
  domain: string;
  steps: PathStep[];
  doneCount: number;
  total: number;
  createdAt: number;
}

interface PathRow { id: string; subject: string; grade: string; domain: string; created_at: number }
interface StepRow {
  id: string; idx: number; standard_code: string; title: string;
  weak_area_id: string | null; status: string; completed_at: number | null;
}

function mapSteps(pathId: string): PathStep[] {
  const rows = db()
    .prepare(`SELECT * FROM path_steps WHERE path_id = ? ORDER BY idx`)
    .all(pathId) as StepRow[];
  return rows.map((r) => ({
    id: r.id,
    idx: r.idx,
    standardCode: r.standard_code,
    title: r.title,
    weakAreaId: r.weak_area_id ?? undefined,
    status: r.status as StepStatus,
    completedAt: r.completed_at ?? undefined,
    mastery: r.weak_area_id ? getWeakArea(r.weak_area_id)?.mastery : undefined,
  }));
}

function hydrate(p: PathRow): LearningPath {
  const steps = mapSteps(p.id);
  return {
    id: p.id,
    subject: p.subject,
    grade: p.grade,
    domain: p.domain,
    steps,
    doneCount: steps.filter((s) => s.status === "done").length,
    total: steps.length,
    createdAt: p.created_at,
  };
}

export function getPath(id: string, studentId: string): LearningPath | null {
  const r = db()
    .prepare(`SELECT * FROM paths WHERE id = ? AND student_id = ?`)
    .get(id, studentId) as PathRow | undefined;
  return r ? hydrate(r) : null;
}

export function listPaths(studentId: string): LearningPath[] {
  const rows = db()
    .prepare(`SELECT * FROM paths WHERE student_id = ? ORDER BY created_at DESC`)
    .all(studentId) as PathRow[];
  return rows.map(hydrate);
}

/**
 * Start (or reopen) a path for one domain. Idempotent: asking twice returns the
 * same path with its progress intact rather than restarting the learner.
 */
export function startPath(input: {
  studentId: string;
  subject?: string;
  grade: string;
  domain: string;
}): LearningPath | null {
  const subject = input.subject ?? "math";
  const existing = db()
    .prepare(`SELECT * FROM paths WHERE student_id = ? AND subject = ? AND grade = ? AND domain = ?`)
    .get(input.studentId, subject, input.grade, input.domain) as PathRow | undefined;
  if (existing) return hydrate(existing);

  const standards = listStandards(input.grade, subject).filter((s) => s.domain === input.domain);
  if (!standards.length) return null;

  const id = newId("path");
  const ts = now();
  const insPath = db().prepare(
    `INSERT INTO paths (id, student_id, subject, grade, domain, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insStep = db().prepare(
    `INSERT INTO path_steps (id, path_id, idx, standard_code, title, status) VALUES (?, ?, ?, ?, ?, ?)`
  );
  db().transaction(() => {
    insPath.run(id, input.studentId, subject, input.grade, input.domain, ts);
    standards.forEach((s: Standard, i) => {
      // Only the first step opens; the rest unlock as each is mastered.
      insStep.run(newId("step"), id, i, s.code, s.skill, i === 0 ? "available" : "locked");
    });
  })();
  return getPath(id, input.studentId);
}

/**
 * Begin a step: create the weak area the tutor teaches against, and link it.
 * Returns the weak-area id to open, or null when the step is still locked.
 */
export function openStep(pathId: string, stepId: string, studentId: string): string | null {
  const path = getPath(pathId, studentId);
  if (!path) return null;
  const step = path.steps.find((s) => s.id === stepId);
  if (!step || step.status === "locked") return null;
  if (step.weakAreaId) return step.weakAreaId;

  const area = upsertWeakArea({
    studentId,
    topic: path.domain,
    aspect: step.title,
    domain: "math",
    level: path.grade === "K" ? "Kindergarten" : `Grade ${path.grade}`,
    // Starts unknown rather than weak: on a guided path we have not claimed the
    // learner is bad at this, only that it is next.
    mastery: 0,
  });
  db().prepare(`UPDATE path_steps SET weak_area_id = ? WHERE id = ?`).run(area.id, stepId);
  return area.id;
}

/**
 * Called after any assessment. If the weak area belongs to a path step and the
 * learner has mastered it, complete that step and unlock the next one.
 */
export function advancePathFor(weakAreaId: string, mastered: boolean): void {
  if (!mastered) return;
  const step = db()
    .prepare(`SELECT id, path_id, idx FROM path_steps WHERE weak_area_id = ?`)
    .get(weakAreaId) as { id: string; path_id: string; idx: number } | undefined;
  if (!step) return;

  db().transaction(() => {
    db()
      .prepare(`UPDATE path_steps SET status = 'done', completed_at = ? WHERE id = ?`)
      .run(now(), step.id);
    db()
      .prepare(
        `UPDATE path_steps SET status = 'available'
          WHERE path_id = ? AND idx = ? AND status = 'locked'`
      )
      .run(step.path_id, step.idx + 1);
  })();
}
