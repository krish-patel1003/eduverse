import { createHash } from "crypto";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";
import type { ArtStyle, SceneObject } from "./types";

// Generates one illustration per SceneObject via Gemini's image model.
// Images are compositable on a WHITE canvas using CSS mix-blend-mode:multiply,
// so we simply ask for a plain white background (no alpha needed).
// Consistency across scenes: the first image becomes a style anchor passed as a
// reference to every later generation. Results are cached to public/generated.

const apiKey = process.env.GEMINI_API_KEY;
const IMG_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
const ENABLED = process.env.ENABLE_IMAGES !== "false";

export const usingImages = Boolean(apiKey) && ENABLED;

const OUT_DIR = path.join(process.cwd(), "public", "generated");

function stylePreamble(style: ArtStyle): string {
  if (style === "marker") {
    return "Colorful hand-drawn marker illustration, bold confident ink outlines, vibrant flat marker shading, playful whiteboard-explainer look.";
  }
  return "Clean modern flat-vector illustration, bold simple shapes, crisp outlines, harmonious warm color palette, minimal detail.";
}

function extFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

type Img = { data: string; mime: string };

async function callImageModel(
  prompt: string,
  anchor?: Img
): Promise<Img | null> {
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent`;
  const parts: unknown[] = [];
  if (anchor) {
    parts.push({ inlineData: { mimeType: anchor.mime, data: anchor.data } });
    parts.push({
      text:
        "Match the exact art style, line weight, and color palette of the reference image above. " +
        prompt,
    });
  } else {
    parts.push({ text: prompt });
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
    if (!res.ok) {
      console.error(`image ${res.status}:`, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const p = data?.candidates?.[0]?.content?.parts?.find(
      (x: { inlineData?: { data?: string; mimeType?: string } }) => x.inlineData?.data
    );
    if (!p?.inlineData?.data) return null;
    return { data: p.inlineData.data, mime: p.inlineData.mimeType ?? "image/jpeg" };
  } catch (err) {
    console.error("image gen failed:", err);
    return null;
  }
}

function fullPrompt(style: ArtStyle, subject: string): string {
  return (
    `${stylePreamble(style)} Draw: ${subject}. ` +
    "A single subject, centered and complete, filling the frame. " +
    "Pure flat white background (#FFFFFF), no background scenery, no ground, no shadow, no border, no text or labels."
  );
}

// On serverless (read-only FS) we inline images as data URLs instead of writing
// files. Locally we still cache to public/generated for a leaner DB.
const INLINE_ASSETS = process.env.INLINE_ASSETS === "1";

async function persist(img: Img, key: string): Promise<string> {
  if (INLINE_ASSETS) return `data:${img.mime};base64,${img.data}`;
  await mkdir(OUT_DIR, { recursive: true });
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  const file = `${hash}.${extFor(img.mime)}`;
  const abs = path.join(OUT_DIR, file);
  if (!(await exists(abs))) {
    await writeFile(abs, Buffer.from(img.data, "base64"));
  }
  return `/generated/${file}`;
}

export interface SceneImage {
  url: string;
  b64: string;
  mime: string;
}

/**
 * Strategy A: generate ONE coherent scene illustration and return its bytes
 * (for grounding) plus a served URL. `anchor` keeps style consistent across scenes.
 */
export async function generateSceneImage(
  subject: string,
  style: ArtStyle,
  anchor?: { data: string; mime: string }
): Promise<SceneImage | null> {
  if (!usingImages) return null;
  const prompt =
    `${stylePreamble(style)} A single cohesive educational illustration: ${subject}. ` +
    "Compose the whole scene together with clear, recognizable, well-separated parts. " +
    "Plain flat white background (#FFFFFF), no text or labels in the image.";
  const img = await callImageModel(prompt, anchor ? { data: anchor.data, mime: anchor.mime } : undefined);
  if (!img) return null;
  const url = await persist(img, `scene|${style}|${subject}`);
  return { url, b64: img.data, mime: img.mime };
}

/**
 * Generate an image for every object across all scenes and set obj.imageUrl.
 * The first object seeds a style anchor for the rest (consistency).
 */
export async function generateObjectImages(
  objects: SceneObject[],
  style: ArtStyle
): Promise<void> {
  if (!usingImages || objects.length === 0) return;

  // Anchor: generate the first object, use it to style-lock the rest.
  const [first, ...rest] = objects;
  const firstImg = await callImageModel(fullPrompt(style, first.prompt));
  if (firstImg) {
    first.imageUrl = await persist(firstImg, `${style}|${first.prompt}`);
  }
  const anchor = firstImg ?? undefined;

  // Rest in parallel (bounded), each anchored to the first for consistency.
  const CONCURRENCY = 5;
  for (let i = 0; i < rest.length; i += CONCURRENCY) {
    const batch = rest.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (obj) => {
        const img = await callImageModel(fullPrompt(style, obj.prompt), anchor);
        if (img) obj.imageUrl = await persist(img, `${style}|${obj.prompt}`);
      })
    );
  }
}
