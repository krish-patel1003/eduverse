// Query layer over the curriculum spine.
//
// Everything the tutor teaches can now be anchored to a real, published standard
// rather than a free-text topic the learner typed. That gives three things a
// free-text topic cannot: a trusted skill list per grade, an official code a
// parent or teacher recognises, and a sequence we can walk.

import { db } from "./db";
import { ALIASES } from "./ccssm";

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
  const order = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];
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
  const aliasCodes = new Set<string>();
  for (const [phrase, codes] of Object.entries(ALIASES)) {
    if (phrase.includes(raw) || raw.includes(phrase)) codes.forEach((c) => aliasCodes.add(c));
  }

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
    if (aliasCodes.has(r.code)) n += 100;
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
