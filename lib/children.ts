// Child profiles. A parent/guardian account (a `users` row) owns one or more
// learners (`students` rows). Every piece of learning data (weak areas, adaptive
// sessions, diagnostics, mastery, feedback) is already keyed by student_id, so
// selecting the active child and threading its id through currentStudentId()
// scopes the whole app to that child automatically.

import { db, newId, now } from "./db";

export interface Child {
  id: string;
  name: string;
  age?: number;
  educationLevel?: string;
  avatar: string;
  xp: number;
  streak: number;
  createdAt: number;
}

// A friendly default avatar set (kid-facing). Assigned round-robin on create.
export const CHILD_AVATARS = ["🦊", "🐼", "🦉", "🐙", "🦋", "🐬", "🦕", "🐨", "🦁", "🐢", "🦄", "🐧"];

interface ChildRow {
  id: string;
  name: string | null;
  age: number | null;
  education_level: string | null;
  avatar: string | null;
  xp: number | null;
  streak: number | null;
  created_at: number;
}

function mapChild(r: ChildRow, i = 0): Child {
  return {
    id: r.id,
    name: r.name?.trim() || `Learner ${i + 1}`,
    age: r.age ?? undefined,
    educationLevel: r.education_level ?? undefined,
    avatar: r.avatar || CHILD_AVATARS[i % CHILD_AVATARS.length],
    xp: r.xp ?? 0,
    streak: r.streak ?? 0,
    createdAt: r.created_at,
  };
}

/** All children owned by a user, oldest first (the first child is the default). */
export function listChildren(ownerId: string): Child[] {
  const rows = db()
    .prepare(
      `SELECT id, name, age, education_level, avatar, xp, streak, created_at
       FROM students WHERE owner_id = ? ORDER BY created_at ASC`
    )
    .all(ownerId) as ChildRow[];
  return rows.map((r, i) => mapChild(r, i));
}

export function getChild(id: string): Child | null {
  const r = db()
    .prepare(
      `SELECT id, name, age, education_level, avatar, xp, streak, created_at FROM students WHERE id = ?`
    )
    .get(id) as ChildRow | undefined;
  return r ? mapChild(r) : null;
}

/** True when `childId` is a profile owned by `ownerId` (authorization guard). */
export function childBelongsTo(childId: string, ownerId: string): boolean {
  const r = db().prepare(`SELECT 1 FROM students WHERE id = ? AND owner_id = ?`).get(childId, ownerId);
  return !!r;
}

/**
 * The user's default (first) child. Guarantees at least one profile exists: if
 * the account somehow has none, the legacy self-student (id == userId) is
 * adopted as the first child so nothing breaks.
 */
export function defaultChildId(ownerId: string): string {
  const first = db()
    .prepare(`SELECT id FROM students WHERE owner_id = ? ORDER BY created_at ASC LIMIT 1`)
    .get(ownerId) as { id: string } | undefined;
  if (first) return first.id;
  // Adopt / create the self-student as the first child.
  const ts = now();
  db()
    .prepare(
      `INSERT INTO students (id, owner_id, learning_style, goals, created_at)
       VALUES (?, ?, '{}', '[]', ?)
       ON CONFLICT(id) DO UPDATE SET owner_id = excluded.owner_id`
    )
    .run(ownerId, ownerId, ts);
  return ownerId;
}

export function createChild(
  ownerId: string,
  input: { name: string; age?: number; educationLevel?: string; avatar?: string }
): Child {
  const count = (db().prepare(`SELECT COUNT(*) c FROM students WHERE owner_id = ?`).get(ownerId) as { c: number }).c;
  const id = newId("kid");
  const avatar = input.avatar && input.avatar.trim() ? input.avatar.trim().slice(0, 8) : CHILD_AVATARS[count % CHILD_AVATARS.length];
  db()
    .prepare(
      `INSERT INTO students (id, owner_id, name, age, education_level, avatar, learning_style, goals, xp, streak, created_at)
       VALUES (?, ?, ?, ?, ?, ?, '{}', '[]', 0, 0, ?)`
    )
    .run(
      id,
      ownerId,
      input.name.trim().slice(0, 80) || `Learner ${count + 1}`,
      input.age ?? null,
      input.educationLevel?.trim().slice(0, 60) ?? null,
      avatar,
      now()
    );
  return getChild(id)!;
}

/**
 * Delete a child and all its learning data. Refuses to remove the account's last
 * profile (there must always be an active child).
 */
export function deleteChild(id: string, ownerId: string): { ok: boolean; reason?: string } {
  if (!childBelongsTo(id, ownerId)) return { ok: false, reason: "not_found" };
  const count = (db().prepare(`SELECT COUNT(*) c FROM students WHERE owner_id = ?`).get(ownerId) as { c: number }).c;
  if (count <= 1) return { ok: false, reason: "last_child" };
  const conn = db();
  const tx = conn.transaction(() => {
    // Course-owned modules first (keyed by course_id), then everything keyed by student_id.
    conn.prepare(`DELETE FROM modules WHERE course_id IN (SELECT id FROM courses WHERE student_id = ?)`).run(id);
    for (const t of ["courses", "weak_areas", "adaptive_sessions", "diagnostics", "concepts", "certificates", "notes", "events"]) {
      conn.prepare(`DELETE FROM ${t} WHERE student_id = ?`).run(id);
    }
    conn.prepare(`DELETE FROM students WHERE id = ?`).run(id);
  });
  tx();
  return { ok: true };
}

/** XP / streak helpers for the gamification phase (safe to call now). */
export function addXp(id: string, amount: number): void {
  db().prepare(`UPDATE students SET xp = COALESCE(xp,0) + ? WHERE id = ?`).run(Math.max(0, Math.round(amount)), id);
}

// A tiny convenience the profile pages can use to know the active child cheaply.
export function childSummary(id: string): { name: string; avatar: string } | null {
  const c = getChild(id);
  return c ? { name: c.name, avatar: c.avatar } : null;
}

/** Whether this child has opted into slower, higher-fidelity drawn lessons. */
export function getHiFi(id: string): boolean {
  const r = db().prepare(`SELECT hifi FROM students WHERE id = ?`).get(id) as { hifi: number | null } | undefined;
  return !!r?.hifi;
}

export function setHiFi(id: string, on: boolean): void {
  db().prepare(`UPDATE students SET hifi = ? WHERE id = ?`).run(on ? 1 : 0, id);
}
