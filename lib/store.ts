// Typed data access for courses + modules. Thin mapping over lib/db.ts rows.

import { db, newId, now, parseJson, DEFAULT_STUDENT } from "./db";
import type {
  Certificate,
  Course,
  CourseMode,
  CourseModule,
  CourseNote,
  CourseStatus,
  Explainer,
  ModuleStatus,
  Quiz,
  ResearchBrief,
} from "./types";

interface CourseRow {
  id: string;
  student_id: string;
  title: string;
  topic: string;
  goals: string;
  mode: string | null;
  doc_context: string | null;
  research: string | null;
  status: string;
  outline: string;
  created_at: number;
}

interface ModuleRow {
  id: string;
  course_id: string;
  idx: number;
  title: string;
  summary: string;
  objectives: string;
  status: string;
  explainer: string | null;
  required_quiz: string | null;
  required_assignment: string | null;
  assignment_submission: string | null;
  quiz_passed: number | null;
  assignment_passed: number | null;
  created_at: number;
  completed_at: number | null;
}

function mapModule(r: ModuleRow): CourseModule {
  return {
    id: r.id,
    courseId: r.course_id,
    idx: r.idx,
    title: r.title,
    summary: r.summary,
    objectives: parseJson<string[]>(r.objectives, []),
    status: r.status as ModuleStatus,
    explainer: r.explainer ? parseJson<Explainer | undefined>(r.explainer, undefined) : undefined,
    requiredQuiz: r.required_quiz ? parseJson<Quiz[] | undefined>(r.required_quiz, undefined) : undefined,
    requiredAssignment: r.required_assignment ? parseJson<string[] | undefined>(r.required_assignment, undefined) : undefined,
    assignmentSubmission: r.assignment_submission ? parseJson<string[] | undefined>(r.assignment_submission, undefined) : undefined,
    quizPassed: r.quiz_passed === 1,
    assignmentPassed: r.assignment_passed === 1,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
  };
}

function mapCourse(r: CourseRow, modules: CourseModule[]): Course {
  return {
    id: r.id,
    studentId: r.student_id,
    title: r.title,
    topic: r.topic,
    goals: parseJson<string[]>(r.goals, []),
    mode: (r.mode as CourseMode) === "certification" ? "certification" : "self_eval",
    docContext: r.doc_context ?? undefined,
    research: r.research ? parseJson<ResearchBrief | undefined>(r.research, undefined) : undefined,
    status: r.status as CourseStatus,
    modules,
    createdAt: r.created_at,
  };
}

// ---- create ----------------------------------------------------------------

export interface OutlineModule {
  title: string;
  summary: string;
  objectives: string[];
}

export function createCourse(input: {
  title: string;
  topic: string;
  goals: string[];
  mode?: CourseMode;
  docContext?: string;
  research?: ResearchBrief;
  outline: OutlineModule[];
  studentId?: string;
}): Course {
  const conn = db();
  const studentId = input.studentId ?? DEFAULT_STUDENT;
  const courseId = newId("course");
  const ts = now();

  const insertCourse = conn.prepare(
    `INSERT INTO courses (id, student_id, title, topic, goals, mode, doc_context, research, status, outline, created_at)
     VALUES (@id, @student_id, @title, @topic, @goals, @mode, @doc_context, @research, 'draft', @outline, @created_at)`
  );
  const insertModule = conn.prepare(
    `INSERT INTO modules (id, course_id, idx, title, summary, objectives, status, explainer, created_at, completed_at)
     VALUES (@id, @course_id, @idx, @title, @summary, @objectives, @status, NULL, @created_at, NULL)`
  );

  const tx = conn.transaction(() => {
    insertCourse.run({
      id: courseId,
      student_id: studentId,
      title: input.title,
      topic: input.topic,
      goals: JSON.stringify(input.goals),
      mode: input.mode === "certification" ? "certification" : "self_eval",
      doc_context: input.docContext ?? null,
      research: input.research ? JSON.stringify(input.research) : null,
      outline: JSON.stringify(input.outline),
      created_at: ts,
    });
    input.outline.forEach((m, i) => {
      insertModule.run({
        id: newId("mod"),
        course_id: courseId,
        idx: i,
        title: m.title,
        summary: m.summary,
        objectives: JSON.stringify(m.objectives ?? []),
        // First module is unlocked immediately once approved; here everything
        // starts locked and approve() unlocks index 0.
        status: "locked" as ModuleStatus,
        created_at: ts,
      });
    });
  });
  tx();

  return getCourse(courseId)!;
}

