import { createHash } from "crypto";
import { mkdir, writeFile, readFile, readdir, rm } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";

const execFileP = promisify(execFile);
const OUT_DIR = path.join(process.cwd(), "public", "generated");
const UP_DIR = path.join(process.cwd(), "public", "uploads");

// Server-side attachment handling with multimodal RAG grounding.
// - PDFs: text is extracted PER PAGE (so facts can be cited by page), and
//   embedded figures are pulled out individually via poppler `pdfimages`.
// - DOCX: text + embedded media (word/media/*) via jszip.
// - Image files: used directly as citable figures.
// Everything is returned tagged with its source so the planner can cite it.

export interface Figure {
  id: string;
  source: string;
  page?: number;
  url: string; // served path for display
  b64: string; // base64 for Gemini vision
  mime: string;
  w: number;
  h: number;
}

export interface Source {
  name: string;
  pages?: number;
  /** Served URL of the original upload, so citations can open it. */
  url?: string;
}

export interface ExtractResult {
  /** Page-tagged source text for grounding, e.g. "[report.pdf p1] …". */
  pageText: string;
  sources: Source[];
  figures: Figure[];
  skipped: string[];
}

const MAX_TEXT = 30000;
const MIN_FIG_PX = 90; // ignore icons / rules / artifacts
const MAX_FIGURES = 8;

// On serverless (read-only FS) inline figures as data URLs instead of files.
const INLINE_ASSETS = process.env.INLINE_ASSETS === "1";

async function persist(buf: Buffer, key: string, ext: string): Promise<string> {
  if (INLINE_ASSETS) {
    const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "application/octet-stream";
    return `data:${mime};base64,${buf.toString("base64")}`;
  }
  await mkdir(OUT_DIR, { recursive: true });
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  const file = `fig_${hash}.${ext}`;
  await writeFile(path.join(OUT_DIR, file), buf);
  return `/generated/${file}`;
}

// Persist the original upload so citations can open it (PDF viewers honor #page=N).
async function persistUpload(buf: Buffer, name: string): Promise<string | undefined> {
  // Serverless: no writable public dir, so citations just won't be clickable.
  if (INLINE_ASSETS) return undefined;
  try {
    await mkdir(UP_DIR, { recursive: true });
    const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
    const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
    const file = `${hash}.${ext}`;
    await writeFile(path.join(UP_DIR, file), buf);
    return `/uploads/${file}`;
  } catch (err) {
    console.error("persistUpload failed:", err);
    return undefined;
  }
}

async function figureFromBuffer(
  buf: Buffer,
  source: string,
  page: number | undefined,
  idx: number
): Promise<Figure | null> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < MIN_FIG_PX || h < MIN_FIG_PX) return null;
    // Normalize to PNG on white (in case of alpha) and cap size for vision payload.
    const png = await sharp(buf)
      .flatten({ background: "#ffffff" })
      .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const url = await persist(png, `${source}|${page}|${idx}|${w}x${h}`, "png");
    return {
      id: `fig${idx}`,
      source,
      page,
      url,
      b64: png.toString("base64"),
      mime: "image/png",
      w,
      h,
    };
  } catch {
    return null;
  }
}

async function extractPdfFigures(pdf: Buffer, source: string): Promise<Figure[]> {
  const tmp = path.join(os.tmpdir(), `eduverse_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  await mkdir(tmp, { recursive: true });
  const pdfPath = path.join(tmp, "in.pdf");
  await writeFile(pdfPath, pdf);
  const figures: Figure[] = [];
  try {
    // -p includes the page number in output filenames: <root>-<page>-<num>.png
    await execFileP("pdfimages", ["-png", "-p", pdfPath, path.join(tmp, "img")], {
      timeout: 45000,
      maxBuffer: 1024 * 1024 * 64,
    });
    const files = (await readdir(tmp)).filter((f) => f.startsWith("img-") && f.endsWith(".png"));
    // Sort by page then index for stable ordering.
    files.sort();
    let idx = 0;
    for (const f of files) {
      if (figures.length >= MAX_FIGURES) break;
      const m = f.match(/img-(\d+)-(\d+)\.png$/);
      const page = m ? parseInt(m[1], 10) : undefined;
      const buf = await readFile(path.join(tmp, f));
      const fig = await figureFromBuffer(buf, source, page, idx);
      if (fig) {
        figures.push(fig);
        idx++;
      }
    }
  } catch (err) {
    console.error("pdfimages failed:", err);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
  return figures;
}

async function extractDocxMedia(buf: Buffer, source: string): Promise<Figure[]> {
  const figures: Figure[] = [];
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buf);
    const media = Object.keys(zip.files).filter((n) => /^word\/media\//i.test(n));
    let idx = 0;
    for (const name of media) {
      if (figures.length >= MAX_FIGURES) break;
      const data = await zip.files[name].async("nodebuffer");
      const fig = await figureFromBuffer(data, source, undefined, idx);
      if (fig) {
        figures.push(fig);
        idx++;
      }
    }
  } catch (err) {
    console.error("docx media extract failed:", err);
  }
  return figures;
}

export async function extractFiles(files: File[]): Promise<ExtractResult> {
  const textChunks: string[] = [];
  const sources: Source[] = [];
  const figures: Figure[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const name = file.name || "attachment";
    const type = file.type || "";
    const lower = name.toLowerCase();
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const url = await persistUpload(buf, name);

      if (type.startsWith("image/")) {
        const fig = await figureFromBuffer(buf, name, undefined, figures.length);
        if (fig) figures.push(fig);
        sources.push({ name, url });
        continue;
      }

      if (lower.endsWith(".pdf") || type === "application/pdf") {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(buf));
        const { text, totalPages } = await extractText(pdf, { mergePages: false });
        const pages: string[] = Array.isArray(text) ? text : [String(text)];
        pages.forEach((t, i) => {
          const clean = (t ?? "").trim();
          if (clean) textChunks.push(`[${name} p${i + 1}] ${clean}`);
        });
        sources.push({ name, pages: totalPages ?? pages.length, url });
        const figs = await extractPdfFigures(buf, name);
        figures.push(...figs.slice(0, MAX_FIGURES));
        continue;
      }

      if (lower.endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const { value } = await mammoth.extractRawText({ buffer: buf });
        if (value.trim()) textChunks.push(`[${name}] ${value.trim()}`);
        sources.push({ name, url });
        figures.push(...(await extractDocxMedia(buf, name)));
        continue;
      }

      if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buf, { type: "buffer" });
        const parts = wb.SheetNames.map(
          (s) => `# Sheet: ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s])}`
        );
        textChunks.push(`[${name}] ${parts.join("\n\n")}`);
        sources.push({ name, url });
        continue;
      }

      if (lower.endsWith(".txt") || lower.endsWith(".md") || type.startsWith("text/")) {
        textChunks.push(`[${name}] ${buf.toString("utf8").trim()}`);
        sources.push({ name, url });
        continue;
      }

      skipped.push(name);
    } catch (err) {
      console.error(`extract failed for ${name}:`, err);
      skipped.push(name);
    }
  }

  // Re-id figures sequentially across all sources so ids are unique.
  figures.forEach((f, i) => (f.id = `fig${i}`));

  return {
    pageText: textChunks.join("\n\n").slice(0, MAX_TEXT),
    sources,
    figures: figures.slice(0, MAX_FIGURES),
    skipped,
  };
}
