// Course-level generation: the outline, per-module explainers, on-demand
// quizzes, take-home assignments, and short doubt answers. All calls go through
// the same Gemini JSON pipeline as the explainer author (lib/gemini.ts) and
// share its spoken-English, no-em-dash voice.

import { callGemini, generateExplainer } from "./gemini";
import { hintToPrompt } from "./profile";
import { researchToPrompt } from "./research";
import type {
  Course,
  CourseModule,
  Explainer,
  LearnerHint,
  Quiz,
  QuizOption,
  ResearchBrief,
  Style,
} from "./types";
import type { OutlineModule } from "./store";

// Shared voice rule so every course-level text matches the explainer narration.
const VOICE = `Write in natural, conversational SPOKEN English, like a friendly person talking out loud to one learner. Contractions are good. Do NOT use em dashes or en dashes anywhere (no "—", no "–"); use commas, periods, or separate sentences instead.`;

function stripDashes(s: string): string {
  return s
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*–\s*/g, "-")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---- Stage 0: OUTLINE ------------------------------------------------------

const OUTLINE_SPEC = `You are an expert curriculum designer. Design a COURSE OUTLINE that takes a learner from where they are to their goal, one module at a time.

Rules:
- Order modules by prerequisite: each builds on the ones before it (fundamentals first, then depth, then application).
- The NUMBER of modules is driven by the material and the goal, not a fixed count. A focused goal might be 3-4 modules; a broad one 6-10. Do not pad.
- Each module teaches ONE coherent chunk that can become a single short explainer video.
- ${VOICE}

Output ONLY this JSON:
{
  "title": string,                      // the course title
  "modules": [
    { "title": string, "summary": string, "objectives": [string, ...] }  // 2-4 concrete objectives each
  ]
}

If SOURCE MATERIAL is provided, base the outline on it and stay faithful to its scope.`;

export interface RawOutline {
  title: string;
  modules: OutlineModule[];
}

export async function generateOutline(input: {
  topic: string;
  goals: string[];
  motivation?: string;
  pageText?: string;
  hint?: LearnerHint;
  research?: ResearchBrief;
}): Promise<RawOutline> {
  let text = `Design a course outline.\n\nTOPIC: ${input.topic}`;
  if (input.goals.length) text += `\n\nWHAT THE LEARNER WANTS TO LEARN / GOALS:\n- ${input.goals.join("\n- ")}`;
  if (input.motivation) text += `\n\nWHY THEY WANT THIS (motivation): ${input.motivation}`;
  if (input.pageText?.trim())
    text += `\n\nSOURCE MATERIAL (build the outline from this, tags are [file pN]):\n"""\n${input.pageText.slice(0, 20000)}\n"""`;

  const system = OUTLINE_SPEC + researchToPrompt(input.research) + hintToPrompt(input.hint);
  const raw = (await callGemini(system, [{ text }])) as Record<string, unknown>;

  const title = typeof raw.title === "string" && raw.title.trim() ? stripDashes(raw.title.trim()).slice(0, 90) : input.topic.slice(0, 90);
  const modulesRaw = Array.isArray(raw.modules) ? raw.modules : [];
  const modules: OutlineModule[] = modulesRaw
    .slice(0, 12)
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {}))
    .filter((m) => typeof m.title === "string" && (m.title as string).trim())
    .map((m) => ({
      title: stripDashes((m.title as string).trim()).slice(0, 100),
      summary: typeof m.summary === "string" ? stripDashes(m.summary.trim()).slice(0, 300) : "",
      objectives: Array.isArray(m.objectives)
        ? (m.objectives.filter((o) => typeof o === "string" && o.trim()) as string[])
            .slice(0, 5)
            .map((o) => stripDashes(o.trim()).slice(0, 160))
        : [],
    }));

  if (modules.length === 0) throw new Error("Outline had no usable modules");
  return { title, modules };
}

// ---- Module explainer (adaptive) ------------------------------------------

export async function generateModuleExplainer(
  course: Course,
  mod: CourseModule,
  hint?: LearnerHint,
  // Interactive by default so gated checkpoint questions appear DURING the video.
  style: Style = "interactive"
): Promise<Explainer> {
  const prompt =
    `This is module ${mod.idx + 1} of the course "${course.title}", titled "${mod.title}".\n` +
    (mod.summary ? `Module summary: ${mod.summary}\n` : "") +
    (mod.objectives.length ? `Teach so the learner can: ${mod.objectives.join("; ")}.\n` : "") +
    `Teach ONLY this module's material, assuming earlier modules are already understood.`;

  return generateExplainer({
    prompt,
    style,
    pageText: course.docContext,
    learnerBlock: researchToPrompt(course.research) + hintToPrompt(hint),
  });
}

// ---- On-demand quiz ("quiz me") -------------------------------------------

const QUIZ_SPEC = `You are a teacher writing a short quiz to check understanding of the material just taught. ${VOICE}

Output ONLY this JSON:
{ "quizzes": [
  { "concept": string, "multi": bool, "question": string,
    "options": [ { "text": string, "reason": string }, ... ],
    "correct": [index, ...], "explanation": string }
] }

Rules:
- 3 to 5 questions, each testing a DISTINCT idea from the material.
- 3-4 options each with plausible distractors.
- Every option needs a "reason": one short line saying why it is correct or why it is wrong. This is shown in the review for BOTH right and wrong options, so make each reason specific and useful.
- Set "multi": true only when 2+ options are genuinely correct; mark every correct index.
- "concept" is a short lowercase tag naming the idea tested (used to track mastery).
- "explanation" briefly says why the correct answer(s) are right overall.`;

