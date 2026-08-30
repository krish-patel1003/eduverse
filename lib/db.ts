// Server-side SQLite persistence for the learning platform.
//
// Everything that must survive a refresh (courses, module unlock progress, the
// student profile, practice history) lives here. One implicit student ("me")
// for now, but every row carries student_id so real accounts can come later.
//
// The connection is a process-wide singleton stashed on globalThis so Next.js
// dev hot-reload doesn't open a new handle (and re-run migrations) on every
// edit.

import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";
import { CCSSM } from "./ccssm";

// DATA_DIR lets the deploy point the DB at a writable path (e.g. /tmp on Cloud
// Run, where Litestream replicates it to GCS). Defaults to ./data locally.
const DB_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "eduverse.db");

export const DEFAULT_STUDENT = "me";

type G = typeof globalThis & { __eduverseDb?: Database.Database };
const g = globalThis as G;

function open(): Database.Database {
  mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id            TEXT PRIMARY KEY,
      motivation    TEXT,
      learning_style TEXT NOT NULL DEFAULT '{}',
      goals         TEXT NOT NULL DEFAULT '[]',
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id          TEXT PRIMARY KEY,
      student_id  TEXT NOT NULL,
      title       TEXT NOT NULL,
      topic       TEXT NOT NULL,
      goals       TEXT NOT NULL DEFAULT '[]',
      doc_context TEXT,
      status      TEXT NOT NULL DEFAULT 'draft',
      outline     TEXT NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS modules (
      id           TEXT PRIMARY KEY,
      course_id    TEXT NOT NULL,
      idx          INTEGER NOT NULL,
      title        TEXT NOT NULL,
      summary      TEXT NOT NULL DEFAULT '',
      objectives   TEXT NOT NULL DEFAULT '[]',
      status       TEXT NOT NULL DEFAULT 'locked',
      explainer    TEXT,
      created_at   INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id         TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      name       TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'weak',
      strength   REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      UNIQUE (student_id, name)
    );

    CREATE TABLE IF NOT EXISTS events (
      id         TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      module_id  TEXT,
      type       TEXT NOT NULL,
      concept    TEXT,
      is_correct INTEGER,
      data       TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_id  TEXT NOT NULL,
      module_id  TEXT NOT NULL,
      t_ms       INTEGER NOT NULL DEFAULT 0,
      text       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_modules_course ON modules (course_id, idx);
    CREATE INDEX IF NOT EXISTS idx_events_student ON events (student_id, created_at);
    CREATE TABLE IF NOT EXISTS certificates (
      id           TEXT PRIMARY KEY,
      student_id   TEXT NOT NULL,
      course_id    TEXT NOT NULL,
      course_title TEXT NOT NULL,
      learner_name TEXT NOT NULL,
      score        INTEGER NOT NULL DEFAULT 0,
      issued_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      pass_hash  TEXT NOT NULL,
      salt       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    -- Adaptive Tutor: diagnostic + recursive mastery loop.
    CREATE TABLE IF NOT EXISTS weak_areas (
      id         TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      topic      TEXT NOT NULL,
      aspect     TEXT NOT NULL,
      domain     TEXT NOT NULL DEFAULT 'general',
      level      TEXT,
      mastery    REAL NOT NULL DEFAULT 0,
      status     TEXT NOT NULL DEFAULT 'weak',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diagnostics (
      id          TEXT PRIMARY KEY,
      student_id  TEXT NOT NULL,
      topic       TEXT NOT NULL,
      level       TEXT,
      domain      TEXT NOT NULL DEFAULT 'general',
      items       TEXT NOT NULL DEFAULT '[]',
      answers     TEXT,
      per_aspect  TEXT,
      overall     INTEGER,
      rank        TEXT,
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS adaptive_sessions (
      id          TEXT PRIMARY KEY,
      student_id  TEXT NOT NULL,
      weak_area_id TEXT NOT NULL,
      topic       TEXT NOT NULL,
      aspect      TEXT NOT NULL,
      domain      TEXT NOT NULL DEFAULT 'general',
      status      TEXT NOT NULL DEFAULT 'teaching',
      rounds      TEXT NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    -- Teaching Effectiveness Profile: which (mode, method) actually produced
    -- learning, per child AND per skill. The best approach is not a fixed
    -- "learning style"; it changes by concept, so it is keyed by skill.
    CREATE TABLE IF NOT EXISTS teaching_outcomes (
      id          TEXT PRIMARY KEY,
      student_id  TEXT NOT NULL,
      skill       TEXT NOT NULL,
      topic       TEXT,
      mode        TEXT NOT NULL,
      method      TEXT NOT NULL,
      before_score INTEGER,
      after_score  INTEGER,
      successful  INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    -- Prerequisite graph. Ladders are expensive to generate and identical for
    -- every learner at the same skill + subject + grade band, so they are cached
    -- and shared. The accumulated rows form the prerequisite graph.
    CREATE TABLE IF NOT EXISTS prereq_ladders (
      id         TEXT PRIMARY KEY,
      skill_key  TEXT NOT NULL,
      subject    TEXT NOT NULL,
      band       TEXT NOT NULL,
      steps      TEXT NOT NULL DEFAULT '[]',
      uses       INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE (skill_key, subject, band)
    );

    -- The curriculum spine. "Grade 4 mathematics" as free text is a guess;
    -- 4.NBT.B.5 is a specific, sequenced, nationally recognised skill a parent
    -- or teacher can look up.
    CREATE TABLE IF NOT EXISTS standards (
      code    TEXT PRIMARY KEY,
      subject TEXT NOT NULL DEFAULT 'math',
      grade   TEXT NOT NULL,
      domain  TEXT NOT NULL,
      cluster TEXT NOT NULL,
      skill   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_standards_grade ON standards (subject, grade);
    CREATE INDEX IF NOT EXISTS idx_teachout_skill ON teaching_outcomes (student_id, skill);
    CREATE INDEX IF NOT EXISTS idx_concepts_student ON concepts (student_id);
    CREATE INDEX IF NOT EXISTS idx_notes_module ON notes (module_id, t_ms);
    CREATE INDEX IF NOT EXISTS idx_certs_student ON certificates (student_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_weak_student ON weak_areas (student_id);
    CREATE INDEX IF NOT EXISTS idx_diag_student ON diagnostics (student_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_adapt_student ON adaptive_sessions (student_id, created_at);
  `);

  // Additive migrations for columns older DBs may lack. Each is idempotent.
  const hasCol = (table: string, col: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col);
  const addCol = (table: string, col: string, ddl: string) => {
    if (!hasCol(table, col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  addCol("courses", "research", "research TEXT");
  addCol("courses", "mode", "mode TEXT NOT NULL DEFAULT 'self_eval'");
  addCol("students", "name", "name TEXT");
  addCol("modules", "required_quiz", "required_quiz TEXT");
  addCol("modules", "required_assignment", "required_assignment TEXT");
  addCol("modules", "assignment_submission", "assignment_submission TEXT");
  addCol("modules", "quiz_passed", "quiz_passed INTEGER NOT NULL DEFAULT 0");
  addCol("modules", "assignment_passed", "assignment_passed INTEGER NOT NULL DEFAULT 0");
  // Adaptive Tutor: learner demographics on the student profile.
  addCol("students", "age", "age INTEGER");
  addCol("students", "gender", "gender TEXT");
  addCol("students", "education_level", "education_level TEXT");
  // Spaced repetition on weak areas: mastery fades, so mastered skills come back
  // for a short review before they are forgotten.
  addCol("weak_areas", "interval_days", "interval_days REAL NOT NULL DEFAULT 0");
  addCol("weak_areas", "ease", "ease REAL NOT NULL DEFAULT 2.3");
  addCol("weak_areas", "due_at", "due_at INTEGER");
  addCol("weak_areas", "reviews", "reviews INTEGER NOT NULL DEFAULT 0");
  // Child profiles: a `students` row is now a learner owned by a user account.
  // owner_id links a child to its parent/guardian user; the legacy per-user
  // student row (id == user id) becomes that user's first child.
  addCol("students", "owner_id", "owner_id TEXT");
  addCol("students", "avatar", "avatar TEXT");
  addCol("students", "xp", "xp INTEGER NOT NULL DEFAULT 0");
  addCol("students", "streak", "streak INTEGER NOT NULL DEFAULT 0");
  // Last day the learner did anything, so the streak can be extended or reset.
  addCol("students", "last_active_at", "last_active_at INTEGER");
  // Opt-in to the slower, higher-fidelity drawn lessons in the adaptive loop.
  addCol("students", "hifi", "hifi INTEGER NOT NULL DEFAULT 0");
  // Adaptive placement: staged probing state carried across a diagnostic, plus
  // the working band it converged on (which may differ from the stated grade).
  addCol("diagnostics", "placement", "placement TEXT");
  addCol("diagnostics", "working_band", "working_band TEXT");
  // Per-item evidence from the diagnostic. Not for re-diagnosis (the skill
  // context differs) but for the cold-start method prior, which is about HOW the
  // learner answers rather than what they answered about.
  addCol("diagnostics", "evidence", "evidence TEXT");
  // Learner-facing review, accumulated ACROSS placement stages. Each stage
  // replaces the stored assessment, so without this the review would only ever
  // show the final probe rather than everything they answered.
  addCol("diagnostics", "review", "review TEXT");
  // Backfill: every existing account's self-student becomes its own first child.
  db.exec(`UPDATE students SET owner_id = id WHERE owner_id IS NULL AND id IN (SELECT id FROM users)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_students_owner ON students (owner_id)`);

  // Seed the curriculum spine. Idempotent: re-running updates the text in place
  // so edits to the seed file propagate without a migration.
  try {
    const ins = db.prepare(
      `INSERT INTO standards (code, subject, grade, domain, cluster, skill)
       VALUES (?, 'math', ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET grade=excluded.grade, domain=excluded.domain,
         cluster=excluded.cluster, skill=excluded.skill`
    );
    db.transaction(() => {
      for (const r of CCSSM) ins.run(r.code, r.grade, r.domain, r.cluster, r.skill);
    })();
  } catch (err) {
    console.warn("standards seed skipped:", (err as Error)?.message);
  }

  // Ensure the single implicit student exists.
  db.prepare(
    `INSERT OR IGNORE INTO students (id, motivation, learning_style, goals, created_at)
     VALUES (?, NULL, '{}', '[]', ?)`
  ).run(DEFAULT_STUDENT, Date.now());
}

export function db(): Database.Database {
  if (!g.__eduverseDb) g.__eduverseDb = open();
  return g.__eduverseDb;
}

// ---- id + time helpers -----------------------------------------------------

export function newId(prefix = "id"): string {
  try {
    return `${prefix}_${(globalThis.crypto as Crypto).randomUUID()}`;
  } catch {
    return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

export const now = (): number => Date.now();

// Safe JSON parse for text columns.
export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
