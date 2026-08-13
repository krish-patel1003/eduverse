import type {
  ArtStyle,
  Beat,
  BeatOp,
  Citation,
  Connector,
  Entrance,
  Explainer,
  Fidelity,
  GroundedPart,
  Quiz,
  QuizOption,
  Scene,
  SceneObject,
  Style,
  VLabel,
} from "./types";
import { CANVAS_H, CANVAS_W } from "./types";
import { synthesizeScenes } from "./tts";
import { generateObjectImages, generateSceneImage, usingImages } from "./imagegen";
import { renderHiFiScenes, usingHiFi } from "./drawscene";
import { groundParts } from "./grounding";
import { fixSceneLayout } from "./layout";
import type { Figure, Source } from "./extract";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const apiKey = process.env.GEMINI_API_KEY;
export const usingGemini = Boolean(apiKey);

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export async function callGemini(system: string, parts: Part[]): Promise<unknown> {
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 400)}`);
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini returned no text");
  return JSON.parse(text);
}

const ENTRANCES: Entrance[] = ["fade", "pop", "grow", "slideL", "slideR", "slideU", "slideD", "draw"];

// ---- Stage 1: AUTHOR — write the explanation + teaching script (+ quizzes) ---
// Content is authored FIRST, as text, before any visuals are considered. The
// number of scenes is driven by the material, not a fixed count.

const AUTHOR_SPEC = `You are an expert teacher and scriptwriter. Your job is to CONTENT-AUTHOR an explainer — no visuals yet.

Work in this exact order (think it through before writing the JSON):
1. Understand the request and any SOURCE MATERIAL completely and accurately.
2. Mentally write the FULL, correct explanation, everything a learner needs to truly understand it.
3. Turn that into a spoken video SCRIPT: an ordered sequence of SCENES. Each scene teaches ONE coherent step or subtopic; build understanding progressively (topic, then subtopic, then detail).
4. The FIRST scene MUST open with a strong HOOK: a curious question, a surprising fact, or a vivid everyday framing that makes the viewer want to keep watching, before you dive into the explanation.
5. The LAST scene MUST be a clear SUMMARY that recaps the key points the viewer just learned and leaves them with the big takeaway. It is a real closing recap, NEVER a question.

How long? The number of scenes is decided ENTIRELY by the material. A simple idea might need 3 scenes; a rich or document-backed topic many more. Do not pad, do not truncate, teach it properly and completely.

Each scene's "narration" is exactly what the narrator SAYS (usually 1-4 sentences). It must be factually correct.

VOICE: write in natural, conversational SPOKEN English, like a friendly person explaining it out loud to one curious listener. Contractions are good. Keep sentences easy to say aloud. Do NOT use em dashes or en dashes anywhere (no "—", no "–"); use commas, periods, or separate sentences instead. This applies to every narration line and every quiz.

Choose ONE art style for the whole explainer (used later by the art director):
- "flat"   → clean flat-vector (technical, systems, math, business).
- "marker" → colorful hand-drawn marker (biology, everyday concepts, stories, narratives).

Output ONLY this JSON:
{
  "title": string,
  "artStyle": "flat" | "marker",
  "scenes": [
    { "narration": string, "citations": [ { "source": "file.pdf", "page": number } ] }
  ],
  "quizzes": []
}

SOURCE MATERIAL: when documents are attached, build the explanation FROM them and stay faithful. Source text is tagged "[file.pdf p3] ...". Add "citations" (exact file + page) to every scene that drew from it. Omit "citations" (or []) for scenes that didn't.`;