function normStandaloneQuizzes(raw: unknown): Quiz[] {
  const arr = Array.isArray((raw as Record<string, unknown>)?.quizzes)
    ? ((raw as Record<string, unknown>).quizzes as unknown[])
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  const out: Quiz[] = [];
  arr.slice(0, 8).forEach((r, i) => {
    if (!r || typeof r !== "object") return;
    const q = r as Record<string, unknown>;
    if (typeof q.question !== "string" || !q.question.trim()) return;
    // Options may be plain strings (legacy) or { text, reason } objects.
    const rawOpts = Array.isArray(q.options) ? q.options : [];
    const parsed = rawOpts
      .map((o) => {
        if (typeof o === "string") return { text: o.trim(), reason: "" };
        if (o && typeof o === "object") {
          const oo = o as Record<string, unknown>;
          const text = typeof oo.text === "string" ? oo.text.trim() : "";
          const reason = typeof oo.reason === "string" ? oo.reason.trim() : "";
          return { text, reason };
        }
        return { text: "", reason: "" };
      })
      .filter((o) => o.text);
    if (parsed.length < 2) return;
    const options: QuizOption[] = parsed.slice(0, 4).map((o, k) => ({
      id: `o${k}`,
      text: stripDashes(o.text).slice(0, 200),
      reason: o.reason ? stripDashes(o.reason).slice(0, 240) : undefined,
    }));
    const correctIdx = Array.isArray(q.correct)
      ? [...new Set(q.correct.map((n) => Math.round(Number(n))))].filter((n) => Number.isInteger(n) && n >= 0 && n < options.length)
      : [];
    if (correctIdx.length === 0) return;
    const multi = q.multi === true && correctIdx.length > 1;
    out.push({
      id: `qz${i}`,
      afterScene: -1, // standalone quiz, not tied to a scene checkpoint
      multi,
      question: stripDashes(q.question.trim()).slice(0, 300),
      options,
      correct: (multi ? correctIdx : [correctIdx[0]]).map((n) => options[n].id),
      explanation: typeof q.explanation === "string" ? stripDashes(q.explanation.trim()).slice(0, 500) : "",
      concept: typeof q.concept === "string" ? stripDashes(q.concept.trim()).toLowerCase().slice(0, 60) : undefined,
    });
  });
  return out;
}

export async function generateQuiz(input: { context: string; hint?: LearnerHint }): Promise<Quiz[]> {
  const system = QUIZ_SPEC + hintToPrompt(input.hint);
  const raw = await callGemini(system, [
    { text: `Write a quiz on this material:\n\n"""\n${input.context.slice(0, 8000)}\n"""` },
  ]);
  const quizzes = normStandaloneQuizzes(raw);
  if (quizzes.length === 0) throw new Error("Quiz generation produced no questions");
  return quizzes;
}

// ---- Take-home assignment --------------------------------------------------

const ASSIGN_SPEC = `You are a teacher writing a short TAKE-HOME assignment to help the learner practice what they just learned. ${VOICE}

Output ONLY this JSON:
{ "tasks": [string, ...] }

Rules:
- 3 to 5 concrete tasks the learner can do on their own away from the video.
- Progress from recall to application. Make them specific and doable.`;

export async function generateAssignment(input: { context: string; hint?: LearnerHint }): Promise<string[]> {
  const system = ASSIGN_SPEC + hintToPrompt(input.hint);
  const raw = (await callGemini(system, [
    { text: `Write a take-home assignment for this material:\n\n"""\n${input.context.slice(0, 8000)}\n"""` },
  ])) as Record<string, unknown>;
  const tasks = Array.isArray(raw.tasks)
    ? (raw.tasks.filter((t) => typeof t === "string" && t.trim()) as string[]).slice(0, 6).map((t) => stripDashes(t.trim()).slice(0, 300))
    : [];
  if (tasks.length === 0) throw new Error("Assignment generation produced no tasks");
  return tasks;
}

// ---- Short doubt answer ----------------------------------------------------

const DOUBT_SPEC = `You are a patient tutor answering a learner's question about the module they are studying. ${VOICE}

Answer clearly and directly in 2 to 5 sentences. Stay on the module's topic. If the question is off-topic, gently steer back.

Output ONLY this JSON: { "answer": string }`;

export async function answerDoubt(input: { question: string; context: string; hint?: LearnerHint }): Promise<string> {
  const system = DOUBT_SPEC + hintToPrompt(input.hint);
  const raw = (await callGemini(system, [
    {
      text: `Module material:\n"""\n${input.context.slice(0, 6000)}\n"""\n\nLearner's question: "${input.question}"`,
    },
  ])) as Record<string, unknown>;
  const answer = typeof raw.answer === "string" ? stripDashes(raw.answer.trim()).slice(0, 1200) : "";
  return answer || "I'm not sure how to answer that. Can you rephrase the question?";
}
