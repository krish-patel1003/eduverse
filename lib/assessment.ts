// The typed assessment engine for the Adaptive Tutor. Generates level-calibrated
// assessments whose item mix fits the subject domain, and grades them: MCQ and
// fill-in-the-blank are auto-graded; open items (code, essays, math, short
// answers) are AI-graded via the shared Gemini JSON pipeline. Math is graded on
// the APPROACH and each step, not just the final answer.

import { callGemini } from "./gemini";
import { newId } from "./db";
import { US_PEDAGOGY } from "./pedagogy";
import { VISUAL_SPEC, normalizeVisual } from "./visuals";
import { bandScopePrompt, outOfBand, visualOutOfBand } from "./gradeband";
import { fluencyFrom, judgeTiming, type ItemTiming } from "./timing";
import type {
  AnswerEvidence,
  Assessment,
  AssessmentDomain,
  AssessmentItem,
  AssessmentItemGrade,
  AssessmentItemType,
  AssessmentResult,
  ErrorType,
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
const WORK_IMAGE = /^data:(image\/[a-z+]+);base64,(.+)$/i;
// Reading handwriting is slower than reading text, but it must not run away.
const WORK_TIMEOUT_MS = 90_000;

const WORK_SPEC = `You are marking a photo of a learner's HANDWRITTEN WORKING for one problem.

Mark the METHOD, not just the final number. Credit correct reasoning even where
the final answer is wrong, and say exactly which step went astray. A learner who
set the problem up correctly and slipped on one subtraction has demonstrated far
more than one who wrote nothing.

If the handwriting is genuinely unreadable, set "readable" to false and do not
guess; the learner must never be penalised for messy writing.

Output ONLY this JSON:
{ "readable": bool, "ok": bool, "score": number(0-100), "feedback": string }`;

const ERROR_TYPES = new Set<string>([
  "procedural_slip", "concept_gap", "prerequisite_gap",
  "cannot_justify", "transfer_failure", "notation_error", "guessing",
]);

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

function spec(mode: "diagnostic" | "thorough" | "probe", level?: string, probeSize = 5): string {
  const shape =
    mode === "probe"
      ? `Build a SHORT PLACEMENT PROBE of exactly ${probeSize} items, all pitched squarely at the stated grade band. Spread them across the most important DIFFERENT sub-aspects of the topic at that band, one item per aspect, so a single probe reveals breadth rather than depth. Make them representative of what a learner at this exact band is expected to do, neither the easiest nor the hardest examples. Prefer mcq and short_answer so the probe is quick to answer.`
      : mode === "diagnostic"
      ? `Build an EXHAUSTIVE diagnostic that covers EVERY important sub-aspect of the topic for this education level. 14 to 20 items. Lean on mcq/multi_mcq with a few short_answer, but still include the domain's hands-on types where they reveal understanding.`
      : `Build a THOROUGH check of the specific aspect(s) taught. 5 to 8 items that together test every aspect deeply, using the domain's hands-on item types (not just MCQ).`;
  return `You are an expert assessment designer. ${shape}

CALIBRATE DIFFICULTY AND SCOPE TO THE LEARNER'S EDUCATION LEVEL. A 5th grader's "Mathematics" means 5th-grade arithmetic and fractions; a university student's "Mathematics" means calculus, proofs, linear algebra, etc. Never assess above or below the stated level. ${VOICE}

${US_PEDAGOGY}

${bandScopePrompt(level)}

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
      "rubric": "what a correct answer must demonstrate",  // ALL open (non-auto-graded) items; hidden from the learner
      "visual": { "kind": "fraction_bar", "parts": 8, "shaded": 3 },  // OPTIONAL, see VISUALS below
      "hints": ["a gentle nudge", "a more concrete step"],  // 1-2 progressive hints, see HINTS below
      "expectedSeconds": 25  // how long a learner AT THIS GRADE who knows it should need, thinking time only
    }
  ]
}

${VISUAL_SPEC}

HINTS: give every item 1 or 2 "hints", gentlest first. A hint points at the next
thing to think about, it never states the answer. Hint 1 should be a nudge ("what
do the digits in the tens column add up to?"); hint 2 may walk one concrete step.

EXPECTED TIME: give every item "expectedSeconds", the THINKING time a learner at
this exact grade band who understands the material would need. Do not include
time spent reading the question, that is accounted for separately. Be realistic
for the age: a young child works more slowly than an adult on the same operation.

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
  const visual = normalizeVisual(r.visual);
  if (visual) item.visual = visual;
  const es = Number(r.expectedSeconds);
  if (Number.isFinite(es) && es >= 3 && es <= 600) item.expectedSeconds = Math.round(es);
  if (Array.isArray(r.hints)) {
    const hints = (r.hints.filter((h) => typeof h === "string" && h.trim()) as string[])
      .slice(0, 2)
      .map((h) => stripDashes(h.trim()).slice(0, 240));
    if (hints.length) item.hints = hints;
  }
  return item;
}

export async function generateAssessment(input: {
  topic: string;
  level?: string;
  mode: "diagnostic" | "thorough" | "probe";
  aspects?: string[];
  priorMistakes?: string[];
  /** Item count for a placement probe. */
  probeSize?: number;
  /** Aspects already probed, so a later stage asks about different things. */
  avoidAspects?: string[];
}): Promise<Assessment> {
  let text = `TOPIC: ${input.topic}\nEDUCATION LEVEL: ${input.level || "unspecified"}`;
  if (input.aspects?.length) text += `\nFOCUS ASPECTS (cover each): ${input.aspects.join(", ")}`;
  if (input.priorMistakes?.length)
    text += `\nThe learner previously struggled with: ${input.priorMistakes.join("; ")}. Probe these harder.`;

  if (input.avoidAspects?.length)
    text += `\nALREADY ASKED (choose different sub-aspects): ${input.avoidAspects.join(", ")}`;

  const raw = (await callGemini(spec(input.mode, input.level, input.probeSize), [{ text }])) as Record<string, unknown>;
  const domain = DOMAINS.includes(raw.domain as AssessmentDomain) ? (raw.domain as AssessmentDomain) : "general";
  const generated = (Array.isArray(raw.items) ? raw.items : []).map(normItem).filter((x): x is AssessmentItem => !!x);

  // Prompting alone does not reliably hold the grade band, so screen the output.
  // A figure that breaks the band is dropped on its own; an item whose text
  // breaks it is dropped entirely (we generate more items than we need).
  const rejected: string[] = [];
  const screened = generated.filter((it) => {
    if (it.visual && visualOutOfBand(it.visual, input.level)) delete it.visual;
    const haystack = [it.prompt, ...(it.options ?? []).map((o) => o.text)].join(" ");
    const bad = outOfBand(haystack, input.level);
    // If the learner explicitly asked to work on that concept, honor the request:
    // a Grade 2 child whose topic IS fractions should still get fraction questions.
    if (bad && !outOfBand(input.topic, input.level)) {
      rejected.push(`${bad}: ${it.prompt.slice(0, 60)}`);
      return false;
    }
    return true;
  });
  // Screening must never leave the learner with nothing. If it was too
  // aggressive, keep the original set rather than failing the whole assessment.
  const items = screened.length >= Math.min(3, generated.length) ? screened : generated;
  if (rejected.length && items === screened)
    console.warn(`assessment: dropped ${rejected.length} out-of-band item(s)`, rejected.slice(0, 3));

  if (items.length === 0) throw new Error("Assessment generation produced no items");
  const aspects = [...new Set(items.map((i) => i.aspect))];
  return { id: newId("asmt"), topic: input.topic, domain, level: input.level, aspects, items };
}

// ---- grading ---------------------------------------------------------------

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Render what the learner actually submitted, in readable form. */
function answerText(item: AssessmentItem, ans: unknown): string {
  if (ans == null) return "";
  if (item.type === "mcq" || item.type === "multi_mcq") {
    const picked = Array.isArray(ans) ? (ans as unknown[]).map(String) : [String(ans)];
    return picked
      .map((id) => item.options?.find((o) => o.id === id)?.text ?? id)
      .join("; ");
  }
  if (Array.isArray(ans)) return (ans as unknown[]).map(String).join(" | ");
  return String(ans);
}

/** Render the expected answer for auto-graded items. */
function expectedText(item: AssessmentItem): string {
  if (item.type === "mcq" || item.type === "multi_mcq") {
    return (item.correct ?? [])
      .map((id) => item.options?.find((o) => o.id === id)?.text ?? id)
      .join("; ");
  }
  if (item.type === "fill_blank") return (item.correct ?? []).join(" | ");
  return "";
}

const GRADE_SPEC = `You are a fair, rigorous grader. For each open item you are given the task, a hidden rubric, and the learner's answer. Grade how well the answer meets the rubric. ${VOICE}

HANDWRITTEN WORKING: some items come with a photo of what the learner wrote by
hand. When one is present, mark the METHOD shown in the working, not only the
typed answer. Credit correct reasoning even where the final number is wrong, and
say in the feedback exactly which step went astray. If the handwriting is genuinely
unreadable, grade the typed answer and do not penalise the learner for it.

For code: judge correctness and whether it would work, not style. For math_multistep: reward a correct APPROACH and correct steps; do not fail an answer for a tiny arithmetic slip if the method is right. For essays/short answers: judge substance against the rubric, not length.

Output ONLY this JSON:
{ "grades": [ { "id": string, "ok": bool, "score": number(0-100), "feedback": string } ] }  // one per item, same ids`;

// Naming the underlying error is what makes remediation intelligent: "wrong on
// multi_digit_addition" tells us nothing, "adds each column independently and
// never carries" tells us exactly what to reteach, and how far to drop.
const DIAGNOSE_SPEC = `You are a diagnostic teacher looking at questions a learner got WRONG. For each one, work out the UNDERLYING misconception, not a restatement that they were wrong. ${VOICE}

Think about what belief or missing skill would produce exactly that answer.
- Good: "adds each column separately and never carries the ten", "treats the denominator like a whole number", "reverses cause and effect".
- Bad: "did not know the answer", "made a mistake", "needs more practice".

Also name the single PREREQUISITE SKILL the learner is missing, phrased as something teachable (e.g. "regrouping ones into tens", "single digit addition facts to 10").

Also classify the ERROR TYPE, which is what decides HOW we re-teach. Pick exactly one:
- "procedural_slip": they know the method, they slipped executing it
- "concept_gap": they do not understand what the operation actually means
- "prerequisite_gap": an earlier, lower skill is missing
- "cannot_justify": the answer is right or nearly right but the reasoning is absent or wrong
- "transfer_failure": routine versions would be fine, this novel version defeated them
- "notation_error": they understand it but wrote or formatted it incorrectly
- "guessing": there is no discernible method at all

Output ONLY this JSON:
{ "diagnoses": [ { "id": string, "misconception": string, "missingSkill": string, "errorType": string } ] }`;

export interface MasterySignal {
  /** Raw percentage correct. */
  raw: number;
  /** Percentage of items answered correctly with NO hints. */
  independent: number;
  /** Total hints revealed across the assessment. */
  hintsUsed: number;
  /**
   * The score mastery is judged on. Correct-with-hints counts, but only
   * partially: getting there after two hints is real progress, not fluency.
   */
  effective: number;
}

export async function gradeAssessment(input: {
  assessment: Assessment;
  answers: Record<string, unknown>;
  /** Hints revealed per item id, for the mastery signal. */
  hintsUsed?: Record<string, number>;
  /** ACTIVE seconds per item id, for the timing signal. */
  seconds?: Record<string, number>;
  /** Handwritten working per item id, as a data URL. */
  working?: Record<string, string>;
}): Promise<AssessmentResult> {
  const { assessment, answers } = input;
  const hintsUsed = input.hintsUsed ?? {};
  const hintsFor = (id: string) => Math.max(0, Math.round(Number(hintsUsed[id]) || 0));
  const secondsIn = input.seconds ?? {};
  const workingIn = input.working ?? {};
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
        // Working counts as an attempt: a child who wrote it out but typed
        // nothing has not left the question blank.
        const blank = !String(answers[it.id] ?? "").trim() && !workingIn[it.id];
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

    // Handwritten working is graded SEPARATELY, one item at a time. Reading an
    // image is much slower than reading text, so bundling it into the call above
    // meant a single slow read stalled grading for every open item. Each pass
    // here is independently timed and independently allowed to fail: if it does,
    // the typed grade already computed above simply stands.
    const withWork = openItems.filter((it) => WORK_IMAGE.test(String(workingIn[it.id] ?? "")));
    await Promise.all(
      withWork.map(async (it) => {
        const m = String(workingIn[it.id]).match(WORK_IMAGE);
        if (!m) return;
        try {
          const raw = (await callGemini(
            WORK_SPEC,
            [
              { text: `Task: ${it.prompt}\nRubric: ${it.rubric ?? ""}\nTyped answer: ${String(answers[it.id] ?? "").trim() || "(none, the working is the answer)"}` },
              { inlineData: { mimeType: m[1], data: m[2] } },
            ],
            WORK_TIMEOUT_MS
          )) as Record<string, unknown>;
          const g = perItem.find((p) => p.itemId === it.id);
          if (!g || raw.readable === false) return;
          const score = typeof raw.score === "number" ? Math.max(0, Math.min(100, Math.round(raw.score))) : g.score;
          // Marking the method can only ever help: a child who showed correct
          // working keeps the better of the two grades.
          if (score > g.score) {
            g.score = score;
            g.correct = raw.ok === true || score >= PASS_PCT;
          }
          if (typeof raw.feedback === "string" && raw.feedback.trim())
            g.feedback = stripDashes(raw.feedback.trim()).slice(0, 500);
        } catch (err) {
          console.warn(`working grade failed for ${it.id}:`, (err as Error)?.message);
        }
      })
    );
  }

  const byIdEarly0 = new Map(perItem.map((p) => [p.itemId, p]));
  for (const g of perItem) g.hintsUsed = hintsFor(g.itemId);

  // Judge response times. This runs BEFORE diagnosis on purpose: an answer that
  // was never really attempted must not be fed to the misconception pass, which
  // would otherwise invent a confident misconception from a random click and
  // steer the whole re-teach from noise.
  const timingById = new Map<string, ItemTiming>();
  if (Object.keys(secondsIn).length) {
    for (const it of assessment.items) {
      const g = byIdEarly0.get(it.id);
      timingById.set(
        it.id,
        judgeTiming({ item: it, seconds: Number(secondsIn[it.id]) || 0, correct: g?.correct ?? false })
      );
    }
  }

  // 3. Diagnose every WRONG item: name the misconception behind the answer.
  //    This is the signal the remediation loop reasons over, so it covers
  //    auto-graded items too (an MCQ distractor is often the clearest tell).
  const byIdEarly = byIdEarly0;
  const wrong = assessment.items.filter((it) => {
    const g = byIdEarly.get(it.id);
    if (!g || g.correct) return false;
    // Skip non-attempts: they carry no information about what the learner believes.
    return !timingById.get(it.id)?.discardAsEvidence;
  });
  if (wrong.length) {
    const payload = wrong
      .map((it) => {
        const given = answerText(it, answers[it.id]);
        return `id: ${it.id}\nSkill area: ${it.aspect}\nQuestion: ${it.prompt}\nLearner answered: ${given || "(blank)"}\nCorrect answer: ${expectedText(it) || "(see rubric) " + (it.rubric ?? "")}`;
      })
      .join("\n\n---\n\n");
    try {
      const raw = (await callGemini(DIAGNOSE_SPEC, [{ text: payload }])) as Record<string, unknown>;
      const list = Array.isArray(raw.diagnoses) ? raw.diagnoses : [];
      for (const it of wrong) {
        const d = (list.find((x) => (x as { id?: string })?.id === it.id) ?? {}) as Record<string, unknown>;
        const g = byIdEarly.get(it.id)!;
        if (typeof d.misconception === "string") g.misconception = stripDashes(d.misconception.trim()).slice(0, 240);
        if (typeof d.missingSkill === "string") g.missingSkill = stripDashes(d.missingSkill.trim()).slice(0, 120);
        if (typeof d.errorType === "string" && ERROR_TYPES.has(d.errorType)) g.errorType = d.errorType as ErrorType;
      }
    } catch {
      /* diagnosis is best-effort; grading still stands */
    }
  }

  // 4. Aggregate per aspect + overall.
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

  // Full per-item record, so the next round can see WHAT went wrong, not just
  // which tag failed.
  const evidence: AnswerEvidence[] = assessment.items.map((it) => {
    const g = byId.get(it.id);
    return {
      aspect: it.aspect,
      type: it.type,
      question: it.prompt,
      learnerAnswer: answerText(it, answers[it.id]),
      expected: expectedText(it) || undefined,
      correct: g?.correct ?? false,
      score: g?.score ?? 0,
      misconception: g?.misconception,
      missingSkill: g?.missingSkill,
      hintsUsed: g?.hintsUsed ?? 0,
      errorType: g?.errorType,
      hadVisual: !!it.visual,
      seconds: timingById.get(it.id)?.seconds,
      timing: timingById.get(it.id)?.verdict,
    };
  });

  // Mastery is not just "did they get it right". A correct answer reached after
  // two hints is progress, not fluency, so hint use discounts the score mastery
  // is judged on. Independent success is tracked separately.
  const total = perItem.length || 1;
  const independentWins = perItem.filter((p) => p.correct && (p.hintsUsed ?? 0) === 0).length;
  const totalHints = perItem.reduce((n, p) => n + (p.hintsUsed ?? 0), 0);
  const credited = perItem.reduce((sum, p) => {
    if (!p.correct) return sum + p.score * 0.5;
    // Full credit unaided, 80% after one hint, 60% after two or more.
    const h = p.hintsUsed ?? 0;
    return sum + (h === 0 ? 1 : h === 1 ? 0.8 : 0.6);
  }, 0);
  const mastery: MasterySignal = {
    raw: overall,
    independent: Math.round((independentWins / total) * 100),
    hintsUsed: totalHints,
    effective: Math.round((credited / total) * 100),
  };

  for (const g of perItem) {
    const t = timingById.get(g.itemId);
    if (t) {
      g.seconds = t.seconds;
      g.timing = t.verdict;
    }
  }
  const fluency = timingById.size ? fluencyFrom([...timingById.values()], overall) : undefined;

  return {
    perItem,
    perAspect,
    overall,
    passed,
    weakAspects,
    evidence,
    mastery,
    fluency,
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
