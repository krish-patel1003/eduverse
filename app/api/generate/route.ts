import { NextRequest, NextResponse } from "next/server";
import { generateExplainer } from "@/lib/gemini";
import { extractFiles } from "@/lib/extract";
import type { Style } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const prompt = String(form.get("prompt") ?? "").trim();
    const style = (String(form.get("style") ?? "linear") as Style) === "interactive"
      ? "interactive"
      : "linear";
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (!prompt && files.length === 0) {
      return NextResponse.json({ error: "Add a prompt or an attachment." }, { status: 400 });
    }

    let prior:
      | { history?: string[]; lastTitle?: string; lastSummary?: string }
      | undefined;
    const rawContext = String(form.get("context") ?? "");
    if (rawContext) {
      try {
        const c = JSON.parse(rawContext);
        if (c && typeof c === "object") {
          prior = {
            history: Array.isArray(c.history)
              ? c.history.filter((h: unknown) => typeof h === "string").slice(-8)
              : undefined,
            lastTitle: typeof c.lastTitle === "string" ? c.lastTitle : undefined,
            lastSummary: typeof c.lastSummary === "string" ? c.lastSummary : undefined,
          };
        }
      } catch {
        /* ignore malformed context */
      }
    }

    const { pageText, sources, figures, skipped } = await extractFiles(files);

    const explainer = await generateExplainer({
      prompt: prompt || "Explain the attached material.",
      style,
      pageText,
      figures,
      sources,
      prior,
    });

    return NextResponse.json({ explainer, skipped });
  } catch (err) {
    console.error("generate error", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
