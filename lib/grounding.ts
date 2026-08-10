import type { GroundedPart } from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

// image.ground — locate named parts inside a generated scene image.
// Gemini returns boxes as [ymin, xmin, ymax, xmax] normalized 0-1000; we convert
// to the 800x450 canvas. This gates Strategy A: if grounding is weak, the scene
// falls back to a plain full-image reveal.

const apiKey = process.env.GEMINI_API_KEY;
const GROUND_MODEL = process.env.GEMINI_GROUND_MODEL ?? "gemini-3.6-flash";

interface RawBox {
  label?: string;
  box_2d?: number[];
}

export async function groundParts(
  imageB64: string,
  mime: string,
  partNames: string[]
): Promise<GroundedPart[]> {
  if (!apiKey || partNames.length === 0) return [];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GROUND_MODEL}:generateContent`;
  const prompt =
    'Return bounding boxes as a JSON array of {"label":string,"box_2d":[ymin,xmin,ymax,xmax]} ' +
    "with coordinates normalized 0-1000 (top-left origin). Locate each of these items in the image: " +
    partNames.join(", ") +
    ". Only include an item if it is clearly visible.";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: imageB64 } }] },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
    if (!res.ok) {
      console.error("ground", res.status, (await res.text().catch(() => "")).slice(0, 160));
      return [];
    }
    const data = await res.json();
    const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    const raw = JSON.parse(text) as RawBox[];
    const out: GroundedPart[] = [];
    for (const r of Array.isArray(raw) ? raw : []) {
      const b = r.box_2d;
      const name = typeof r.label === "string" ? r.label.trim() : "";
      if (!name || !Array.isArray(b) || b.length < 4) continue;
      const [ymin, xmin, ymax, xmax] = b.map((n) => Math.max(0, Math.min(1000, Number(n) || 0)));
      const x = (xmin / 1000) * CANVAS_W;
      const y = (ymin / 1000) * CANVAS_H;
      const w = ((xmax - xmin) / 1000) * CANVAS_W;
      const h = ((ymax - ymin) / 1000) * CANVAS_H;
      // sanity: skip degenerate or whole-image boxes
      if (w < 12 || h < 12 || w * h > CANVAS_W * CANVAS_H * 0.96) continue;
      out.push({ name, x, y, w, h });
    }
    return out;
  } catch (err) {
    console.error("grounding failed:", err);
    return [];
  }
}
