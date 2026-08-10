// Typed data access for courses + modules. Thin mapping over lib/db.ts rows.

import { db, newId, now, parseJson, DEFAULT_STUDENT } from "./db";
import type {
  Course,
  CourseModule,
  CourseNote,
  CourseStatus,
  Explainer,
  ModuleStatus,
  ResearchBrief,
} from "./types";

interface CourseRow {
  id: string;
  student_id: string;
  title: string;
  topic: string;
  goals: string;
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
    `INSERT INTO courses (id, student_id, title, topic, goals, doc_context, research, status, outline, created_at)
     VALUES (@id, @student_id, @title, @topic, @goals, @doc_context, @research, 'draft', @outline, @created_at)`
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

/** Approve a draft course: activate it and unlock the first module. */
export function approveCourse(id: string): Course | null {
  const course = getCourse(id);
  if (!course) return null;
  const conn = db();
  const tx = conn.transaction(() => {
    conn.prepare(`UPDATE courses SET status = 'active' WHERE id = ?`).run(id);
    const first = course.modules.find((m) => m.idx === 0);
    if (first) conn.prepare(`UPDATE modules SET status = 'unlocked' WHERE id = ?`).run(first.id);
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
