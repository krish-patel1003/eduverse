// Data access for the Adaptive Tutor: diagnostics, diagnosed weak areas, and the
// recursive teach->assess session records. Thin typed mapping over lib/db.ts.

import { db, newId, now, parseJson, DEFAULT_STUDENT } from "./db";
import type {
  Assessment,
  AssessmentDomain,
  AssessmentResult,
  Diagnostic,
  Explainer,
  WeakArea,
} from "./types";

// ---- weak areas ------------------------------------------------------------

const MASTERED = 0.8; // mastery >= this counts as mastered

interface WeakRow {
  id: string;
  topic: string;
  aspect: string;
  domain: string;
  level: string | null;
  mastery: number;
  status: string;
  updated_at: number;
}

function mapWeak(r: WeakRow): WeakArea {
  return {
    id: r.id,
    topic: r.topic,
    aspect: r.aspect,
    domain: (r.domain as AssessmentDomain) || "general",
    level: r.level ?? undefined,
    mastery: r.mastery,
    status: r.status as WeakArea["status"],
    updatedAt: r.updated_at,
  };
}

export function listWeakAreas(studentId = DEFAULT_STUDENT): WeakArea[] {
  const rows = db()
    .prepare(`SELECT * FROM weak_areas WHERE student_id = ? ORDER BY mastery ASC, updated_at DESC`)
    .all(studentId) as WeakRow[];
  return rows.map(mapWeak);
}

export function getWeakArea(id: string): WeakArea | null {
  const r = db().prepare(`SELECT * FROM weak_areas WHERE id = ?`).get(id) as WeakRow | undefined;
  return r ? mapWeak(r) : null;
}

