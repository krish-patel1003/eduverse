// Root-cause diagnosis for the adaptive loop.
//
// The failure mode this fixes: a learner who cannot add single digits fails a
// question like 78 + 89, and a naive tutor re-teaches "multi digit addition"
// with a different analogy. That is not adaptive. It is the same lesson twice.
//
// Here we instead:
//   1. build a PREREQUISITE LADDER for the target skill (US grade-level scope
//      and sequence, easiest first), then
//   2. read the learner's ACTUAL wrong answers and misconceptions and decide the
//      LOWEST rung that is broken.
// The next lesson teaches that rung, which may sit several grades below the
// aspect the learner originally picked.

import { callGemini } from "./gemini";
import { db, newId, now } from "./db";
import { bandScopePrompt, parseBand } from "./gradeband";
import { getStandard, hasPublishedLadder, matchStandard, standardLadder } from "./standards";
import { US_PEDAGOGY } from "./pedagogy";
import type { AnswerEvidence, Diagnosis, PrereqLadder, PrereqStep } from "./types";

function stripDashes(s: string): string {
  return s.replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, "-").replace(/\s{2,}/g, " ").trim();
}

// ---- prerequisite ladder ----------------------------------------------------

const LADDER_SPEC = `You are a curriculum specialist. Given a target skill and the learner's grade level, list the PREREQUISITE SKILLS that must already be solid before the target skill can make sense.

${US_PEDAGOGY}

Rules:
- Order EASIEST FIRST, ending with the rung just below the target skill.
- 3 to 6 rungs. Each rung must be a single teachable skill, not a topic area.
- Go far enough down that the first rung is genuinely foundational for this subject (for arithmetic that might be "what addition means, combining two groups"; for algebra it might be "evaluating expressions with one variable").
- Give the US grade band where each rung is normally taught.
- "check" is one short question or task that reveals whether the learner has that rung.
- Write plainly. Do NOT use em dashes or en dashes.

Output ONLY this JSON:
{ "target": string, "steps": [ { "skill": string, "grade": string, "check": string } ] }`;

// ---- the persisted prerequisite graph --------------------------------------
//
// A ladder for (skill, subject, grade band) is identical for every learner, so
// generating one per request was pure waste: an extra model call on every
// re-teach, and two children hitting the same skill got independently invented
// ladders. Cached rows are shared, which also makes the accumulated graph
// consistent and inspectable.

const key = (s: string) => s.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").slice(0, 120);

function readLadder(skill: string, subject: string, band: string): PrereqLadder | null {
  const r = db()
    .prepare(`SELECT id, steps FROM prereq_ladders WHERE skill_key = ? AND subject = ? AND band = ?`)
    .get(key(skill), key(subject), band) as { id: string; steps: string } | undefined;
  if (!r) return null;
  db().prepare(`UPDATE prereq_ladders SET uses = uses + 1 WHERE id = ?`).run(r.id);
  try {
    const steps = JSON.parse(r.steps) as PrereqStep[];
    return Array.isArray(steps) && steps.length ? { target: skill, steps, source: "generated" } : null;
  } catch {
    return null;
  }
}

function writeLadder(skill: string, subject: string, band: string, steps: PrereqStep[]): void {
  if (!steps.length) return;
  db()
    .prepare(
      `INSERT INTO prereq_ladders (id, skill_key, subject, band, steps, uses, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT (skill_key, subject, band) DO UPDATE SET steps = excluded.steps`
    )
    .run(newId("pre"), key(skill), key(subject), band, JSON.stringify(steps), now());
}

/** Everything the graph currently knows, for inspection. */
export function ladderGraphStats(): { rows: number; totalUses: number } {
  const r = db()
    .prepare(`SELECT COUNT(*) AS rows, COALESCE(SUM(uses),0) AS totalUses FROM prereq_ladders`)
    .get() as { rows: number; totalUses: number };
  return r;
}

export async function buildPrereqLadder(input: {
  skill: string;
  topic: string;
  level?: string;
  /** A CCSS-M code, when the skill came from the curriculum spine. */
  standardCode?: string;
}): Promise<PrereqLadder> {
  const band = parseBand(input.level) ?? "any";

  // 1. The PUBLISHED sequence, when we know which standard this is. Strictly
  //    better than generating: deterministic, identical for every learner, free,
  //    and every rung is a real code a teacher can look up.
  const std =
    (input.standardCode ? getStandard(input.standardCode) : null) ??
    matchStandard(input.skill, band === "any" ? undefined : band);
  if (std && hasPublishedLadder(std.code)) {
    const steps = standardLadder(std.code).map<PrereqStep>((r) => ({
      skill: r.skill,
      grade: r.grade === "K" ? "Kindergarten" : `Grade ${r.grade}`,
      check: `${r.code}: ${r.skill}`,
    }));
    if (steps.length) return { target: input.skill, steps, source: "published", standardCode: std.code };
  }

  // 2. Otherwise fall back to a cached or generated ladder.
  const cached = readLadder(input.skill, input.topic, band);
  if (cached) return cached;

  const text =
    `TARGET SKILL: ${input.skill}\nSUBJECT: ${input.topic}\nLEARNER GRADE LEVEL: ${input.level || "unspecified"}\n` +
    bandScopePrompt(input.level);
  try {
    const raw = (await callGemini(LADDER_SPEC, [{ text }])) as Record<string, unknown>;
    const steps: PrereqStep[] = (Array.isArray(raw.steps) ? raw.steps : [])
      .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : {}))
      .filter((s) => typeof s.skill === "string" && (s.skill as string).trim())
      .slice(0, 6)
      .map((s) => ({
        skill: stripDashes((s.skill as string).trim()).slice(0, 120),
        grade: typeof s.grade === "string" ? s.grade.trim().slice(0, 40) : undefined,
        check: typeof s.check === "string" ? stripDashes(s.check.trim()).slice(0, 240) : "",
      }));
    writeLadder(input.skill, input.topic, band, steps);
    return { target: input.skill, steps, source: "generated" };
  } catch {
    return { target: input.skill, steps: [], source: "generated" };
  }
}