// Appended to AUTHOR_SPEC only in interactive mode: quizzes are drafted here, as
// part of authoring, so they are woven into the content and each tests a
// different idea (no rephrasings), with a natural mix of single/multi-select.
const QUIZ_INSTR = `

INTERACTIVE QUIZZES — draft checkpoint questions NOW, as part of the script (fill the "quizzes" array):
- Place each question right after the scene where its concept was just taught. "afterScene" is that scene's 0-based index and MUST be strictly less than the last scene index (NEVER quiz the final conclusion scene).
- A question may ONLY test content taught in scenes at or before its afterScene — never anything explained later.
- Every question must test a DISTINCT idea. No two may be rephrasings of each other or cover the same fact.
- MIX the format naturally and unpredictably: some are single-answer, others are select-all-that-apply. For a select-all question set "multi": true and mark EVERY correct option; make sure some questions genuinely have 2+ correct options.
- 3-4 options each, plausible distractors, and a concise "explanation" of why the answer is right (shown to the learner whether they were right or wrong).
- Add as many checkpoints as the material warrants (roughly one per meaningful chunk), spread across the video.
Each quiz object: { "afterScene": int, "multi": bool, "question": string, "options": [string, ...], "correct": [index, ...], "explanation": string }`;

// ---- Stage 2: STORYBOARD — art-direct the finished script -------------------
// Given the fixed narration, decide the illustration + animation for each scene.
// The narration is NEVER rewritten here.

const STORYBOARD_SPEC = `You are an explainer-video art director. You are given a FINISHED SCRIPT: an ordered list of scenes, each with fixed narration you must NOT change. Design the VISUAL for every scene.

Canvas: ${CANVAS_W}x${CANVAS_H} (16:9, origin top-left).

Return exactly ONE visual per input scene, in the SAME ORDER, same count.

Pick a STRATEGY per scene:
- "A" (illustrate) — the scene is ONE coherent illustration; beats spotlight/annotate its named parts as the narration reaches them. Use for anatomy, phenomena, objects, analogies, part-of-a-whole — MOST scenes. PREFER THIS.
- "B" (diagram) — composed objects + connector arrows. Use ONLY for genuine processes, flows, pipelines, systems, or comparisons.

Output ONLY this JSON:
{
  "scenes": [
    // ---- Strategy A ----
    {
      "strategy": "A",
      "imagePrompt": "ONE cohesive illustration describing the WHOLE scene and where each part sits (e.g. 'a cross-section of a leaf: chloroplasts inside cells, sunlight arrows from top-left, water rising from the stem at the bottom').",
      "parts": ["chloroplast", "sunlight", "water"],
      "beats": [ { "say": "a verbatim span of THIS scene's narration", "op": "intro"|"spotlight"|"annotate"|"zoom"|"dim", "target": "a part name (omit for whole-scene beats)", "label": "short optional callout" } ]
    },
    // ---- Strategy B ----
    {
      "strategy": "B",
      "objects": [ { "id": "short_id", "prompt": "one clear subject", "x": num,"y": num,"w": num,"h": num, "entrance": "fade"|"pop"|"grow"|"slideL"|"slideR"|"slideU"|"slideD"|"draw", "sourceFigureId": "figN (optional)" } ],
      "connectors": [ { "from": "obj_id", "to": "obj_id", "label": "optional", "color": "#hex optional" } ],
      "labels": [ { "x": num,"y": num,"text": "1-3 words", "weight": "bold"|"normal", "color": "#hex optional" } ]
    }
  ]
}

Rules:
- Strategy A: imagePrompt is ONE coherent picture containing all the parts positioned sensibly. Split THAT scene's narration into 3-6 consecutive "beats" — the concatenation of all beats' "say" MUST equal the narration verbatim (word for word). The first beat is usually "intro"; later beats "spotlight"/"annotate"/"zoom" the individual parts as they are mentioned. Each beat's "target" MUST be one of "parts" (or omitted).
- Strategy B: object prompts are SINGLE concrete subjects (no scenery, no text); lay boxes out spaciously; connectors show relationships.
- Attached FIGURES may be reused: on a Strategy B object set "sourceFigureId":"figN".`;

// ---- normalization ---------------------------------------------------------

