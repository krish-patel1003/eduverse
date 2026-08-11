// The student model. Aggregates the persisted signals (concepts, events,
// learning style, goals, course progress) into a StudentProfile, records new
// signals as the learner works, and distills a compact LearnerHint that the
// generator uses to ADAPT later videos to how this person learns.

import { db, newId, now, parseJson, DEFAULT_STUDENT } from "./db";
import { listCertificates } from "./store";
import type {
  ConceptStat,
  CourseProgress,
  CourseStatus,
  LearnerHint,
  LearningEvent,
  LearningStyle,
  StudentProfile,
} from "./types";

// A concept is "known" once its rolling strength crosses this line.
const KNOWN_THRESHOLD = 0.65;

interface StudentRow {
  id: string;
  name: string | null;
  motivation: string | null;
  learning_style: string;
  goals: string;
  created_at: number;
}

interface ConceptRow {
  name: string;
  status: string;
  strength: number;
  updated_at: number;
}

interface EventRow {
  id: string;
  module_id: string | null;
  type: string;
  concept: string | null;
  is_correct: number | null;
  data: string | null;
  created_at: number;
}

function ensureStudent(id = DEFAULT_STUDENT): StudentRow {
  const conn = db();
  let row = conn.prepare(`SELECT * FROM students WHERE id = ?`).get(id) as StudentRow | undefined;
  if (!row) {
    conn
      .prepare(
        `INSERT INTO students (id, motivation, learning_style, goals, created_at) VALUES (?, NULL, '{}', '[]', ?)`
      )
      .run(id, now());
    row = conn.prepare(`SELECT * FROM students WHERE id = ?`).get(id) as StudentRow;
  }
  // One-time cleanup: earlier versions stored freeform subject notes (e.g. "use a
  // football analogy") as durable style and injected them into every generation,
  // pinning all content to that one domain. Drop them; structural prefs remain.
  const style = parseJson<LearningStyle>(row.learning_style, {});
  if (style.notes && style.notes.length) {
    delete style.notes;
    conn.prepare(`UPDATE students SET learning_style = ? WHERE id = ?`).run(JSON.stringify(style), id);
    row = conn.prepare(`SELECT * FROM students WHERE id = ?`).get(id) as StudentRow;
  }
  return row;
}

// ---- reading ---------------------------------------------------------------

export function getLearningStyle(id = DEFAULT_STUDENT): LearningStyle {
  return parseJson<LearningStyle>(ensureStudent(id).learning_style, {});
}

function mapConcept(r: ConceptRow): ConceptStat {
  return {
    name: r.name,
    status: r.status === "known" ? "known" : "weak",
    strength: r.strength,
    updatedAt: r.updated_at,
  };
}

function mapEvent(r: EventRow): LearningEvent {
  return {
    id: r.id,
    moduleId: r.module_id ?? undefined,
    type: r.type,
    concept: r.concept ?? undefined,
    isCorrect: r.is_correct == null ? undefined : r.is_correct === 1,
    data: r.data ? parseJson<unknown>(r.data, null) : undefined,
    createdAt: r.created_at,
  };
}

