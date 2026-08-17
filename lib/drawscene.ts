// High-fidelity "whiteboard" renderer.
//
// Instead of generating one finished illustration per scene, we DRAW the scene
// the way a person would: a chain of image-edit passes on a single evolving
// canvas (title -> outline -> parts -> color -> labels). Each pass takes the
// previous frame as input and is told to add exactly one layer, so:
//   * every pass is a genuine intermediate keyframe of a real build-up, and
//   * consistency is structural, since each frame IS the previous one plus ink.
//
// The frames come back registered (same framing/scale), which lets the player
// reveal frame N+1 over frame N with a sweeping mask: everything unchanged looks
// identical either way, so only the NEW ink appears to be drawn.

import { callGemini } from "./gemini";
import type { Scene } from "./types";

const apiKey = process.env.GEMINI_API_KEY;
// The pro image model is markedly better at in-image hand lettering and at
// honoring "change nothing, only add this" edits.
const HIFI_MODEL = process.env.GEMINI_HIFI_IMAGE_MODEL ?? "gemini-3-pro-image";
export const usingHiFi = Boolean(apiKey) && process.env.ENABLE_HIFI !== "false";

// Keep a lid on cost/latency: passes per scene and how many scenes render at once.
const MAX_SCENES = Number(process.env.HIFI_MAX_SCENES ?? 5);
const SCENE_CONCURRENCY = Number(process.env.HIFI_CONCURRENCY ?? 2);
// Displayed at ~1024 wide at most; compress hard because every frame is stored
// inline in the explainer JSON.
const FRAME_WIDTH = 720;
const FRAME_QUALITY = 74;
// A single pass must not hang the whole request.
const PASS_TIMEOUT_MS = 120_000;

// Locked look, repeated on every pass so the hand never drifts.
const STYLE =
  "STYLE: hand-drawn educational whiteboard illustration. Bold black marker outlines with a slightly rough, " +
  "confident hand-drawn line. Fills are textured colored-pencil and marker shading, no smooth gradients, no " +
  "photorealism, no 3D. Any text is hand-lettered in black all-caps marker. " +
  "FRAMING: plain flat off-white paper that FILLS THE ENTIRE SQUARE FRAME edge to edge, as if scanned " +
  "straight-on. Never show paper edges, a desk, a card, or any drop shadow.";

const KEEP =
  "CRITICAL: keep every existing stroke, letter, color and position EXACTLY as-is, at the exact same size and " +
  "framing. Do not redraw, move, rescale, restyle or erase anything already on the page. ONLY ADD the following. ";

// ---- draw plans -------------------------------------------------------------

export interface DrawLayer {
  /** Short id for logging: outline | parts | fills | labels ... */
  name: string;
  /** What this pass adds, phrased as an instruction. */
  add: string;
}

export interface ScenePlan {
  /** Hand-lettered scene title. */
  title: string;
  layers: DrawLayer[];
}

const PLAN_SPEC = `You are an illustrator planning how to DRAW each scene of a whiteboard explainer, one layer at a time, the way a person draws.

For every scene you are given, output a plan with:
- "title": a SHORT hand-lettered heading in ALL CAPS (max 5 words) for that scene.
- "layers": exactly 4 ordered drawing steps, each an instruction describing ONLY what to add in that step:
  1. the main outline(s) of the central subject, black outline only, no colour
  2. the internal parts / sub-elements, still outline only
  3. the colour fills for what is already drawn
  4. the labels, arrows and any callout, hand-lettered

RULES:
- State EXPLICIT positions in every instruction (e.g. "in the centre-left", "upper right", "along the bottom") so the layout stays put as the drawing builds.
- Keep the whole scene to ONE clear central diagram. Do not invent a new subject in later layers.
- Label text must be SHORT (1-3 words) and ALL CAPS, and must be spelled exactly as you want it drawn.
- Do not use em dashes or en dashes anywhere.

Output ONLY this JSON:
{ "scenes": [ { "title": string, "layers": [ { "name": string, "add": string }, ... ] } ] }`;

