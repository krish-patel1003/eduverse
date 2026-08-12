// The typed assessment engine for the Adaptive Tutor. Generates level-calibrated
// assessments whose item mix fits the subject domain, and grades them: MCQ and
// fill-in-the-blank are auto-graded; open items (code, essays, math, short
// answers) are AI-graded via the shared Gemini JSON pipeline. Math is graded on
// the APPROACH and each step, not just the final answer.

import { callGemini } from "./gemini";
import { newId } from "./db";
import type {
  Assessment,
  AssessmentDomain,
  AssessmentItem,
  AssessmentItemGrade,
  AssessmentItemType,
  AssessmentResult,
  QuizOption,
} from "./types";

const PASS_PCT = 70;

const DOMAINS: AssessmentDomain[] = ["coding", "language", "math", "general"];
const ITEM_TYPES: AssessmentItemType[] = [
  "mcq",
  "multi_mcq",
  "fill_blank",
  "short_answer",
  "code_bugfix",
  "code_write",
  "pseudocode",
  "essay",
  "math_multistep",
];
const AUTO_TYPES = new Set<AssessmentItemType>(["mcq", "multi_mcq", "fill_blank"]);

function stripDashes(s: string): string {
  return s.replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, "-").replace(/\s{2,}/g, " ").trim();
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "").trim();

const VOICE =
  `Write in clear, plain English. Do NOT use em dashes or en dashes (no "—", no "–"); use commas or separate sentences.`;

// The item-type guidance changes by domain so we assess the right skills.
const DOMAIN_GUIDE: Record<AssessmentDomain, string> = {
  coding:
    `Use a mix of: code_bugfix (give buggy code in "starterCode" + set "language"), code_write (a small leetcode-style task with a signature in "starterCode"), pseudocode, fill_blank (complete a code line), and mcq/multi_mcq. Favor hands-on code items.`,
  language:
    `Use a mix of: essay or short_answer writing tasks, fill_blank (grammar/vocabulary), and mcq/multi_mcq for comprehension. Favor writing tasks.`,
  math:
    `Use a mix of: math_multistep (a problem that needs several steps of working; the learner shows their steps), short_answer, fill_blank, and mcq/multi_mcq. Favor multi-step problems.`,
  general:
    `Use mostly mcq and multi_mcq, plus a few short_answer items. Keep it broad.`,
};

function spec(mode: "diagnostic" | "thorough"): string {
  const shape =
    mode === "diagnostic"
      ? `Build an EXHAUSTIVE diagnostic that covers EVERY important sub-aspect of the topic for this education level. 14 to 20 items. Lean on mcq/multi_mcq with a few short_answer, but still include the domain's hands-on types where they reveal understanding.`
      : `Build a THOROUGH check of the specific aspect(s) taught. 5 to 8 items that together test every aspect deeply, using the domain's hands-on item types (not just MCQ).`;
  return `You are an expert assessment designer. ${shape}

CALIBRATE DIFFICULTY AND SCOPE TO THE LEARNER'S EDUCATION LEVEL. A 5th grader's "Mathematics" means 5th-grade arithmetic and fractions; a university student's "Mathematics" means calculus, proofs, linear algebra, etc. Never assess above or below the stated level. ${VOICE}

First classify the topic's DOMAIN as one of: coding, language, math, general.
Then pick item types to match the domain.

Output ONLY this JSON:
{
  "domain": "coding" | "language" | "math" | "general",
  "items": [
    {
      "type": "mcq" | "multi_mcq" | "fill_blank" | "short_answer" | "code_bugfix" | "code_write" | "pseudocode" | "essay" | "math_multistep",
      "aspect": "short lowercase tag for the sub-aspect being tested",
      "prompt": "the question or task shown to the learner",
      "options": ["...", "..."],          // mcq / multi_mcq ONLY (3-4 options)
      "correct": [0, 2],                    // mcq/multi_mcq: correct option indexes; fill_blank: omit
      "blanks": ["expected", "fills"],      // fill_blank ONLY, in order; the prompt uses ___ for each blank
      "language": "python",                 // code_* items
      "starterCode": "...",                 // code_bugfix (buggy code) / code_write (signature), optional
      "rubric": "what a correct answer must demonstrate"  // ALL open (non-auto-graded) items; hidden from the learner
    }
  ]
}

Rules:
- Every item has an "aspect". Together the items must cover every major aspect (diagnostic) or every aspect of the taught material (thorough).
- mcq/multi_mcq/fill_blank are auto-graded, so their answers must be unambiguous.
- Open items MUST include a specific "rubric".
- For math_multistep, the prompt must require showing the working, and the rubric must reward correct approach and steps even if a small arithmetic slip occurs.`;
}