// ---- read ------------------------------------------------------------------

export function getCourse(id: string): Course | null {
  const conn = db();
  const row = conn.prepare(`SELECT * FROM courses WHERE id = ?`).get(id) as CourseRow | undefined;
  if (!row) return null;
  const modRows = conn
    .prepare(`SELECT * FROM modules WHERE course_id = ? ORDER BY idx ASC`)
    .all(id) as ModuleRow[];
  return mapCourse(row, modRows.map(mapModule));
}

export function listCourses(studentId = DEFAULT_STUDENT): Course[] {
  const conn = db();
  const rows = conn
    .prepare(`SELECT * FROM courses WHERE student_id = ? ORDER BY created_at DESC`)
    .all(studentId) as CourseRow[];
  return rows.map((r) => {
    const modRows = conn
      .prepare(`SELECT * FROM modules WHERE course_id = ? ORDER BY idx ASC`)
      .all(r.id) as ModuleRow[];
    return mapCourse(r, modRows.map(mapModule));
  });
}

export function getModule(id: string): CourseModule | null {
  const conn = db();
  const row = conn.prepare(`SELECT * FROM modules WHERE id = ?`).get(id) as ModuleRow | undefined;
  return row ? mapModule(row) : null;
}

// ---- mutate ----------------------------------------------------------------

export function setCourseStatus(id: string, status: CourseStatus): void {
  db().prepare(`UPDATE courses SET status = ? WHERE id = ?`).run(status, id);
}

export function setModuleStatus(id: string, status: ModuleStatus): void {
  const completedAt = status === "completed" ? now() : null;
  db()
    .prepare(`UPDATE modules SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?`)
    .run(status, completedAt, id);
}

export function saveModuleExplainer(id: string, explainer: Explainer): void {
  db()
    .prepare(`UPDATE modules SET explainer = ?, status = 'in_progress' WHERE id = ?`)
    .run(JSON.stringify(explainer), id);
}

/**
 * Approve a draft course: activate it. Self-evaluation courses unlock EVERY
 * module immediately (the learner is in control, no gating); certification
 * courses unlock only module 0 and gate the rest behind completion.
 */
export function approveCourse(id: string): Course | null {
  const course = getCourse(id);
  if (!course) return null;
  const conn = db();
  const tx = conn.transaction(() => {
    conn.prepare(`UPDATE courses SET status = 'active' WHERE id = ?`).run(id);
    if (course.mode === "self_eval") {
      conn.prepare(`UPDATE modules SET status = 'unlocked' WHERE course_id = ? AND status = 'locked'`).run(id);
    } else {
      const first = course.modules.find((m) => m.idx === 0);
      if (first) conn.prepare(`UPDATE modules SET status = 'unlocked' WHERE id = ?`).run(first.id);
    }
  });
  tx();
  return getCourse(id);
}

// ---- notes -----------------------------------------------------------------

interface NoteRow {
  id: string;
  course_id: string;
  module_id: string;
  t_ms: number;
  text: string;
  created_at: number;
}

function mapNote(r: NoteRow): CourseNote {
  return { id: r.id, courseId: r.course_id, moduleId: r.module_id, tMs: r.t_ms, text: r.text, createdAt: r.created_at };
}

export function listNotes(moduleId: string): CourseNote[] {
  const rows = db()
    .prepare(`SELECT * FROM notes WHERE module_id = ? ORDER BY t_ms ASC`)
    .all(moduleId) as NoteRow[];
  return rows.map(mapNote);
}