/** One LLM call turns every scene's image prompt into an ordered draw plan. */
export async function planScenes(scenes: Scene[]): Promise<ScenePlan[]> {
  const text = scenes
    .map(
      (s, i) =>
        `Scene ${i + 1}\nNarration: ${s.narration}\nIllustration to draw: ${s.imagePrompt || s.narration}\nKey parts: ${(s.parts ?? []).map((p) => p.name).join(", ") || "(none given)"}`
    )
    .join("\n\n");

  const raw = (await callGemini(PLAN_SPEC, [{ text }])) as Record<string, unknown>;
  const arr = Array.isArray(raw.scenes) ? raw.scenes : [];
  return scenes.map((s, i) => {
    const p = (arr[i] && typeof arr[i] === "object" ? arr[i] : {}) as Record<string, unknown>;
    const layersRaw = Array.isArray(p.layers) ? p.layers : [];
    const layers: DrawLayer[] = layersRaw
      .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>) : {}))
      .filter((l) => typeof l.add === "string" && (l.add as string).trim())
      .slice(0, 4)
      .map((l, k) => ({
        name: typeof l.name === "string" ? l.name : `layer${k + 1}`,
        add: (l.add as string).trim(),
      }));
    return {
      title:
        typeof p.title === "string" && p.title.trim()
          ? p.title.trim().toUpperCase().slice(0, 60)
          : (s.narration.split(/[.!?]/)[0] || "SCENE").toUpperCase().slice(0, 40),
      // Fall back to a generic 4-step build if the planner under-delivers.
      layers: layers.length
        ? layers
        : [
            { name: "outline", add: `The main outline of: ${s.imagePrompt || s.narration}. Black outline only, centred.` },
            { name: "parts", add: "The internal parts and sub-elements of that subject, outline only." },
            { name: "fills", add: "Colored-pencil fills for everything already drawn." },
            { name: "labels", add: "Short hand-lettered labels with arrows pointing at the main parts." },
          ],
    };
  });
}

// ---- image passes -----------------------------------------------------------

type Img = { data: string; mime: string };

async function editPass(prompt: string, inputs: Img[]): Promise<Img | null> {
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${HIFI_MODEL}:generateContent`;
  const parts: unknown[] = inputs.map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } }));
  parts.push({ text: prompt });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PASS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
    if (!res.ok) {
      console.error(`hifi image ${res.status}:`, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const p = data?.candidates?.[0]?.content?.parts?.find(
      (x: { inlineData?: { data?: string } }) => x.inlineData?.data
    );
    if (!p?.inlineData?.data) return null;
    return { data: p.inlineData.data, mime: p.inlineData.mimeType ?? "image/png" };
  } catch (err) {
    console.error("hifi pass failed:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Shrink + JPEG-compress a frame; these are stored inline, so size matters. */
async function compress(img: Img): Promise<string> {
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp(Buffer.from(img.data, "base64"))
      .resize({ width: FRAME_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: FRAME_QUALITY })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return `data:${img.mime};base64,${img.data}`;
  }
}

/**
 * Draw one scene as a chain of edit passes. Returns the build-up frames in draw
 * order (first = title only, last = finished scene).
 */
async function drawScene(plan: ScenePlan, anchor?: Img): Promise<{ frames: string[]; final?: Img }> {
  const frames: string[] = [];

  // Pass 1: hand-letter the title on blank paper (style-anchored to scene 1).
  const first = await editPass(
    `On a completely blank off-white sheet that fills the whole frame, hand-letter only the title "${plan.title}" across the top. Draw nothing else yet. ${STYLE}` +
      (anchor ? " Match the exact art style, line weight, lettering and palette of the reference image." : ""),
    anchor ? [anchor] : []
  );
  if (!first) return { frames };
  frames.push(await compress(first));

  // Passes 2..N: each adds exactly one layer to the previous canvas.
  let prev: Img = first;
  for (const layer of plan.layers) {
    const next = await editPass(`${KEEP}${layer.add} ${STYLE}`, [prev]);
    if (!next) break; // keep whatever we have; the scene still plays
    frames.push(await compress(next));
    prev = next;
  }
  return { frames, final: prev };
}

/**
 * Render scenes in hi-fi. Scene 1 is drawn first and its finished frame becomes
 * the style anchor for the rest, which then render concurrently (passes within a
 * scene are inherently sequential, but scenes are independent).
 */
export async function renderHiFiScenes(scenes: Scene[]): Promise<void> {
  if (!usingHiFi) return;
  const targets = scenes.filter((s) => s.imagePrompt || s.narration).slice(0, MAX_SCENES);
  if (targets.length === 0) return;

  const plans = await planScenes(targets);

  // Scene 1 sets the house style.
  const lead = await drawScene(plans[0]);
  if (lead.frames.length) {
    targets[0].keyframes = lead.frames;
    targets[0].sceneImageUrl = lead.frames[lead.frames.length - 1];
  }
  const anchor = lead.final;

  // Remaining scenes, a few at a time.
  const rest = targets.slice(1);
  for (let i = 0; i < rest.length; i += SCENE_CONCURRENCY) {
    const batch = rest.slice(i, i + SCENE_CONCURRENCY);
    await Promise.all(
      batch.map(async (scene) => {
        const idx = targets.indexOf(scene);
        const { frames } = await drawScene(plans[idx], anchor);
        if (frames.length) {
          scene.keyframes = frames;
          scene.sceneImageUrl = frames[frames.length - 1];
        }
      })
    );
  }
}