function normOptions(raw: unknown): QuizOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o) => typeof o === "string" && o.trim())
    .slice(0, 5)
    .map((o, i) => ({ id: `o${i}`, text: stripDashes(String(o).trim()).slice(0, 300) }));
}

function normItem(raw: unknown): AssessmentItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = ITEM_TYPES.includes(r.type as AssessmentItemType) ? (r.type as AssessmentItemType) : "mcq";
  const prompt = typeof r.prompt === "string" ? stripDashes(r.prompt.trim()).slice(0, 1200) : "";
  if (!prompt) return null;
  const aspect = typeof r.aspect === "string" && r.aspect.trim() ? r.aspect.trim().toLowerCase().slice(0, 60) : "general";
  const item: AssessmentItem = { id: newId("ai"), type, aspect, prompt };

  if (type === "mcq" || type === "multi_mcq") {
    const options = normOptions(r.options);
    if (options.length < 2) return null;
    const idx = Array.isArray(r.correct)
      ? [...new Set(r.correct.map((n) => Math.round(Number(n))))].filter((n) => n >= 0 && n < options.length)
      : [];
    if (idx.length === 0) return null;
    item.options = options;
    item.correct = (type === "mcq" ? idx.slice(0, 1) : idx).map((n) => options[n].id);
  } else if (type === "fill_blank") {
    const blanks = Array.isArray(r.blanks) ? (r.blanks.filter((b) => typeof b === "string") as string[]) : [];
    if (blanks.length === 0) return null;
    item.correct = blanks.map((b) => b.trim());
  } else {
    item.rubric = typeof r.rubric === "string" ? stripDashes(r.rubric.trim()).slice(0, 600) : "";
    if (typeof r.language === "string") item.language = r.language.trim().slice(0, 20);
    if (typeof r.starterCode === "string") item.starterCode = r.starterCode.slice(0, 2000);
  }
  return item;
}

export async function generateAssessment(input: {
  topic: string;
  level?: string;
  mode: "diagnostic" | "thorough";
  aspects?: string[];
  priorMistakes?: string[];
}): Promise<Assessment> {
  let text = `TOPIC: ${input.topic}\nEDUCATION LEVEL: ${input.level || "unspecified"}`;
  if (input.aspects?.length) text += `\nFOCUS ASPECTS (cover each): ${input.aspects.join(", ")}`;
  if (input.priorMistakes?.length)
    text += `\nThe learner previously struggled with: ${input.priorMistakes.join("; ")}. Probe these harder.`;

  const raw = (await callGemini(spec(input.mode), [{ text }])) as Record<string, unknown>;
  const domain = DOMAINS.includes(raw.domain as AssessmentDomain) ? (raw.domain as AssessmentDomain) : "general";
  const items = (Array.isArray(raw.items) ? raw.items : []).map(normItem).filter((x): x is AssessmentItem => !!x);
  if (items.length === 0) throw new Error("Assessment generation produced no items");
  const aspects = [...new Set(items.map((i) => i.aspect))];
  return { id: newId("asmt"), topic: input.topic, domain, level: input.level, aspects, items };
}

// ---- grading ---------------------------------------------------------------

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

const GRADE_SPEC = `You are a fair, rigorous grader. For each open item you are given the task, a hidden rubric, and the learner's answer. Grade how well the answer meets the rubric. ${VOICE}

For code: judge correctness and whether it would work, not style. For math_multistep: reward a correct APPROACH and correct steps; do not fail an answer for a tiny arithmetic slip if the method is right. For essays/short answers: judge substance against the rubric, not length.

Output ONLY this JSON:
{ "grades": [ { "id": string, "ok": bool, "score": number(0-100), "feedback": string } ] }  // one per item, same ids`;