// ---- root-cause diagnosis ---------------------------------------------------

const DIAGNOSE_SPEC = `You are an expert tutor deciding what to teach next after a learner failed an assessment.

${US_PEDAGOGY}

You are given: the skill they were being taught, the prerequisite ladder for it, and their ACTUAL answers with the misconceptions behind them.

Your job is to find the ROOT CAUSE, not to repeat the lesson.
- Read the wrong answers closely. What is the LOWEST rung on the ladder that the evidence shows is broken?
- If the evidence shows a foundational gap, you MUST drop down to that rung, even if it is several grades below the original skill. Teaching the original skill again in a new style is the WRONG answer when the foundation is missing.
- Only stay at the original skill when the evidence shows the foundations are solid and the learner just needs more practice at that exact level.
- Be concrete. "Multi digit addition" is a topic. "Regrouping ten ones into one ten" is a teachable skill.

Write plainly, and warmly: the learner will read "reason". Never make them feel stupid for going back a step. Do NOT use em dashes or en dashes.

Output ONLY this JSON:
{
  "teachSkill": string,        // the ONE skill to teach next, phrased as a teachable skill
  "droppedDown": boolean,      // true if this is below the skill they were on
  "misconceptions": [string],  // the specific wrong beliefs seen in the evidence
  "reason": string,            // 1-2 sentences for the learner on why we are covering this next
  "teachingNotes": string      // 2-3 sentences for the lesson writer: what to assume, what to build from, what to avoid
}`;

/**
 * Decide what to teach next from the learner's actual answers. Falls back to the
 * original skill if the model cannot be reached, so the loop never stalls.
 */
export async function diagnoseNextSkill(input: {
  skill: string;
  topic: string;
  level?: string;
  ladder: PrereqLadder;
  evidence: AnswerEvidence[];
  /** Skills already taught in this session, so we do not loop on one rung. */
  alreadyTaught?: string[];
}): Promise<Diagnosis> {
  const wrong = input.evidence.filter((e) => !e.correct);
  const right = input.evidence.filter((e) => e.correct);

  let text = `SKILL BEING TAUGHT: ${input.skill}\nSUBJECT: ${input.topic}\nGRADE LEVEL: ${input.level || "unspecified"}\n\n`;
  text += `PREREQUISITE LADDER (easiest first):\n${
    input.ladder.steps.map((s, i) => `${i + 1}. ${s.skill}${s.grade ? ` (${s.grade})` : ""} - check: ${s.check}`).join("\n") ||
    "(none available)"
  }\n\n`;
  text += `WHAT THEY GOT WRONG (${wrong.length}):\n${
    wrong
      .map(
        (e) =>
          `- [${e.aspect}] Q: ${e.question}\n  They answered: ${e.learnerAnswer || "(blank)"}\n  Correct: ${e.expected || "(open response)"}\n  Misconception: ${e.misconception || "(not identified)"}\n  Missing skill: ${e.missingSkill || "(not identified)"}`
      )
      .join("\n") || "(none)"
  }\n\n`;
  if (right.length)
    text += `WHAT THEY GOT RIGHT (${right.length}): ${right.map((e) => e.aspect).join(", ")}\n\n`;
  if (input.alreadyTaught?.length)
    text += `ALREADY TAUGHT IN THIS SESSION (do not simply repeat these): ${input.alreadyTaught.join("; ")}\n`;

  try {
    const raw = (await callGemini(DIAGNOSE_SPEC, [{ text }])) as Record<string, unknown>;
    const teachSkill =
      typeof raw.teachSkill === "string" && raw.teachSkill.trim()
        ? stripDashes(raw.teachSkill.trim()).slice(0, 140)
        : input.skill;
    return {
      teachSkill,
      droppedDown: raw.droppedDown === true || teachSkill.toLowerCase() !== input.skill.toLowerCase(),
      misconceptions: Array.isArray(raw.misconceptions)
        ? (raw.misconceptions.filter((m) => typeof m === "string") as string[]).slice(0, 6).map((m) => stripDashes(m).slice(0, 200))
        : [],
      reason: typeof raw.reason === "string" ? stripDashes(raw.reason.trim()).slice(0, 400) : "",
      teachingNotes: typeof raw.teachingNotes === "string" ? stripDashes(raw.teachingNotes.trim()).slice(0, 600) : "",
    };
  } catch {
    return {
      teachSkill: input.skill,
      droppedDown: false,
      misconceptions: wrong.map((e) => e.misconception).filter((m): m is string => !!m).slice(0, 6),
      reason: "",
      teachingNotes: "",
    };
  }
}