// Hard guarantee: no em/en dashes anywhere in generated text. Em dashes become a
// comma pause (natural in speech), en dashes become plain hyphens. Regular
// hyphens in words are left untouched.
function stripDashes(s: string): string {
  return s
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*–\s*/g, "-")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clamp(n: unknown, lo: number, hi: number, fb: number): number {
  const v = typeof n === "number" && isFinite(n) ? n : fb;
  return Math.max(lo, Math.min(hi, v));
}

function normObjects(raw: unknown, sceneIdx: number): SceneObject[] {
  if (!Array.isArray(raw)) return [];
  const out: SceneObject[] = [];
  raw.slice(0, 5).forEach((r, i) => {
    if (!r || typeof r !== "object") return;
    const o = r as Record<string, unknown>;
    if (typeof o.prompt !== "string" || !o.prompt.trim()) return;
    const entrance = ENTRANCES.includes(o.entrance as Entrance)
      ? (o.entrance as Entrance)
      : ENTRANCES[i % ENTRANCES.length];
    out.push({
      id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : `s${sceneIdx}o${i}`,
      prompt: o.prompt.trim().slice(0, 200),
      x: clamp(o.x, 0, CANVAS_W - 40, 80 + i * 160),
      y: clamp(o.y, 0, CANVAS_H - 40, 120),
      w: clamp(o.w, 40, CANVAS_W, 150),
      h: clamp(o.h, 40, CANVAS_H, 150),
      entrance,
      sourceFigureId:
        typeof o.sourceFigureId === "string" && o.sourceFigureId.trim()
          ? o.sourceFigureId.trim()
          : undefined,
    });
  });
  return out;
}

function normCitations(raw: unknown): Citation[] {
  if (!Array.isArray(raw)) return [];
  const out: Citation[] = [];
  raw.slice(0, 6).forEach((r) => {
    if (!r || typeof r !== "object") return;
    const c = r as Record<string, unknown>;
    if (typeof c.source !== "string" || !c.source.trim()) return;
    out.push({
      source: c.source.trim().slice(0, 120),
      page: typeof c.page === "number" && isFinite(c.page) ? Math.max(1, Math.round(c.page)) : undefined,
    });
  });
  return out;
}

function normConnectors(raw: unknown, ids: Set<string>): Connector[] {
  if (!Array.isArray(raw)) return [];
  const out: Connector[] = [];
  raw.slice(0, 4).forEach((r) => {
    if (!r || typeof r !== "object") return;
    const c = r as Record<string, unknown>;
    const from = typeof c.from === "string" ? c.from : undefined;
    const to = typeof c.to === "string" ? c.to : undefined;
    if (!from || !to || !ids.has(from) || !ids.has(to)) return;
    out.push({
      from,
      to,
      label: typeof c.label === "string" ? stripDashes(c.label).slice(0, 24) : undefined,
      color: typeof c.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c.color) ? c.color : undefined,
      curve: typeof c.curve === "number" ? Math.max(-1, Math.min(1, c.curve)) : 0.2,
    });
  });
  return out;
}

function normLabels(raw: unknown): VLabel[] {
  if (!Array.isArray(raw)) return [];
  const out: VLabel[] = [];
  raw.slice(0, 6).forEach((r) => {
    if (!r || typeof r !== "object") return;
    const l = r as Record<string, unknown>;
    if (typeof l.text !== "string" || !l.text.trim()) return;
    out.push({
      x: clamp(l.x, 0, CANVAS_W, 80),
      y: clamp(l.y, 0, CANVAS_H, 60),
      text: stripDashes(l.text.trim()).slice(0, 40),
      weight: l.weight === "bold" ? "bold" : "normal",
      color: typeof l.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(l.color) ? l.color : undefined,
      size: clamp(l.size, 12, 40, 20),
    });
  });
  return out;
}

const BEAT_OPS: BeatOp[] = ["intro", "spotlight", "annotate", "zoom", "dim"];