/** Insert or update a weak area for (topic, aspect); returns it. */
export function upsertWeakArea(input: {
  studentId?: string;
  topic: string;
  aspect: string;
  domain: AssessmentDomain;
  level?: string;
  mastery: number;
}): WeakArea {
  const studentId = input.studentId ?? DEFAULT_STUDENT;
  const conn = db();
  const existing = conn
    .prepare(`SELECT * FROM weak_areas WHERE student_id = ? AND topic = ? AND aspect = ?`)
    .get(studentId, input.topic, input.aspect) as WeakRow | undefined;
  const mastery = Math.max(0, Math.min(1, input.mastery));
  const status = mastery >= MASTERED ? "mastered" : mastery > 0.3 ? "learning" : "weak";
  const ts = now();
  if (existing) {
    conn
      .prepare(`UPDATE weak_areas SET domain=?, level=?, mastery=?, status=?, updated_at=? WHERE id=?`)
      .run(input.domain, input.level ?? existing.level, mastery, status, ts, existing.id);
    return getWeakArea(existing.id)!;
  }
  const id = newId("weak");
  conn
    .prepare(
      `INSERT INTO weak_areas (id, student_id, topic, aspect, domain, level, mastery, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, studentId, input.topic, input.aspect, input.domain, input.level ?? null, mastery, status, ts, ts);
  return getWeakArea(id)!;
}

export function setWeakAreaMastery(id: string, mastery: number): WeakArea | null {
  const m = Math.max(0, Math.min(1, mastery));
  const status = m >= MASTERED ? "mastered" : m > 0.3 ? "learning" : "weak";
  db().prepare(`UPDATE weak_areas SET mastery=?, status=?, updated_at=? WHERE id=?`).run(m, status, now(), id);
  return getWeakArea(id);
}

// ---- diagnostics -----------------------------------------------------------

interface DiagRow {
  id: string;
  topic: string;
  level: string | null;
  domain: string;
  items: string;
  answers: string | null;
  per_aspect: string | null;
  overall: number | null;
  rank: string | null;
  status: string;
  created_at: number;
}

function mapDiag(r: DiagRow): Diagnostic {
  return {
    id: r.id,
    topic: r.topic,
    level: r.level ?? undefined,
    domain: (r.domain as AssessmentDomain) || "general",
    perAspect: parseJson<{ aspect: string; score: number }[]>(r.per_aspect, []),
    overall: r.overall ?? 0,
    rank: r.rank ?? "",
    status: r.status as Diagnostic["status"],
    createdAt: r.created_at,
  };
}

/** Persist a freshly-generated diagnostic (open, ungraded). Stores the full assessment. */
export function createDiagnostic(assessment: Assessment, studentId = DEFAULT_STUDENT): string {
  const id = newId("diag");
  db()
    .prepare(
      `INSERT INTO diagnostics (id, student_id, topic, level, domain, items, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
    )
    .run(id, studentId, assessment.topic, assessment.level ?? null, assessment.domain, JSON.stringify(assessment), now());
  return id;
}

/** The stored assessment for a diagnostic (with the answer keys, server-side only). */
export function getDiagnosticAssessment(id: string): { studentId: string; assessment: Assessment } | null {
  const r = db().prepare(`SELECT student_id, items FROM diagnostics WHERE id = ?`).get(id) as
    | { student_id: string; items: string }
    | undefined;
  if (!r) return null;
  return { studentId: r.student_id, assessment: parseJson<Assessment>(r.items, {} as Assessment) };
}

export function saveDiagnosticResult(id: string, result: AssessmentResult, rank: string): void {
  db()
    .prepare(
      `UPDATE diagnostics SET answers = ?, per_aspect = ?, overall = ?, rank = ?, status = 'graded' WHERE id = ?`
    )
    .run(JSON.stringify(result.perItem), JSON.stringify(result.perAspect), result.overall, rank, id);
}

export function listDiagnostics(studentId = DEFAULT_STUDENT): Diagnostic[] {
  const rows = db()
    .prepare(`SELECT * FROM diagnostics WHERE student_id = ? AND status = 'graded' ORDER BY created_at DESC`)
    .all(studentId) as DiagRow[];
  return rows.map(mapDiag);
}

// ---- adaptive sessions (teach -> assess loop) ------------------------------

export interface AdaptiveRound {
  round: number;
  explainerId?: string;
  taughtAspects: string[];
  overall?: number;
  passed?: boolean;
  weakAspects?: string[];
  at: number;
}

interface AdaptiveRow {
  id: string;
  student_id: string;
  weak_area_id: string;
  topic: string;
  aspect: string;
  domain: string;
  status: string;
  rounds: string;
  created_at: number;
  updated_at: number;
}

export interface AdaptiveSession {
  id: string;
  studentId: string;
  weakAreaId: string;
  topic: string;
  aspect: string;
  domain: AssessmentDomain;
  status: "teaching" | "assessing" | "mastered" | "paused";
  rounds: AdaptiveRound[];
  /** The current teaching explainer (kept out of the row; stored inline in rounds' last explainer). */
  createdAt: number;
  updatedAt: number;
}

function mapAdaptive(r: AdaptiveRow): AdaptiveSession {
  return {
    id: r.id,
    studentId: r.student_id,
    weakAreaId: r.weak_area_id,
    topic: r.topic,
    aspect: r.aspect,
    domain: (r.domain as AssessmentDomain) || "general",
    status: r.status as AdaptiveSession["status"],
    rounds: parseJson<AdaptiveRound[]>(r.rounds, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createAdaptiveSession(input: {
  studentId?: string;
  weakAreaId: string;
  topic: string;
  aspect: string;
  domain: AssessmentDomain;
}): AdaptiveSession {
  const id = newId("adapt");
  const ts = now();
  db()
    .prepare(
      `INSERT INTO adaptive_sessions (id, student_id, weak_area_id, topic, aspect, domain, status, rounds, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'teaching', '[]', ?, ?)`
    )
    .run(id, input.studentId ?? DEFAULT_STUDENT, input.weakAreaId, input.topic, input.aspect, input.domain, ts, ts);
  return getAdaptiveSession(id)!;
}

export function getAdaptiveSession(id: string): AdaptiveSession | null {
  const r = db().prepare(`SELECT * FROM adaptive_sessions WHERE id = ?`).get(id) as AdaptiveRow | undefined;
  return r ? mapAdaptive(r) : null;
}

/** The active (unfinished) session for a weak area, if any. */
export function activeSessionForWeakArea(weakAreaId: string): AdaptiveSession | null {
  const r = db()
    .prepare(`SELECT * FROM adaptive_sessions WHERE weak_area_id = ? AND status != 'mastered' ORDER BY created_at DESC LIMIT 1`)
    .get(weakAreaId) as AdaptiveRow | undefined;
  return r ? mapAdaptive(r) : null;
}

export function updateAdaptiveSession(id: string, patch: { status?: AdaptiveSession["status"]; rounds?: AdaptiveRound[] }): void {
  const conn = db();
  if (patch.rounds) conn.prepare(`UPDATE adaptive_sessions SET rounds = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(patch.rounds), now(), id);
  if (patch.status) conn.prepare(`UPDATE adaptive_sessions SET status = ?, updated_at = ? WHERE id = ?`).run(patch.status, now(), id);
}

// The teaching explainer for a session's latest round is cached separately so we
// don't bloat the rounds JSON with base64 audio; keyed by explainer id in a tiny map table reuse: store on events.
export function saveSessionExplainer(sessionId: string, explainer: Explainer): void {
  db()
    .prepare(`INSERT INTO events (id, student_id, module_id, type, data, created_at) VALUES (?, '', ?, 'adaptive_explainer', ?, ?)`)
    .run(newId("evt"), sessionId, JSON.stringify(explainer), now());
}

export function getSessionExplainer(sessionId: string): Explainer | null {
  const r = db()
    .prepare(`SELECT data FROM events WHERE module_id = ? AND type = 'adaptive_explainer' ORDER BY created_at DESC LIMIT 1`)
    .get(sessionId) as { data: string } | undefined;
  return r ? parseJson<Explainer>(r.data, {} as Explainer) : null;
}

// The current post-video assessment for a session (with answer keys), stored
// server-side between GET (generate) and POST (grade).
export function saveSessionAssessment(sessionId: string, assessment: Assessment): void {
  db()
    .prepare(`INSERT INTO events (id, student_id, module_id, type, data, created_at) VALUES (?, '', ?, 'adaptive_assessment', ?, ?)`)
    .run(newId("evt"), sessionId, JSON.stringify(assessment), now());
}

export function getSessionAssessment(sessionId: string): Assessment | null {
  const r = db()
    .prepare(`SELECT data FROM events WHERE module_id = ? AND type = 'adaptive_assessment' ORDER BY created_at DESC LIMIT 1`)
    .get(sessionId) as { data: string } | undefined;
  return r ? parseJson<Assessment>(r.data, {} as Assessment) : null;
}
