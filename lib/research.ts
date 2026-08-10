// Web-grounded research for a course: a small "search -> scrape -> synthesize"
// graph. It pulls real, varied examples and scenarios so course content is
// grounded and analogies stop defaulting to the same tired domain (football).
//
// Search uses a self-hosted SearXNG instance (SEARXNG_URL, JSON API). Scraping
// is Node-native (fetch + tag-strip), no Python. Everything is best-effort and
// time-bounded: if SearXNG is unset or a fetch fails, we degrade to an LLM-only
// brief so course creation never blocks.

import { callGemini } from "./gemini";
import type { ResearchBrief } from "./types";

const SEARXNG_URL = process.env.SEARXNG_URL?.replace(/\/+$/, "");
export const usingResearch = Boolean(SEARXNG_URL);

const FETCH_TIMEOUT_MS = 6000;
const MAX_PAGES = 6; // total pages scraped across all queries
const PER_PAGE_CHARS = 2500;

interface SearchHit {
  title: string;
  url: string;
  content?: string;
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function searxng(query: string): Promise<SearchHit[]> {
  if (!SEARXNG_URL) return [];
  const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&safesearch=1`;
  const data = await withTimeout(async (signal) => {
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`searxng ${res.status}`);
    return (await res.json()) as { results?: SearchHit[] };
  }, FETCH_TIMEOUT_MS);
  return (data?.results ?? []).slice(0, 5);
}

// Dependency-free readable-text extraction: drop scripts/styles/markup, unescape
// a few entities, collapse whitespace, and cap length.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function scrape(url: string): Promise<string> {
  const text = await withTimeout(async (signal) => {
    const res = await fetch(url, {
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (EduVerse research bot)" },
    });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("text")) return "";
    return htmlToText(await res.text()).slice(0, PER_PAGE_CHARS);
  }, FETCH_TIMEOUT_MS);
  return text ?? "";
}

const SYNTH_SPEC = `You are a research analyst preparing a grounded brief for an educational course. You are given a topic, the learner's goals, and raw excerpts scraped from the web (which may be noisy). Distill them.

Write in plain spoken English. Do NOT use em dashes or en dashes.

CRITICAL on analogies: propose a DIVERSE set of everyday analogy domains genuinely suited to THIS topic (cooking, music, traffic, plumbing, libraries, gardening, postal mail, etc.). Do NOT default to sports or football unless the topic is literally about sports.

Output ONLY this JSON:
{
  "summary": string,                       // 2-4 sentences on what matters for teaching this
  "keyConcepts": [string, ...],            // 4-8 core concepts
  "realWorldScenarios": [string, ...],     // 3-6 concrete real-world uses/examples grounded in the sources
  "analogyDomains": [string, ...],         // 4-6 diverse, topic-appropriate analogy domains (NOT sports-default)
  "misconceptions": [string, ...],         // 2-5 common misunderstandings
  "sources": [ { "title": string, "url": string } ]
}`;

function strArr(v: unknown, cap: number): string[] {
  return Array.isArray(v)
    ? (v.filter((x) => typeof x === "string" && x.trim()) as string[]).slice(0, cap).map((s) => s.trim().slice(0, 300))
    : [];
}

/**
 * Research a course topic against the learner's goals. Returns a distilled,
 * source-grounded brief with DIVERSE analogy domains. Always resolves (never
 * throws): with no SearXNG configured it produces an LLM-only brief.
 */
export async function researchTopic(input: {
  topic: string;
  goals: string[];
  motivation?: string;
}): Promise<ResearchBrief> {
  const { topic, goals, motivation } = input;

  // 1. Search a few angles.
  const queries = [
    topic,
    `real world examples of ${topic}`,
    `everyday analogy to explain ${topic}`,
    `common misconceptions about ${topic}`,
  ];
  const hitLists = SEARXNG_URL ? await Promise.all(queries.map(searxng)) : [];

  // Dedup by url, keep order, cap pages to scrape.
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const list of hitLists) {
    for (const h of list) {
      if (h.url && !seen.has(h.url)) {
        seen.add(h.url);
        hits.push(h);
      }
    }
  }
  const toScrape = hits.slice(0, MAX_PAGES);

  // 2. Scrape in parallel (best-effort).
  const scraped = await Promise.all(
    toScrape.map(async (h) => ({ ...h, body: (await scrape(h.url)) || h.content || "" }))
  );
  const usable = scraped.filter((s) => s.body && s.body.length > 200);

  // 3. Synthesize.
  let userText = `TOPIC: ${topic}\nLEARNER GOALS:\n- ${goals.join("\n- ") || "(none given)"}`;
  if (motivation) userText += `\nMOTIVATION: ${motivation}`;
  if (usable.length) {
    userText +=
      `\n\nSOURCE EXCERPTS:\n` +
      usable.map((s, i) => `[${i + 1}] ${s.title || s.url}\n${s.body}`).join("\n\n---\n\n");
  } else {
    userText += `\n\n(No web sources were available. Use your own knowledge, and still give diverse, non-sports analogy domains.)`;
  }

  try {
    const raw = (await callGemini(SYNTH_SPEC, [{ text: userText }])) as Record<string, unknown>;
    const sources = Array.isArray(raw.sources)
      ? (raw.sources as unknown[])
          .filter((s): s is { title: string; url: string } => !!s && typeof s === "object" && typeof (s as { url?: unknown }).url === "string")
          .slice(0, 8)
          .map((s) => ({ title: String(s.title ?? s.url).slice(0, 160), url: s.url }))
      : usable.map((s) => ({ title: s.title || s.url, url: s.url }));
    return {
      summary: typeof raw.summary === "string" ? raw.summary.trim().slice(0, 800) : "",
      keyConcepts: strArr(raw.keyConcepts, 8),
      realWorldScenarios: strArr(raw.realWorldScenarios, 6),
      analogyDomains: strArr(raw.analogyDomains, 6),
      misconceptions: strArr(raw.misconceptions, 5),
      sources,
    };
  } catch {
    // Total failure: still hand back something usable.
    return {
      summary: "",
      keyConcepts: [],
      realWorldScenarios: [],
      analogyDomains: [],
      misconceptions: [],
      sources: usable.map((s) => ({ title: s.title || s.url, url: s.url })),
    };
  }
}

/** Render a brief into a compact instruction block for the author/outline prompts. */
export function researchToPrompt(brief?: ResearchBrief): string {
  if (!brief) return "";
  const parts: string[] = [];
  if (brief.summary) parts.push(`Context: ${brief.summary}`);
  if (brief.keyConcepts.length) parts.push(`Key concepts to cover: ${brief.keyConcepts.join(", ")}.`);
  if (brief.realWorldScenarios.length) parts.push(`Ground examples in these real uses: ${brief.realWorldScenarios.join("; ")}.`);
  if (brief.analogyDomains.length)
    parts.push(
      `When you use an analogy, draw it from ONE of these varied domains (pick what fits, rotate them, do NOT default to football or sports): ${brief.analogyDomains.join(", ")}.`
    );
  if (brief.misconceptions.length) parts.push(`Address these common misconceptions: ${brief.misconceptions.join("; ")}.`);
  if (!parts.length) return "";
  return `\n\nRESEARCH BRIEF (use to ground and diversify the content):\n- ${parts.join("\n- ")}`;
}