function normBeats(raw: unknown): Beat[] {
  if (!Array.isArray(raw)) return [];
  const out: Beat[] = [];
  raw.slice(0, 10).forEach((r) => {
    if (!r || typeof r !== "object") return;
    const b = r as Record<string, unknown>;
    const say = typeof b.say === "string" ? b.say.trim() : "";
    if (!say) return;
    out.push({
      say: stripDashes(say.slice(0, 300)),
      op: BEAT_OPS.includes(b.op as BeatOp) ? (b.op as BeatOp) : "spotlight",
      target:
        typeof b.target === "string" && b.target.trim() ? b.target.trim().toLowerCase() : undefined,
      label: typeof b.label === "string" && b.label.trim() ? stripDashes(b.label.trim()).slice(0, 40) : undefined,
    });
  });
  return out;
}

// A high safety bound so a runaway plan can't blow past the 300s generation
// budget. Scene COUNT within this is decided by the author from the material.
const MAX_SCENES = 16;

interface AuthoredScene {
  narration: string;
  citations: Citation[];
}

function normAuthoredScenes(raw: unknown): AuthoredScene[] {
  if (!Array.isArray(raw)) return [];
  const out: AuthoredScene[] = [];
  for (const rs of raw.slice(0, MAX_SCENES)) {
    if (!rs || typeof rs !== "object") continue;
    const s = rs as Record<string, unknown>;
    const narration = typeof s.narration === "string" ? s.narration.trim() : "";
    if (!narration) continue;
    out.push({ narration: stripDashes(narration).slice(0, 1200), citations: normCitations(s.citations) });
  }
  return out;
}

function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g);
  return parts && parts.length ? parts.map((s) => s.trim()).filter(Boolean) : [text];
}

// If the storyboard didn't return usable beats, derive them from the authored
// narration itself so the caption always matches the spoken audio.
function fallbackBeats(narration: string, partNames: string[]): Beat[] {
  const sents = splitSentences(narration);
  return sents.map((say, i) => ({
    say,
    op: i === 0 ? "intro" : ("spotlight" as BeatOp),
    target: i > 0 && partNames.length ? partNames[(i - 1) % partNames.length] : undefined,
  }));
}

// Merge the authored script (source of truth for narration) with the
// storyboard's per-scene visual plan (aligned by index).
function mergeScenes(authored: AuthoredScene[], sbRaw: unknown): Scene[] {
  const sb = Array.isArray(sbRaw) ? sbRaw : [];
  return authored.map((a, i) => {
    const s = (sb[i] && typeof sb[i] === "object" ? sb[i] : {}) as Record<string, unknown>;
    const isA = s.strategy === "B" ? false : !Array.isArray(s.objects) || s.strategy === "A";

    if (isA) {
      const imagePrompt = typeof s.imagePrompt === "string" ? s.imagePrompt.trim() : "";
      const partNames = Array.isArray(s.parts)
        ? (s.parts.filter((p) => typeof p === "string") as string[])
            .slice(0, 6)
            .map((n) => n.trim().toLowerCase())
        : [];
      let beats = normBeats(s.beats);
      // Guard: if the storyboard's beats don't reproduce most of the narration,
      // rebuild them from the narration so nothing authored gets dropped.
      const covered = beats.map((b) => b.say).join(" ").length;
      if (beats.length === 0 || covered < a.narration.length * 0.6) {
        beats = fallbackBeats(a.narration, partNames);
      }
      const parts: GroundedPart[] = partNames.map((n) => ({ name: n, x: 0, y: 0, w: 0, h: 0 }));
      return {
        id: `s${i}`,
        strategy: "A",
        narration: a.narration,
        imagePrompt,
        parts,
        beats,
        citations: a.citations,
      };
    }

    const objects = normObjects(s.objects, i);
    const ids = new Set(objects.map((o) => o.id));
    const connectors = normConnectors(s.connectors, ids);
    const labels = normLabels(s.labels);
    return { id: `s${i}`, strategy: "B", narration: a.narration, objects, connectors, labels, citations: a.citations };
  });
}

interface RawQuiz {
  afterScene?: number;
  multi?: boolean;
  question?: string;
  options?: unknown;
  correct?: unknown;
  explanation?: string;
}