export function addNote(input: {
  courseId: string;
  moduleId: string;
  tMs: number;
  text: string;
  studentId?: string;
}): CourseNote {
  const id = newId("note");
  db()
    .prepare(
      `INSERT INTO notes (id, student_id, course_id, module_id, t_ms, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.studentId ?? DEFAULT_STUDENT, input.courseId, input.moduleId, Math.max(0, Math.round(input.tMs)), input.text, now());
  return { id, courseId: input.courseId, moduleId: input.moduleId, tMs: Math.max(0, Math.round(input.tMs)), text: input.text, createdAt: now() };
}

export function deleteNote(id: string): void {
  db().prepare(`DELETE FROM notes WHERE id = ?`).run(id);
}

/**
 * Mark a module complete and unlock the next one. If it was the last module,
 * flip the whole course to completed. Returns the refreshed course.
 */
export function completeModuleUnlockNext(moduleId: string): Course | null {
  const mod = getModule(moduleId);
  if (!mod) return null;
  const conn = db();
  const tx = conn.transaction(() => {
    conn
      .prepare(`UPDATE modules SET status = 'completed', completed_at = ? WHERE id = ?`)
      .run(now(), moduleId);
    const next = conn
      .prepare(`SELECT * FROM modules WHERE course_id = ? AND idx = ?`)
      .get(mod.courseId, mod.idx + 1) as ModuleRow | undefined;
    if (next) {
      if (next.status === "locked")
        conn.prepare(`UPDATE modules SET status = 'unlocked' WHERE id = ?`).run(next.id);
    } else {
      conn.prepare(`UPDATE courses SET status = 'completed' WHERE id = ?`).run(mod.courseId);
    }
  });
  tx();
  return getCourse(mod.courseId);
}

// ---- certification: module requirements + pass flags -----------------------

/** Store the predefined required quiz + assignment for a certification module. */
export function setModuleRequirements(
  moduleId: string,
  requiredQuiz: Quiz[],
  requiredAssignment: string[]
): void {
  db()
    .prepare(`UPDATE modules SET required_quiz = ?, required_assignment = ? WHERE id = ?`)
    .run(JSON.stringify(requiredQuiz), JSON.stringify(requiredAssignment), moduleId);
}

export function setModuleQuizPassed(moduleId: string, passed: boolean): void {
  db().prepare(`UPDATE modules SET quiz_passed = ? WHERE id = ?`).run(passed ? 1 : 0, moduleId);
}

export function saveAssignmentSubmission(
  moduleId: string,
  answers: string[],
  passed: boolean
): void {
  db()
    .prepare(`UPDATE modules SET assignment_submission = ?, assignment_passed = ? WHERE id = ?`)
    .run(JSON.stringify(answers), passed ? 1 : 0, moduleId);
}

// ---- certificates ----------------------------------------------------------

interface CertRow {
  id: string;
  course_id: string;
  course_title: string;
  learner_name: string;
  score: number;
  issued_at: number;
}

function mapCert(r: CertRow): Certificate {
  return {
    id: r.id,
    courseId: r.course_id,
    courseTitle: r.course_title,
    learnerName: r.learner_name,
    score: r.score,
    issuedAt: r.issued_at,
  };
}

/** Issue (or return the existing) certificate for a passed certification course. */
export function issueCertificate(input: {
  courseId: string;
  courseTitle: string;
  learnerName: string;
  score: number;
  studentId?: string;
}): Certificate {
  const conn = db();
  const studentId = input.studentId ?? DEFAULT_STUDENT;
  const existing = conn
    .prepare(`SELECT * FROM certificates WHERE course_id = ? AND student_id = ?`)
    .get(input.courseId, studentId) as CertRow | undefined;
  if (existing) {
    // Keep the best score and refresh the name.
    if (input.score > existing.score || input.learnerName !== existing.learner_name) {
      conn
        .prepare(`UPDATE certificates SET score = ?, learner_name = ? WHERE id = ?`)
        .run(Math.max(existing.score, input.score), input.learnerName, existing.id);
    }
    return mapCert(conn.prepare(`SELECT * FROM certificates WHERE id = ?`).get(existing.id) as CertRow);
  }
  const id = newId("cert");
  conn
    .prepare(
      `INSERT INTO certificates (id, student_id, course_id, course_title, learner_name, score, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, studentId, input.courseId, input.courseTitle, input.learnerName, Math.round(input.score), now());
  return mapCert(conn.prepare(`SELECT * FROM certificates WHERE id = ?`).get(id) as CertRow);
}

export function getCertificate(id: string): Certificate | null {
  const r = db().prepare(`SELECT * FROM certificates WHERE id = ?`).get(id) as CertRow | undefined;
  return r ? mapCert(r) : null;
}

export function getCertificateForCourse(courseId: string, studentId = DEFAULT_STUDENT): Certificate | null {
  const r = db()
    .prepare(`SELECT * FROM certificates WHERE course_id = ? AND student_id = ?`)
    .get(courseId, studentId) as CertRow | undefined;
  return r ? mapCert(r) : null;
}

export function listCertificates(studentId = DEFAULT_STUDENT): Certificate[] {
  const rows = db()
    .prepare(`SELECT * FROM certificates WHERE student_id = ? ORDER BY issued_at DESC`)
    .all(studentId) as CertRow[];
  return rows.map(mapCert);
}
