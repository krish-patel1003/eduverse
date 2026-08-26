// Query layer over the curriculum spine.
//
// Everything the tutor teaches can now be anchored to a real, published standard
// rather than a free-text topic the learner typed. That gives three things a
// free-text topic cannot: a trusted skill list per grade, an official code a
// parent or teacher recognises, and a sequence we can walk.

import { db } from "./db";
import { ALIASES, PREREQS } from "./ccssm";

export interface Standard {
  code: string;
  subject: string;
  grade: string;
  domain: string;
  cluster: string;
  skill: string;
}

export function listStandards(grade: string, subject = "math"): Standard[] {
  return db()
    .prepare(`SELECT * FROM standards WHERE subject = ? AND grade = ? ORDER BY code`)
    .all(subject, grade) as Standard[];
}

/** Grade's standards grouped by domain, which is how a curriculum is read. */
export function standardsByDomain(
  grade: string,
  subject = "math"
): { domain: string; clusters: { cluster: string; standards: Standard[] }[] }[] {
  const rows = listStandards(grade, subject);
  const byDomain = new Map<string, Map<string, Standard[]>>();
  for (const r of rows) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, new Map());
    const cl = byDomain.get(r.domain)!;
    if (!cl.has(r.cluster)) cl.set(r.cluster, []);
    cl.get(r.cluster)!.push(r);
  }
  return [...byDomain.entries()].map(([domain, cl]) => ({
    domain,
    clusters: [...cl.entries()].map(([cluster, standards]) => ({ cluster, standards })),
  }));
}

export function getStandard(code: string): Standard | null {
  return (db().prepare(`SELECT * FROM standards WHERE code = ?`).get(code) as Standard) ?? null;
}

export function gradesAvailable(subject = "math"): string[] {
  const rows = db()
    .prepare(`SELECT DISTINCT grade FROM standards WHERE subject = ?`)
    .all(subject) as { grade: string }[];
  const order = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  return rows.map((r) => r.grade).sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/**
 * Free-text search across the spine, so a parent typing "long division" or a
 * child typing "times tables" lands on the actual standard.
 */
export function searchStandards(q: string, subject = "math", limit = 12): Standard[] {
  const raw = q.trim().toLowerCase();
  if (raw.length < 2) return [];
  const term = `%${raw}%`;

  // Everyday phrases first: someone typing "long division" means a specific
  // standard, and the published wording will never contain that phrase.
  // Track how SPECIFIC the matching phrase was. "algebra 2" contains "algebra",
  // so both fire; without this the broad K-8 alias ties with the precise one and
  // a Grade 6 standard wins a search for Algebra 2.
  const aliasScore = new Map<string, number>();
  for (const [phrase, codes] of Object.entries(ALIASES)) {
    if (!phrase.includes(raw) && !raw.includes(phrase)) continue;
    const specificity = phrase === raw ? 60 : phrase.length;
    for (const c of codes) aliasScore.set(c, Math.max(aliasScore.get(c) ?? 0, specificity));
  }
  const aliasCodes = new Set(aliasScore.keys());

  const rows = db()
    .prepare(
      `SELECT * FROM standards
        WHERE subject = ? AND (lower(skill) LIKE ? OR lower(domain) LIKE ? OR lower(cluster) LIKE ? OR lower(code) LIKE ?)
        ORDER BY code`
    )
    .all(subject, term, term, term, term) as Standard[];

  const byCode = new Map(rows.map((r) => [r.code, r]));
  for (const c of aliasCodes) {
    if (byCode.has(c)) continue;
    const r = getStandard(c);
    if (r && r.subject === subject) byCode.set(c, r);
  }

  // Rank by how directly the match speaks to the query. Matching a CLUSTER name
  // used to drag in every unrelated standard beside it: searching "pythagorean"
  // returned the whole Grade 8 geometry cluster with the actual Pythagorean
  // standard buried inside it.
  const score = (r: Standard): number => {
    let n = 0;
    if (aliasCodes.has(r.code)) n += 100 + (aliasScore.get(r.code) ?? 0);
    if (r.code.toLowerCase() === raw) n += 90;
    if (r.code.toLowerCase().includes(raw)) n += 40;
    if (r.skill.toLowerCase().includes(raw)) n += 30;
    if (r.cluster.toLowerCase().includes(raw)) n += 6;
    if (r.domain.toLowerCase().includes(raw)) n += 3;
    return n;
  };

  return [...byCode.values()]
    .map((r) => ({ r, n: score(r) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.r.code.localeCompare(b.r.code))
    .slice(0, limit)
    .map((x) => x.r);
}

/** How many standards the spine holds, for the parent view. */
export function standardsStats(): { total: number; grades: number } {
  const r = db()
    .prepare(`SELECT COUNT(*) AS total, COUNT(DISTINCT grade) AS grades FROM standards`)
    .get() as { total: number; grades: number };
  return r;
}

// ---- the published prerequisite ladder --------------------------------------

const GRADE_ORDER = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const gradeRank = (g: string) => {
  const i = GRADE_ORDER.indexOf(g);
  return i === -1 ? 99 : i;
};

/**
 * Walk the published sequence backwards from a standard to build its
 * prerequisite ladder, easiest first.
 *
 * This is strictly better than generating one: it is deterministic, identical
 * for every learner, free, and traceable to real standard codes a teacher can
 * check. Returns an empty list when the standard has no mapped prerequisites,
 * so the caller can fall back to generating one.
 */
export function standardLadder(code: string, maxSteps = 5): Standard[] {
  const start = getStandard(code);
  if (!start) return [];

  // Breadth-first backwards through the graph, nearest prerequisites first.
  const seen = new Set<string>([code]);
  const found: Standard[] = [];
  let frontier = PREREQS[code] ?? [];
  let depth = 0;

  while (frontier.length && found.length < maxSteps * 2 && depth < 6) {
    const next: string[] = [];
    for (const c of frontier) {
      if (seen.has(c)) continue;
      seen.add(c);
      const std = getStandard(c);
      if (std) found.push(std);
      next.push(...(PREREQS[c] ?? []));
    }
    frontier = next;
    depth++;
  }

  // Easiest first, which is the order a learner should meet them.
  return found
    .sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || a.code.localeCompare(b.code))
    .slice(-maxSteps);
}

/** True when the spine can supply a ladder without asking a model. */
export function hasPublishedLadder(code: string): boolean {
  return (PREREQS[code]?.length ?? 0) > 0;
}

/** Best matching standard for a free-text skill, if one is clearly indicated. */
export function matchStandard(skill: string, grade?: string, subject = "math"): Standard | null {
  const hits = searchStandards(skill, subject, 5);
  if (!hits.length) return null;
  if (grade) {
    const atGrade = hits.find((h) => h.grade === grade);
    if (atGrade) return atGrade;
  }
  return hits[0];
}