// Normalize author-drafted quizzes: valid options, valid correct indices, and
// crucially never on the final (conclusion) scene.
function normalizeQuizzes(raw: unknown, sceneCount: number): Quiz[] {
  if (!Array.isArray(raw) || sceneCount < 2) return [];
  const out: Quiz[] = [];
  const usedScenes = new Set<number>();
  raw.forEach((r, i) => {
    if (!r || typeof r !== "object") return;
    const q = r as RawQuiz;
    if (typeof q.question !== "string" || !q.question.trim()) return;
    const after = Math.round(Number(q.afterScene));
    // Must land on a real scene BEFORE the conclusion, and once per scene.
    if (!Number.isFinite(after) || after < 0 || after > sceneCount - 2) return;
    if (usedScenes.has(after)) return;
    const texts = Array.isArray(q.options)
      ? (q.options.filter((o) => typeof o === "string" && o.trim()) as string[])
      : [];
    if (texts.length < 2) return;
    const options: QuizOption[] = texts.slice(0, 4).map((t, k) => ({ id: `o${k}`, text: stripDashes(t.trim()).slice(0, 200) }));
    const correctIdx = Array.isArray(q.correct)
      ? [...new Set(q.correct.map((n) => Math.round(Number(n))))].filter(
          (n) => Number.isInteger(n) && n >= 0 && n < options.length
        )
      : [];
    if (correctIdx.length === 0) return;
    const multi = q.multi === true && correctIdx.length > 1;
    const correct = (multi ? correctIdx : [correctIdx[0]]).map((n) => options[n].id);
    usedScenes.add(after);
    out.push({
      id: `q${after}_${i}`,
      afterScene: after,
      multi,
      question: stripDashes(q.question.trim()).slice(0, 300),
      options,
      correct,
      explanation: typeof q.explanation === "string" ? stripDashes(q.explanation.trim()).slice(0, 500) : "",
    });
  });
  return out.sort((a, b) => a.afterScene - b.afterScene);
}

function makeId(): string {
  try {
    return (globalThis.crypto as Crypto).randomUUID();
  } catch {
    return `ex_${Date.now().toString(36)}`;
  }
}

async function attachNarration(scenes: Scene[]): Promise<void> {
  try {
    const audios = await synthesizeScenes(scenes.map((s) => s.narration));
    scenes.forEach((s, i) => {
      const a = audios[i];
      if (a) {
        s.audioUrl = a.dataUrl;
        s.durationMs = a.durationMs;
      }
    });
  } catch (err) {
    console.error("narration attach failed:", err);
  }
}

// Strategy A: generate one coherent image per scene (style-anchored) and ground
// its named parts to boxes for the beat-synced spotlight reveal.
async function renderStrategyA(scenes: Scene[], style: ArtStyle): Promise<void> {
  if (!usingImages) return;
  const aScenes = scenes.filter((s) => s.strategy === "A" && s.imagePrompt);
  if (aScenes.length === 0) return;

  const first = aScenes[0];
  const firstImg = await generateSceneImage(first.imagePrompt!, style);
  const anchor = firstImg ? { data: firstImg.b64, mime: firstImg.mime } : undefined;
  const pairs = [{ scene: first, img: firstImg }];
  const rest = await Promise.all(
    aScenes.slice(1).map(async (s) => ({
      scene: s,
      img: await generateSceneImage(s.imagePrompt!, style, anchor),
    }))
  );
  pairs.push(...rest);

  await Promise.all(
    pairs.map(async ({ scene, img }) => {
      if (!img) return;
      scene.sceneImageUrl = img.url;
      const names = (scene.parts ?? []).map((p) => p.name);
      scene.parts = names.length ? await groundParts(img.b64, img.mime, names) : [];
    })
  );
}

