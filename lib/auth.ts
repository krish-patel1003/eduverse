// App-local accounts + sessions. Passwords are hashed with Node's built-in
// scrypt (no external dependency), sessions are opaque ids stored server-side
// and referenced by an httpOnly cookie. Each user owns a `students` row whose
// id equals the user id, so all existing per-student data (profile, courses,
// concepts, certificates) is naturally scoped once we pass that id through.

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { db, newId, now, DEFAULT_STUDENT } from "./db";

export const SESSION_COOKIE = "sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface User {
  id: string;
  email: string;
}

interface UserRow {
  id: string;
  email: string;
  pass_hash: string;
  salt: string;
  created_at: number;
}

// ---- password hashing ------------------------------------------------------

function hash(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verify(password: string, expected: string, salt: string): boolean {
  const got = Buffer.from(hash(password, salt), "hex");
  const exp = Buffer.from(expected, "hex");
  return got.length === exp.length && timingSafeEqual(got, exp);
}

// ---- users -----------------------------------------------------------------

export function findUserByEmail(email: string): UserRow | undefined {
  return db().prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase().trim()) as
    | UserRow
    | undefined;
}

/** Create a user + its matching students row. Throws if the email is taken. */
export function createUser(email: string, password: string): User {
  const clean = email.toLowerCase().trim();
  if (findUserByEmail(clean)) throw new Error("An account with that email already exists.");
  const salt = randomBytes(16).toString("hex");
  const id = newId("user");
  const ts = now();
  const conn = db();
  const tx = conn.transaction(() => {
    conn
      .prepare(`INSERT INTO users (id, email, pass_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, clean, hash(password, salt), salt, ts);
    // Each account is its own student scope.
    conn
      .prepare(
        `INSERT OR IGNORE INTO students (id, motivation, learning_style, goals, created_at)
         VALUES (?, NULL, '{}', '[]', ?)`
      )
      .run(id, ts);
  });
  tx();
  return { id, email: clean };
}

export function authenticate(email: string, password: string): User | null {
  const row = findUserByEmail(email);
  if (!row) return null;
  return verify(password, row.pass_hash, row.salt) ? { id: row.id, email: row.email } : null;
}

export function getUser(id: string): User | null {
  const r = db().prepare(`SELECT id, email FROM users WHERE id = ?`).get(id) as
    | { id: string; email: string }
    | undefined;
  return r ?? null;
}

// ---- sessions --------------------------------------------------------------

export function createSession(userId: string): { id: string; expiresAt: number } {
  const id = newId("sess");
  const expiresAt = now() + SESSION_TTL_MS;
  db().prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).run(id, userId, expiresAt);
  return { id, expiresAt };
}

export function destroySession(sid: string): void {
  db().prepare(`DELETE FROM sessions WHERE id = ?`).run(sid);
}

function userIdForSession(sid: string): string | null {
  const row = db().prepare(`SELECT user_id, expires_at FROM sessions WHERE id = ?`).get(sid) as
    | { user_id: string; expires_at: number }
    | undefined;
  if (!row) return null;
  if (row.expires_at < now()) {
    destroySession(sid);
    return null;
  }
  return row.user_id;
}

// ---- request helpers -------------------------------------------------------

/** The logged-in user's id from the session cookie, or null. */
export function currentUserId(req: NextRequest): string | null {
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  return sid ? userIdForSession(sid) : null;
}

export function currentUser(req: NextRequest): User | null {
  const id = currentUserId(req);
  return id ? getUser(id) : null;
}

/**
 * Which student scope this request reads/writes. Logged-in users get their own
 * id; anonymous requests (e.g. the quick-chat) fall back to the shared default
 * student, preserving pre-accounts behavior.
 */
export function currentStudentId(req: NextRequest): string {
  return currentUserId(req) ?? DEFAULT_STUDENT;
}

export const sessionCookieOptions = (expiresAt: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false, // localhost; enable behind HTTPS in production
  path: "/",
  expires: new Date(expiresAt),
});
