# EduVerse — Learning Platform

Turn any question (± attachments) into a **hand-drawn, voice-narrated explainer**,
or build a **full adaptive course** for yourself that unlocks module by module and
learns how you learn.

## Two ways in

- **Build a course** (`/course/new`) — pick a topic + goals (attach docs if you
  like). We **research the topic on the web** (see below), draft an **outline**
  you approve, then generate each module as a narrated explainer **one at a
  time**; finishing a module unlocks the next. Module videos are **interactive**:
  gated checkpoint questions appear mid-video. Below the player is a tabbed panel
  — **Ask AI** (doubts + "explain differently"), **Quiz** (a sequential quiz that
  swaps in for the player, then scores you with a per-concept breakdown and a full
  review that gives a reason for every option), **Assignment** (take-home tasks),
  and **Notes** (timestamped, click to seek). Later modules **adapt** to your
  pace, analogy preference, weak concepts, and style.

### Course research (web-grounded, varied examples)

At outline time, `lib/research.ts` runs a small **search → scrape → synthesize**
pass: it queries a self-hosted **SearXNG** instance (`SEARXNG_URL`), scrapes the
top results with a dependency-free Node extractor, and asks the model to distill
a **research brief** (key concepts, real-world scenarios, diverse analogy
domains, misconceptions, sources). The brief is cached on the course and fed into
every module so content is grounded and **analogies stay varied** (no more
"everything is football"). If `SEARXNG_URL` is unset the brief falls back to
model-only — still diversified, never blocks.
- **Quick explainer** (`/chat`) — the original one-off mode: prompt in, narrated
  video out.
- **Profile** (`/profile`) — known/weak concepts, practice history, mistakes,
  progress, motivation, goals, and detected learning style.

### Persistence

Courses, module unlock progress, and the student profile live in **server-side
SQLite** (`better-sqlite3`) at `data/eduverse.db` (gitignored). Quick-chat history
stays in-memory as before. Key files: `lib/db.ts` (connection + migrations),
`lib/store.ts` (course/module CRUD), `lib/profile.ts` (student model + the
`learnerHint` that makes generation adaptive), `lib/course.ts` (outline / module /
quiz / assignment / doubt generation), and the `app/api/course/*` +
`app/api/profile` routes.

---

## Explainer engine (unchanged core)

Turn any question (± attachments) into a **hand-drawn, voice-narrated explainer**
that plays in a video-player UI with timestamped notes and re-explain.

## What it does

1. **Chat** — type a prompt, optionally attach files (PDF / DOCX / XLSX / CSV /
   images), pick a **style** (Linear default, or Interactive), and hit Generate.
2. **Gemini** turns it into a *scene script*: a title + scenes, each with
   narration and hand-drawn elements (labels, arrows, boxes, circles, freehand).
3. The **player** renders it as a whiteboard "video": line art that **draws
   itself on** with a sketchy stroke, handwriting labels, and **voice narration**
   in sync — with play/pause, seek, speed, and a scene timeline.
4. **Notes** — jot a note any time; it's stamped with the current timestamp.
   Click a note to jump back to that moment.
5. **Re-explain a part you didn't get** — mark an `[ In` / `Out ]` range on the
   timeline and hit *Re-explain this part*; Gemini generates a slower, simpler
   mini-explainer focused on just that section.
6. **Keep chatting** — follow-up prompts make new explainers; each is a card in
   the chat you can click to replay.

## Illustration engine (generated images)

Scenes are now drawn with **AI-generated illustrations**, not fixed icons:

- **Plan** (`lib/gemini.ts`) — `gemini-3.6-flash` writes each scene as a set of
  **objects** (subject prompts + placement box + entrance animation), **connectors**
  (curved colored arrows between objects), and **labels**, and picks an `artStyle`
  (`flat` for technical topics, `marker` for narrative/concept topics).