// ---- Stage 2 call: art-direct the authored script --------------------------
async function storyboardScenes(
  authored: AuthoredScene[],
  figures?: Figure[]
): Promise<unknown> {
  let text = "SCRIPT — design one visual per scene, same order, do NOT change any narration:\n\n";
  authored.forEach((a, i) => {
    text += `Scene ${i} narration: "${a.narration}"\n`;
  });
  if (figures?.length) {
    text +=
      `\nATTACHED FIGURES you may reuse (set a Strategy-B object's "sourceFigureId" to one of these ids). The images follow in order:\n` +
      figures.map((f) => `- ${f.id}: from ${f.source}${f.page ? ` p${f.page}` : ""}`).join("\n");
  }
  const parts: Part[] = [{ text }];
  for (const f of figures ?? []) parts.push({ inlineData: { mimeType: f.mime, data: f.b64 } });
  const raw = (await callGemini(STORYBOARD_SPEC, parts)) as Record<string, unknown>;
  return raw.scenes;
}

// ---- Stage 3+4: assemble scenes, generate assets, attach TTS + quizzes ------
async function buildExplainer(
  authored: AuthoredScene[],
  quizRaw: unknown,
  artStyle: ArtStyle,
  title: string,
  style: Style,
  createdFrom: string,
  figures?: Figure[],
  sources?: Source[],
  fidelity: Fidelity = "fast"
): Promise<Explainer> {
  if (authored.length === 0) throw new Error("Author produced no usable scenes");

  const sbRaw = await storyboardScenes(authored, figures);
  const scenes = mergeScenes(authored, sbRaw);

  // Layout eval: clamp anything off-canvas and separate overlaps before assets.
  const layoutIssues = fixSceneLayout(scenes);
  if (layoutIssues.length) {
    console.warn(`layout eval fixed ${layoutIssues.length} issue(s):`, layoutIssues.slice(0, 12));
  }

  const figMap = new Map((figures ?? []).map((f) => [f.id, f]));
  const allObjects = scenes.flatMap((s) => s.objects ?? []);
  for (const s of scenes) {
    for (const o of s.objects ?? []) {
      if (o.sourceFigureId && figMap.has(o.sourceFigureId)) {
        const fig = figMap.get(o.sourceFigureId)!;
        o.imageUrl = fig.url;
        const has = (s.citations ?? []).some((c) => c.source === fig.source && c.page === fig.page);
        if (!has) s.citations = [...(s.citations ?? []), { source: fig.source, page: fig.page }];
      } else {
        o.sourceFigureId = undefined;
      }
    }
  }
  const toGenerate = allObjects.filter((o) => !o.imageUrl);

  // Hi-fi draws each scene as a chain of edit passes (real build-up keyframes)
  // and needs no object images or part grounding; the drawing carries its own
  // labels. Fast mode keeps the original single-image + entrance pipeline.
  const hifi = fidelity === "hifi" && usingHiFi;
  await Promise.all([
    hifi
      ? renderHiFiScenes(scenes)
      : Promise.all([
          usingImages ? generateObjectImages(toGenerate, artStyle) : Promise.resolve(),
          renderStrategyA(scenes, artStyle),
        ]),
    attachNarration(scenes),
  ]);

  const quizzes = style === "interactive" ? normalizeQuizzes(quizRaw, scenes.length) : [];

  const seenSrc = new Map<string, { name: string; url?: string }>();
  for (const s of sources ?? []) if (!seenSrc.has(s.name)) seenSrc.set(s.name, { name: s.name, url: s.url });
  const srcList = [...seenSrc.values()];

  return {
    id: makeId(),
    title: title.trim() ? stripDashes(title.trim()).slice(0, 90) : createdFrom.slice(0, 60),
    style,
    artStyle,
    scenes,
    quizzes: quizzes.length ? quizzes : undefined,
    sources: srcList.length ? srcList : undefined,
    createdFrom: createdFrom.slice(0, 80),
  };
}

