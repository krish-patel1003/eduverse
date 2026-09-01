// Sub-skills: the teachable layer beneath a standard.
//
// A Common Core standard is the right SPINE but too coarse to teach from.
// "4.NBT.B.5 — multiply up to four digits by one digit, and two digits by two
// digits" is really a dozen separate teachable skills, and a learner is weak at
// one of them, not at all of it.
//
// The important property here is DETERMINISM. Sub-skills used to be invented by
// the model inside every assessment as free-text "aspects", so the same topic
// produced a different breakdown on every run and nothing could accumulate
// against them. Here they are generated ONCE per standard, persisted, and then
// only ever read. Same grade, same list, every time.

import { callGemini } from "./gemini";
import { db, newId, now } from "./db";
import { US_PEDAGOGY } from "./pedagogy";
import { listStandards, type Standard } from "./standards";

export interface SubSkill {
  id: string;
  standardCode: string;
  subject: string;
  grade: string;
  name: string;
  idx: number;
}

const SPEC = `You are a curriculum specialist breaking ONE standard into the individual skills a teacher would actually set as separate practice.

${US_PEDAGOGY}

Rules:
- Produce 4 to 8 skills, ordered EASIEST FIRST, that together cover the standard.
- Each must be a single teachable, practisable skill, not a topic area. "Multiply a two digit number by a one digit number with regrouping" is a skill; "multiplication" is not.
- Phrase them the way a teacher would name a worksheet: short, concrete, specific.
- Stay strictly inside the stated grade. Do not include anything that belongs to a later grade.
- Do not restate the standard itself as one of the skills.
- Write plainly. Do NOT use em dashes or en dashes.

Output ONLY this JSON:
{ "skills": [ "first skill", "second skill", ... ] }`;

function readSubSkills(code: string): SubSkill[] {
  const rows = db()
    .prepare(`SELECT * FROM substandards WHERE standard_code = ? ORDER BY idx`)
    .all(code) as { id: string; standard_code: string; subject: string; grade: string; name: string; idx: number }[];
  return rows.map((r) => ({
    id: r.id,
    standardCode: r.standard_code,
    subject: r.subject,
    grade: r.grade,
    name: r.name,
    idx: r.idx,
  }));
}

function writeSubSkills(std: Standard, names: string[]): void {
  const ins = db().prepare(
    `INSERT INTO substandards (id, standard_code, subject, grade, name, idx, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (standard_code, name) DO UPDATE SET idx = excluded.idx`
  );
  db().transaction(() => {
    names.forEach((n, i) => ins.run(newId("sub"), std.code, std.subject, std.grade, n, i, now()));
  })();
}

/**
 * Sub-skills for one standard. Generated on first request, then served from the
 * database forever, so the breakdown never changes between visits.
 */
export async function subSkillsFor(std: Standard): Promise<SubSkill[]> {
  const cached = readSubSkills(std.code);
  if (cached.length) return cached;

  try {
    const raw = (await callGemini(SPEC, [
      {
        text:
          `STANDARD: ${std.code}\nGRADE: ${std.grade === "K" ? "Kindergarten" : `Grade ${std.grade}`}\n` +
          `DOMAIN: ${std.domain}\nCLUSTER: ${std.cluster}\nSTANDARD SAYS: ${std.skill}`,
      },
    ])) as Record<string, unknown>;
    const names = (Array.isArray(raw.skills) ? raw.skills : [])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 3)
      .map((x) => x.replace(/\s*—\s*/g, ", ").replace(/\s+/g, " ").trim().slice(0, 140))
      .slice(0, 8);
    if (!names.length) return [];
    writeSubSkills(std, names);
    return readSubSkills(std.code);
  } catch {
    // A failure here must not break browsing: the standard itself is still usable.
    return [];
  }
}

/** Everything already generated for a grade, without triggering generation. */
export function cachedSubSkillsForGrade(grade: string, subject = "math"): Map<string, SubSkill[]> {
  const rows = db()
    .prepare(`SELECT * FROM substandards WHERE subject = ? AND grade = ? ORDER BY standard_code, idx`)
    .all(subject, grade) as { id: string; standard_code: string; subject: string; grade: string; name: string; idx: number }[];
  const out = new Map<string, SubSkill[]>();
  for (const r of rows) {
    if (!out.has(r.standard_code)) out.set(r.standard_code, []);
    out.get(r.standard_code)!.push({
      id: r.id,
      standardCode: r.standard_code,
      subject: r.subject,
      grade: r.grade,
      name: r.name,
      idx: r.idx,
    });
  }
  return out;
}

/**
 * Ensure a whole grade is expanded. Runs missing standards in small batches so a
 * first visit is slow once and instant thereafter.
 */
export async function ensureGradeExpanded(
  grade: string,
  subject = "math",
  concurrency = 4
): Promise<{ generated: number; total: number }> {
  const standards = listStandards(grade, subject);
  const have = cachedSubSkillsForGrade(grade, subject);
  const missing = standards.filter((s) => !have.has(s.code));
  let generated = 0;

  for (let i = 0; i < missing.length; i += concurrency) {
    const batch = missing.slice(i, i + concurrency);
    const done = await Promise.all(batch.map((s) => subSkillsFor(s)));
    generated += done.filter((d) => d.length > 0).length;
  }
  return { generated, total: standards.length };
}

export function subSkillStats(subject = "math"): { skills: number; standardsExpanded: number } {
  const r = db()
    .prepare(
      `SELECT COUNT(*) AS skills, COUNT(DISTINCT standard_code) AS standardsExpanded
         FROM substandards WHERE subject = ?`
    )
    .get(subject) as { skills: number; standardsExpanded: number };
  return r;
}