- **Generate images** (`lib/imagegen.ts`) — each object becomes a real illustration
  from `gemini-3.1-flash-image`, on a plain white background. The first image seeds a
  **style anchor** passed as a reference to the rest, keeping the look consistent across
  scenes. Images are written to `public/generated/` (cached by prompt hash).
- **Composite + animate** (`components/ExplainerPlayer.tsx`) — object images are placed
  on a **white stage with `mix-blend-mode: multiply`**, so the white backgrounds vanish
  seamlessly (no alpha needed). Each object animates in with its own entrance
  (fade/pop/grow/slide/draw), connectors draw on as **curved colored arrows**, labels
  fade in, and the whole scene gets a subtle Ken Burns drift.
- Falls back to the legacy vector/icon engine (`lib/icons.ts`) for any scene without
  generated objects.

Tradeoff: generation now takes **~60–90s** (image-heavy), shown behind a "Drawing your
explainer…" render bar. Toggle off with `ENABLE_IMAGES=false` to use the fast vector
engine. Configure the model via `GEMINI_IMAGE_MODEL` (default `gemini-3.1-flash-image`;
`gemini-3-pro-image` for higher quality).

## How narration + sync works

There's no drop-in that renders a bespoke hand-drawn `.mp4` with AI voice in
seconds. So the explainer is a **synchronized animated player**, not a movie
file:

- **Art** — an AI scene script → SVG line art animated with a stroke draw-on
  effect and a hand-sketch filter. The model composes scenes from a named
  **icon library** (`lib/icons.ts` — person, flask, sun, chip, database, brain,
  …) plus arrows, labels, and freehand paths, so the drawings are recognizable.
- **Voice** — **server-side Gemini TTS** synthesizes narration per scene
  (`lib/tts.ts`, PCM→WAV), giving each scene an exact audio duration. When TTS is
  unavailable it falls back to the browser's Web Speech voice.
- **Sync** — when a scene has TTS audio, the `<audio>` element is the master
  clock (its `timeupdate`/`ended` events drive scene timing; rAF only smooths the
  drawing between samples), so the animation stays locked to narration.

It behaves like a video (play/pause/seek/speed/notes/timestamps); it just isn't
downloadable. A true `.mp4` export is a later add-on.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
```

Set the LLM key in `.env.local` (copy `.env.local.example`):

```
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash   # optional
```

## Layout

| Path | Role |
|---|---|
| `lib/types.ts` | `Explainer` / `Scene` / drawable `Element` shapes. |
| `lib/gemini.ts` | Prompt → scene script (`generateExplainer`) + `reExplainRange`; validates & clamps every element to the canvas. |
| `lib/extract.ts` | Attachment text extraction (pdf via unpdf, docx via mammoth, xlsx/csv via SheetJS); images → Gemini vision parts. |
| `app/api/generate/route.ts` | Multipart: prompt + style + files → explainer. |
| `app/api/reexplain/route.ts` | Timestamp-range → simpler focused explainer. |
| `components/ExplainerPlayer.tsx` | The hand-drawn synced player + controls + notes hooks + range-marking. |
| `app/page.tsx` | Chat sidebar, center stage, notes panel, state. |

## Config

```
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash                 # scene-script model
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts # narration voice
GEMINI_TTS_VOICE=Kore                         # prebuilt voice name
ENABLE_TTS=true                               # set false to skip TTS (uses Web Speech)
```

## Known limits / next steps

- **Voice** uses server-side Gemini TTS; if the key/model lacks TTS access it
  degrades to the browser's Web Speech voice, then to captions-only.
- **Drawing** uses a named icon library + freehand fallback; expanding the icon
  set (`lib/icons.ts`) directly improves coverage.
- **Persistence** is in-memory (refresh clears chat/notes). Add storage when you
  want sessions to survive.
- **`.mp4` export** — the player is a live synchronized animation; a real video
  file would need offline render (e.g. Remotion + the TTS audio).
- **Next.js advisory** — this environment's `npm audit` flags advisories against
  every Next version it knows; fine for localhost, revisit before deploy.