export async function gradeAssessment(input: {
  assessment: Assessment;
  answers: Record<string, unknown>;
}): Promise<AssessmentResult> {
  const { assessment, answers } = input;
  const perItem: AssessmentItemGrade[] = [];

  // 1. Auto-grade objective items.
  const openItems: AssessmentItem[] = [];
  for (const item of assessment.items) {
    const ans = answers[item.id];
    if (item.type === "mcq" || item.type === "multi_mcq") {
      const picked = Array.isArray(ans) ? (ans as unknown[]).map(String) : ans ? [String(ans)] : [];
      const ok = sameSet(picked, item.correct ?? []);
      perItem.push({ itemId: item.id, correct: ok, score: ok ? 100 : 0, feedback: ok ? "Correct." : "Incorrect." });
    } else if (item.type === "fill_blank") {
      const fills = Array.isArray(ans) ? (ans as unknown[]).map((x) => String(x)) : [String(ans ?? "")];
      const exp = item.correct ?? [];
      const each = exp.map((e, i) => norm(fills[i] ?? "") === norm(e));
      const got = each.filter(Boolean).length;
      const score = Math.round((got / Math.max(1, exp.length)) * 100);
      perItem.push({
        itemId: item.id,
        correct: got === exp.length,
        score,
        feedback: got === exp.length ? "All blanks correct." : `Correct answers: ${exp.join(", ")}.`,
      });
    } else {
      openItems.push(item);
    }
  }

  // 2. AI-grade open items in one call.
  if (openItems.length) {
    const payload = openItems
      .map(
        (it, i) =>
          `Item ${i + 1} (id: ${it.id}, type: ${it.type}):\nTask: ${it.prompt}\nRubric: ${it.rubric ?? ""}\nLearner answer: ${String(answers[it.id] ?? "").trim() || "(blank)"}`
      )
      .join("\n\n---\n\n");
    try {
      const raw = (await callGemini(GRADE_SPEC, [{ text: payload }])) as Record<string, unknown>;
      const grades = Array.isArray(raw.grades) ? raw.grades : [];
      for (const it of openItems) {
        const g = (grades.find((x) => (x as { id?: string })?.id === it.id) ?? {}) as Record<string, unknown>;
        const blank = !String(answers[it.id] ?? "").trim();
        const score = blank ? 0 : typeof g.score === "number" ? Math.max(0, Math.min(100, Math.round(g.score))) : g.ok === true ? 100 : 0;
        perItem.push({
          itemId: it.id,
          correct: !blank && (g.ok === true || score >= PASS_PCT),
          score,
          feedback: blank ? "No answer was provided." : typeof g.feedback === "string" ? stripDashes(g.feedback.trim()).slice(0, 500) : "",
        });
      }
    } catch {
      for (const it of openItems) perItem.push({ itemId: it.id, correct: false, score: 0, feedback: "Could not grade this answer." });
    }
  }

  // 3. Aggregate per aspect + overall.
  const byId = new Map(perItem.map((p) => [p.itemId, p]));
  const aspectScores = new Map<string, number[]>();
  for (const item of assessment.items) {
    const s = byId.get(item.id)?.score ?? 0;
    const arr = aspectScores.get(item.aspect) ?? [];
    arr.push(s);
    aspectScores.set(item.aspect, arr);
  }
  const perAspect = [...aspectScores.entries()].map(([aspect, scores]) => ({
    aspect,
    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));
  const overall = Math.round(perItem.reduce((a, b) => a + b.score, 0) / Math.max(1, perItem.length));
  const weakAspects = perAspect.filter((a) => a.score < PASS_PCT).map((a) => a.aspect);
  const passed = overall >= PASS_PCT && weakAspects.length === 0;

  return {
    perItem,
    perAspect,
    overall,
    passed,
    weakAspects,
    summary: passed
      ? "Strong understanding across every aspect."
      : `Needs work on: ${weakAspects.join(", ") || "some aspects"}.`,
  };
}

/** A human rank label from an overall 0..100 score. */
export function rankFor(overall: number): string {
  if (overall >= 90) return "Expert";
  if (overall >= 75) return "Proficient";
  if (overall >= 55) return "Developing";
  if (overall >= 35) return "Beginner";
  return "Novice";
}

export { PASS_PCT };
