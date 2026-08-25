// Data access for the Adaptive Tutor: diagnostics, diagnosed weak areas, and the
// recursive teach->assess session records. Thin typed mapping over lib/db.ts.

import { db, newId, now, parseJson, DEFAULT_STUDENT } from "./db";
import type { ConcreteMode, TeachingMethod } from "./pedagogy";
import type {
  AnswerEvidence,
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
  interval_days: number | null;
  ease: number | null;
  due_at: number | null;
  reviews: number | null;
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
    intervalDays: r.interval_days ?? 0,
    ease: r.ease ?? 2.3,
    dueAt: r.due_at ?? undefined,
    reviews: r.reviews ?? 0,
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

// ---- spaced repetition ------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Schedule the next review after an attempt, SM-2 style. A pass grows the
 * interval by the ease factor; a miss resets it to tomorrow and makes the skill
 * a little harder in future. Mastery is never "forever": a mastered skill comes
 * back for a short check before it fades.
 */
export function scheduleReview(id: string, passed: boolean): WeakArea | null {
  const w = getWeakArea(id);
  if (!w) return null;
  const ease = w.ease ?? 2.3;
  const prev = w.intervalDays ?? 0;
  let nextEase = ease;
  let nextInterval: number;
  let reviews = w.reviews ?? 0;
  if (passed) {
    reviews += 1;
    nextEase = Math.min(2.8, ease + 0.1);
    nextInterval = prev <= 0 ? 1 : prev < 3 ? 3 : Math.round(prev * nextEase);
  } else {
    nextEase = Math.max(1.4, ease - 0.25);
    nextInterval = 1;
  }
  const dueAt = now() + nextInterval * DAY_MS;
  db()
    .prepare(`UPDATE weak_areas SET interval_days=?, ease=?, due_at=?, reviews=?, updated_at=? WHERE id=?`)
    .run(nextInterval, nextEase, dueAt, reviews, now(), id);
  return getWeakArea(id);
}

/** Mastered skills whose review has come due. */
export function listDueReviews(studentId = DEFAULT_STUDENT): WeakArea[] {
  const rows = db()
    .prepare(
      `SELECT * FROM weak_areas WHERE student_id = ? AND status = 'mastered' AND due_at IS NOT NULL AND due_at <= ?
       ORDER BY due_at ASC`
    )
    .all(studentId, now()) as WeakRow[];
  return rows.map(mapWeak);
}

/**
 * The single next best thing to work on: an overdue review first (protecting
 * what was already learned), otherwise the weakest skill still to be learned.
 */
export function nextBestAction(studentId = DEFAULT_STUDENT): { kind: "review" | "learn"; area: WeakArea } | null {
  const due = listDueReviews(studentId);
  if (due.length) return { kind: "review", area: due[0] };
  const rest = listWeakAreas(studentId).filter((w) => w.status !== "mastered");
  return rest.length ? { kind: "learn", area: rest[0] } : null;
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
    .prepare(`UPDATE diagnostics SET evidence = ? WHERE id = ?`)
    .run(JSON.stringify(result.evidence ?? []), id);
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
  /** The exact skill taught this round (may be a prerequisite below the aspect). */
  taughtSkill?: string;
  /** True when this round dropped to a foundation below the original aspect. */
  droppedDown?: boolean;
  /** Learner-facing reason we chose this skill. */
  reason?: string;
  /** The child-facing mode this round was taught in. */
  mode?: ConcreteMode;
  /** The instructional method the engine used to deliver that mode. */
  method?: TeachingMethod;
  /** Why the engine picked this approach (shown to parents, not the child). */
  routeReason?: string;
  /** Score before this round's lesson, for measuring the lesson's effect. */
  beforeScore?: number;
  overall?: number;
  passed?: boolean;
  weakAspects?: string[];
  /** Full per-item record of the attempt: what was asked, answered, and why it was wrong. */
  evidence?: AnswerEvidence[];
  /** Misconceptions named from this attempt. */
  misconceptions?: string[];
  /** Hints revealed across this attempt. */
  hintsUsed?: number;
  /** Percentage answered correctly with no hints at all. */
  independent?: number;
  /** Median taken/expected time across genuinely attempted items. */
  pace?: number;
  /** True when accuracy is there but speed is not. */
  needsSpeedWork?: boolean;
  /** Active seconds across the whole attempt. */
  totalSeconds?: number;
  /** The learner's end-of-lesson feedback on this round's video. */
  feedback?: RoundFeedback;
  at: number;
}

/** One-tap reactions plus an optional note, captured at the end of a lesson. */
export interface RoundFeedback {
  reactions: string[];
  text?: string;
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
// Lessons and assessments are stored per ROUND (module_id = "<sessionId>#<round>")
// so any past round can be replayed or retried, not just the latest one.
const roundKey = (sessionId: string, round: number) => `${sessionId}#${round}`;

export function saveSessionExplainer(sessionId: string, explainer: Explainer, round: number): void {
  db()
    .prepare(`INSERT INTO events (id, student_id, module_id, type, data, created_at) VALUES (?, '', ?, 'adaptive_explainer', ?, ?)`)
    .run(newId("evt"), roundKey(sessionId, round), JSON.stringify(explainer), now());
}

/** The lesson taught in a specific round. */
export function getRoundExplainer(sessionId: string, round: number): Explainer | null {
  const r = db()
    .prepare(`SELECT data FROM events WHERE module_id = ? AND type = 'adaptive_explainer' ORDER BY created_at DESC LIMIT 1`)
    .get(roundKey(sessionId, round)) as { data: string } | undefined;
  return r ? parseJson<Explainer>(r.data, {} as Explainer) : null;
}

/** The most recent lesson for a session (any round). */
/** Record the learner's end-of-lesson feedback onto a specific round. */
export function attachRoundFeedback(sessionId: string, round: number, feedback: RoundFeedback): void {
  const session = getAdaptiveSession(sessionId);
  if (!session) return;
  const rounds = session.rounds.map((r) => (r.round === round ? { ...r, feedback } : r));
  updateAdaptiveSession(sessionId, { rounds });
}

export function getSessionExplainer(sessionId: string): Explainer | null {
  const r = db()
    .prepare(
      `SELECT data FROM events WHERE module_id LIKE ? AND type = 'adaptive_explainer' ORDER BY created_at DESC LIMIT 1`
    )
    .get(`${sessionId}#%`) as { data: string } | undefined;
  return r ? parseJson<Explainer>(r.data, {} as Explainer) : null;
}

// The current post-video assessment for a session (with answer keys), stored
// server-side between GET (generate) and POST (grade).
export function saveSessionAssessment(sessionId: string, assessment: Assessment, round: number): void {
  db()
    .prepare(`INSERT INTO events (id, student_id, module_id, type, data, created_at) VALUES (?, '', ?, 'adaptive_assessment', ?, ?)`)
    .run(newId("evt"), roundKey(sessionId, round), JSON.stringify(assessment), now());
}

/** The assessment used in a specific round, for retrying it. */
export function getRoundAssessment(sessionId: string, round: number): Assessment | null {
  const r = db()
    .prepare(`SELECT data FROM events WHERE module_id = ? AND type = 'adaptive_assessment' ORDER BY created_at DESC LIMIT 1`)
    .get(roundKey(sessionId, round)) as { data: string } | undefined;
  return r ? parseJson<Assessment>(r.data, {} as Assessment) : null;
}

export function getSessionAssessment(sessionId: string): Assessment | null {
  const r = db()
    .prepare(
      `SELECT data FROM events WHERE module_id LIKE ? AND type = 'adaptive_assessment' ORDER BY created_at DESC LIMIT 1`
    )
    .get(`${sessionId}#%`) as { data: string } | undefined;
  return r ? parseJson<Assessment>(r.data, {} as Assessment) : null;
}

// ---- adaptive placement state ----------------------------------------------

/** Carry the staged-probing state across a diagnostic's stages. */
export function savePlacement(diagnosticId: string, state: unknown, workingBand?: string): void {
  db()
    .prepare(`UPDATE diagnostics SET placement = ?, working_band = COALESCE(?, working_band) WHERE id = ?`)
    .run(JSON.stringify(state), workingBand ?? null, diagnosticId);
}

export function getPlacement<T>(diagnosticId: string): T | null {
  const r = db().prepare(`SELECT placement FROM diagnostics WHERE id = ?`).get(diagnosticId) as
    | { placement: string | null }
    | undefined;
  return r?.placement ? parseJson<T | null>(r.placement, null) : null;
}

/** Replace the stored assessment for a diagnostic (each probe is a new stage). */
export function replaceDiagnosticAssessment(diagnosticId: string, assessment: Assessment): void {
  db().prepare(`UPDATE diagnostics SET items = ? WHERE id = ?`).run(JSON.stringify(assessment), diagnosticId);
}

export function getWorkingBand(diagnosticId: string): string | null {
  const r = db().prepare(`SELECT working_band FROM diagnostics WHERE id = ?`).get(diagnosticId) as
    | { working_band: string | null }
    | undefined;
  return r?.working_band ?? null;
}

/**
 * Evidence from this learner's most recent graded diagnostic on a topic. Used
 * ONLY for the cold-start method prior: it describes how they answer, which
 * transfers across skills, unlike the answers themselves.
 */
export function latestDiagnosticEvidence(studentId: string, topic: string): AnswerEvidence[] {
  const r = db()
    .prepare(
      `SELECT evidence FROM diagnostics
        WHERE student_id = ? AND topic = ? AND status = 'graded' AND evidence IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`
    )
    .get(studentId, topic) as { evidence: string } | undefined;
  return r ? parseJson<AnswerEvidence[]>(r.evidence, []) : [];
}

/**
 * Per-skill speed picture from recorded attempts, for the parent view. Only
 * counts attempts where accuracy was already reasonable, because speed on
 * material the learner cannot yet do is not a meaningful number.
 */
export function speedBySkill(
  studentId = DEFAULT_STUDENT
): { skill: string; pace: number; attempts: number; totalSeconds: number; needsSpeedWork: boolean }[] {
  const rows = db()
    .prepare(`SELECT rounds FROM adaptive_sessions WHERE student_id = ?`)
    .all(studentId) as { rounds: string }[];
  const acc = new Map<string, { paces: number[]; secs: number; flag: boolean }>();
  for (const r of rows) {
    for (const round of parseJson<AdaptiveRound[]>(r.rounds, [])) {
      if (typeof round.pace !== "number" || !round.taughtSkill) continue;
      if ((round.overall ?? 0) < 60) continue; // speed is only meaningful once it is mostly right
      const cur = acc.get(round.taughtSkill) ?? { paces: [], secs: 0, flag: false };
      cur.paces.push(round.pace);
      cur.secs += round.totalSeconds ?? 0;
      cur.flag = cur.flag || !!round.needsSpeedWork;
      acc.set(round.taughtSkill, cur);
    }
  }
  return [...acc.entries()]
    .map(([skill, v]) => ({
      skill,
      pace: Math.round((v.paces.reduce((a, b) => a + b, 0) / v.paces.length) * 100) / 100,
      attempts: v.paces.length,
      totalSeconds: v.secs,
      needsSpeedWork: v.flag,
    }))
    .sort((a, b) => b.pace - a.pace);
}