export async function generateExplainer(input: {
  prompt: string;
  style: Style;
  pageText?: string;
  figures?: Figure[];
  sources?: Source[];
  prior?: { history?: string[]; lastTitle?: string; lastSummary?: string };
  /** Adaptive block (from the student profile) appended to the author prompt. */
  learnerBlock?: string;
  /** "hifi" draws each scene as build-up keyframes (slower, higher fidelity). */
  fidelity?: Fidelity;
}): Promise<Explainer> {
  // Stage 1 — AUTHOR: write the explanation + teaching script (+ quizzes when
  // interactive) as text, before any visuals are considered.
  const parts: Part[] = [];
  let userText = "";
  const prior = input.prior;
  if (prior && (prior.history?.length || prior.lastTitle)) {
    userText += "CONVERSATION SO FAR (oldest first):\n";
    (prior.history ?? []).forEach((h) => (userText += `- ${h}\n`));
    if (prior.lastTitle) userText += `The explainer currently on screen is "${prior.lastTitle}".\n`;
    if (prior.lastSummary) userText += `It covered: "${prior.lastSummary}"\n`;
    userText +=
      `\nUse this conversation to resolve references like "it", "that", "the previous one", "simpler", "for kids", "add examples". ` +
      `If the new request refines the current topic, keep the SAME underlying subject and change only depth, tone, or framing. ` +
      `Only switch to a different subject if the new request is clearly about something else.\n\n`;
  }
  userText += `Author an explainer for this request:\n\n"${input.prompt}"`;
  if (input.pageText?.trim()) {
    userText +=
      `\n\nSOURCE MATERIAL — build the explanation from this and cite it by page (tags are [file pN]):\n"""\n${input.pageText}\n"""`;
  }
  if (input.figures?.length) {
    userText +=
      `\n\nATTACHED FIGURES (also available to the art director later):\n` +
      input.figures.map((f) => `- ${f.id}: from ${f.source}${f.page ? ` p${f.page}` : ""}`).join("\n");
  }
  parts.push({ text: userText });
  for (const f of input.figures ?? []) parts.push({ inlineData: { mimeType: f.mime, data: f.b64 } });

  const system =
    AUTHOR_SPEC + (input.style === "interactive" ? QUIZ_INSTR : "") + (input.learnerBlock ?? "");
  const raw = (await callGemini(system, parts)) as Record<string, unknown>;
  const authored = normAuthoredScenes(raw.scenes);
  const artStyle: ArtStyle = raw.artStyle === "marker" ? "marker" : "flat";
  const title = typeof raw.title === "string" ? raw.title : "";
  return buildExplainer(
    authored,
    raw.quizzes,
    artStyle,
    title,
    input.style,
    input.prompt,
    input.figures,
    input.sources,
    input.fidelity ?? "fast"
  );
}

export async function reExplainRange(input: {
  originalTitle: string;
  style: Style;
  focusNarration: string;
  userNote?: string;
  /** Adaptive block (from the student profile) appended to the author prompt. */
  learnerBlock?: string;
}): Promise<Explainer> {
  const system =
    AUTHOR_SPEC +
    (input.style === "interactive" ? QUIZ_INSTR : "") +
    `\n\nThis is a RE-EXPLANATION. The learner did not understand a part of a previous explainer. Slow down, use a FRESH analogy, and break it into smaller, clearer steps. Focus ONLY on the confusing part. Still end on a short conclusion.` +
    (input.learnerBlock ?? "");
  const userText = `Original explainer: "${input.originalTitle}".\nThe confusing section (transcript):\n"""\n${input.focusNarration.slice(0, 6000)}\n"""${
    input.userNote ? `\n\nWhat confused them: "${input.userNote}"` : ""
  }\n\nRe-explain just this part, simpler and clearer.`;

  const raw = (await callGemini(system, [{ text: userText }])) as Record<string, unknown>;
  const authored = normAuthoredScenes(raw.scenes);
  const artStyle: ArtStyle = raw.artStyle === "marker" ? "marker" : "flat";
  const rawTitle = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : input.originalTitle;
  const ex = await buildExplainer(
    authored,
    raw.quizzes,
    artStyle,
    `Clearer: ${rawTitle}`,
    input.style,
    `Re-explain: ${input.originalTitle}`
  );
  return ex;
}
