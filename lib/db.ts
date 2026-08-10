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

const DB_DIR = path.join(process.cwd(), "data");
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
    CREATE INDEX IF NOT EXISTS idx_concepts_student ON concepts (student_id);
    CREATE INDEX IF NOT EXISTS idx_notes_module ON notes (module_id, t_ms);
  `);

  // Additive migration: research brief cached on the course (older DBs lack it).
  const courseCols = db.prepare(`PRAGMA table_info(courses)`).all() as { name: string }[];
  if (!courseCols.some((c) => c.name === "research")) {
    db.exec(`ALTER TABLE courses ADD COLUMN research TEXT`);
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