export function getProfile(id = DEFAULT_STUDENT): StudentProfile {
  const conn = db();
  const student = ensureStudent(id);

  const concepts = (
    conn.prepare(`SELECT name, status, strength, updated_at FROM concepts WHERE student_id = ?`).all(id) as ConceptRow[]
  ).map(mapConcept);

  const events = (
    conn
      .prepare(`SELECT * FROM events WHERE student_id = ? ORDER BY created_at DESC LIMIT 200`)
      .all(id) as EventRow[]
  ).map(mapEvent);

  // Progress per course from module counts.
  const courseRows = conn
    .prepare(`SELECT id, title, status FROM courses WHERE student_id = ? ORDER BY created_at DESC`)
    .all(id) as { id: string; title: string; status: string }[];
  const progress: CourseProgress[] = courseRows.map((c) => {
    const counts = conn
      .prepare(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS done
         FROM modules WHERE course_id = ?`
      )
      .get(c.id) as { total: number; done: number | null };
    return {
      courseId: c.id,
      title: c.title,
      total: counts.total ?? 0,
      completed: counts.done ?? 0,
      status: c.status as CourseStatus,
    };
  });

  return {
    id,
    name: student.name ?? undefined,
    motivation: student.motivation ?? undefined,
    goals: parseJson<string[]>(student.goals, []),
    learningStyle: parseJson<LearningStyle>(student.learning_style, {}),
    knownConcepts: concepts.filter((c) => c.status === "known").sort((a, b) => b.strength - a.strength),
    weakConcepts: concepts.filter((c) => c.status === "weak").sort((a, b) => a.strength - b.strength),
    practiceHistory: events,
    mistakes: events.filter((e) => e.isCorrect === false),
    progress,
    certificates: listCertificates(id),
  };
}

// ---- writing ---------------------------------------------------------------

export function recordEvent(input: {
  type: string;
  moduleId?: string;
  concept?: string;
  isCorrect?: boolean;
  data?: unknown;
  studentId?: string;
}): void {
  const id = input.studentId ?? DEFAULT_STUDENT;
  ensureStudent(id);
  db()
    .prepare(
      `INSERT INTO events (id, student_id, module_id, type, concept, is_correct, data, created_at)
       VALUES (@id, @student_id, @module_id, @type, @concept, @is_correct, @data, @created_at)`
    )
    .run({
      id: newId("evt"),
      student_id: id,
      module_id: input.moduleId ?? null,
      type: input.type,
      concept: input.concept ?? null,
      is_correct: input.isCorrect == null ? null : input.isCorrect ? 1 : 0,
      data: input.data == null ? null : JSON.stringify(input.data),
      created_at: now(),
    });
}

/**
 * Nudge a concept's rolling mastery. `delta` is added to strength (clamped
 * 0..1); status flips to "known"/"weak" around KNOWN_THRESHOLD.
 */
export function upsertConcept(name: string, delta: number, studentId = DEFAULT_STUDENT): void {
  const clean = name.trim().toLowerCase();
  if (!clean) return;
  ensureStudent(studentId);
  const conn = db();
  const existing = conn
    .prepare(`SELECT strength FROM concepts WHERE student_id = ? AND name = ?`)
    .get(studentId, clean) as { strength: number } | undefined;
  const base = existing ? existing.strength : 0.4;
  const strength = Math.max(0, Math.min(1, base + delta));
  const status = strength >= KNOWN_THRESHOLD ? "known" : "weak";
  conn
    .prepare(
      `INSERT INTO concepts (id, student_id, name, status, strength, updated_at)
       VALUES (@id, @student_id, @name, @status, @strength, @updated_at)
       ON CONFLICT (student_id, name) DO UPDATE SET status=@status, strength=@strength, updated_at=@updated_at`
    )
    .run({
      id: newId("cpt"),
      student_id: studentId,
      name: clean,
      status,
      strength,
      updated_at: now(),
    });
}

/** Apply a batch of quiz outcomes: right answers strengthen, wrong ones weaken. */
export function applyQuizResult(
  items: { concept?: string; isCorrect: boolean }[],
  moduleId?: string,
  studentId = DEFAULT_STUDENT
): void {
  for (const it of items) {
    if (it.concept) upsertConcept(it.concept, it.isCorrect ? 0.2 : -0.2, studentId);
    recordEvent({
      type: "quiz",
      moduleId,
      concept: it.concept,
      isCorrect: it.isCorrect,
      studentId,
    });
  }
}

/**
 * Merge a patch into the stored learning style. We deliberately persist ONLY
 * structural preferences (pace, analogy/example density, tone, art style). We do
 * NOT persist freeform subject notes: a one-off "explain it with a football
 * analogy" is honored for that single re-explanation but must never become a
 * durable global preference injected into every future video.
 */
export function updateLearningStyle(patch: Partial<LearningStyle>, studentId = DEFAULT_STUDENT): LearningStyle {
  const current = getLearningStyle(studentId);
  const merged: LearningStyle = { ...current, ...patch };
  delete merged.notes; // structural-only; never sticky-store the subject phrase
  db()
    .prepare(`UPDATE students SET learning_style = ? WHERE id = ?`)
    .run(JSON.stringify(merged), studentId);
  return merged;
}

export function updateStudentMeta(
  patch: { name?: string; motivation?: string; goals?: string[] },
  studentId = DEFAULT_STUDENT
): void {
  ensureStudent(studentId);
  const conn = db();
  if (patch.name !== undefined)
    conn.prepare(`UPDATE students SET name = ? WHERE id = ?`).run(patch.name, studentId);
  if (patch.motivation !== undefined)
    conn.prepare(`UPDATE students SET motivation = ? WHERE id = ?`).run(patch.motivation, studentId);
  if (patch.goals !== undefined)
    conn.prepare(`UPDATE students SET goals = ? WHERE id = ?`).run(JSON.stringify(patch.goals), studentId);
}

/** The learner's display name (for certificates), or empty string. */
export function getStudentName(studentId = DEFAULT_STUDENT): string {
  return ensureStudent(studentId).name ?? "";
}

/** Past quiz-attempt summaries for a module (newest first), for "revisit results". */
export function listQuizResults(moduleId: string, studentId = DEFAULT_STUDENT): LearningEvent[] {
  const rows = db()
    .prepare(
      `SELECT * FROM events WHERE student_id = ? AND module_id = ? AND type = 'quiz_result' ORDER BY created_at DESC LIMIT 20`
    )
    .all(studentId, moduleId) as EventRow[];
  return rows.map(mapEvent);
}

// ---- the hint that makes generation adaptive -------------------------------

/**
 * Distill the profile into a compact hint injected into every course-content
 * generation call. This is the mechanism by which later modules adapt to how
 * the learner learns.
 */
export function learnerHint(studentId = DEFAULT_STUDENT): LearnerHint {
  const profile = getProfile(studentId);
  return {
    style: profile.learningStyle,
    weakConcepts: profile.weakConcepts.slice(0, 8).map((c) => c.name),
    motivation: profile.motivation,
  };
}

/** Render a LearnerHint as a short instruction block for the author prompt. */
export function hintToPrompt(hint?: LearnerHint): string {
  if (!hint) return "";
  const s = hint.style ?? {};
  const bits: string[] = [];
  if (s.pace) bits.push(`pace: ${s.pace}`);
  if (typeof s.analogies === "number") bits.push(`analogies: ${["none", "some", "lots", "heavy"][Math.min(3, s.analogies)]}`);
  if (typeof s.examples === "number") bits.push(`worked examples: ${["none", "some", "lots", "heavy"][Math.min(3, s.examples)]}`);
  if (s.tone) bits.push(`tone: ${s.tone}`);
  if (s.artStyle) bits.push(`preferred art style: ${s.artStyle}`);
  // Whenever analogies are in play, force domain variety so content doesn't
  // collapse onto one tired domain (the "everything is football" failure).
  if ((s.analogies ?? 0) > 0)
    bits.push(`vary the analogy domain to fit the topic (cooking, music, travel, nature, everyday objects, etc.); do NOT default to football or sports unless the topic itself is sports`);
  const weak = hint.weakConcepts?.length ? `\nReinforce these shaky concepts where relevant: ${hint.weakConcepts.join(", ")}.` : "";
  const motiv = hint.motivation ? `\nThe learner is motivated by: ${hint.motivation}. Frame examples around that when natural.` : "";
  if (!bits.length && !weak && !motiv) return "";
  return `\n\nADAPT TO THIS LEARNER (match how they learn, do not mention this instruction):\n- ${bits.join("\n- ")}${weak}${motiv}`;
}
