# EduVerse

**An AI tutor for K-12 that adapts the *teaching*, not just the questions.**

When a learner gets something wrong, EduVerse works out *why*, finds the missing
building block, and re-teaches **that** — a different way — as a narrated,
hand-drawn explainer video.

> A Grade 3 learner who fails `78 + 89` is not shown carry-forward again with a
> new analogy. They are taught **place value**, with pennies and base-ten blocks,
> because the diagnosis says that is what is actually missing.

**Live:** https://eduverse-741258687011.us-central1.run.app

---

## Why it exists

Most adaptive tools adapt the *questions*: get it wrong, get an easier one. That
leaves the learner stuck in the same misunderstanding. EduVerse adapts the
**instruction**:

| The learner… | The tutor responds with |
|---|---|
| Has a weak basic skill | Kumon-style small steps and focused repetition |
| Doesn't understand the concept | Singapore concrete → pictorial → abstract |
| Can compute but not reason | Russian-style non-routine problems |
| Knows the answer but can't explain it | Japanese explain-and-compare |
| Keeps making the same mistake | Root-cause diagnosis, then the missing prerequisite |
| Learned it but is forgetting | Spaced review before it fades |

The last two are where this differs most from a traditional program.

---

## The learning loop

```
Place  →  Teach  →  Check  →  Diagnose why  →  Re-teach differently
                                                      ↓
                        Review before forgetting  ←  Master
```

1. **Adaptive placement** — short probes move up or down a grade band until they
   find where the learner is *actually* working. Typically 10–15 questions, not a
   fixed 20-question test.
2. **Teach** — a lesson is generated for one skill, delivered in a chosen *mode*
   using an instructional *method* selected by the engine.
3. **Check** — a typed assessment with figures, progressive hints, and a
   whiteboard for showing working.
4. **Diagnose** — every wrong answer gets a named misconception and an error
   *type*; non-attempts are excluded so random clicks never pollute the diagnosis.
5. **Re-teach** — the engine drops to the lowest broken prerequisite and changes
   the teaching method. It never repeats an approach that already failed.
6. **Remember** — mastery decays; SM-2 scheduling brings skills back for review.

---

## What a child sees vs what the engine does

A child is never asked to choose between "Kumon" and "Singapore" — that puts the
instructional-design decision on the learner. They see six plain options:

**✨ Teach Me the Best Way** (the default) · 👀 Show Me · 🪜 Step-by-Step ·
💡 Explain Why · 🎯 Let Me Practice · 🚀 Challenge Me

Behind them the engine selects from **eight instructional methods** — Kumon,
Singapore, Japanese lesson study, Russian-style, Montessori, Socratic/Polya,
mastery learning, and worked-example fading — based on the diagnosis and on what
has demonstrably worked for **this child on this skill**.

That last point matters: effectiveness is tracked **per skill, not per learner**.
The same child may learn fractions best visually and multiplication best by
repetition. There is no single "learning style".

---

## Features

**Teaching engine**
- Root-cause diagnosis naming the misconception behind each wrong answer
- 7-type error taxonomy mapping mistakes to instructional methods
- Prerequisite laddering that drops below grade level when the evidence demands it
- Per-skill teaching-effectiveness profile
- Cold-start method priors inferred from how a learner answers

**Curriculum**
- 267 Common Core math standards, **Kindergarten through Grade 12**
- 178 mapped prerequisite chains (262 edges), traversed rather than generated
- Searchable by everyday phrase ("long division", "quadratic formula")

**Assessment**
- Typed items: MCQ, multi-select, fill-in-the-blank, short answer, multi-step
  working, essay, and code
- Exact drawn figures (fraction bars, number lines, base-ten blocks, bar models…)
- Progressive hints, recorded and discounted from mastery
- Whiteboard for handwritten working, graded on **method** not just the answer
- Silent response timing with rapid-guess detection
- Full answer review: every question as it was asked, with the right answer and why

**Learner experience**
- Child profiles under one parent account
- XP, streaks, and a time-boxed daily plan
- Encouragement that never punishes a mistake
- Hand-drawn, voice-narrated explainer videos

**Grown-up view**
- Per-skill effectiveness with the instructional methods named
- Curriculum browser with prerequisites
- High-fidelity lesson toggle

---

## Quickstart

```bash
npm install
cp .env.local.example .env.local   # add your GEMINI_API_KEY
npm run dev                        # http://localhost:3000
```

Without an API key the app still runs and the loop is walkable, but generation
and grading are mocked.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build (standalone output) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required** for real generation and grading |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Text/JSON model |
| `GEMINI_TIMEOUT_MS` | `180000` | Hard cap on any single model call |
| `GEMINI_IMAGE_MODEL` | `gemini-3.1-flash-image` | Scene illustrations |
| `GEMINI_HIFI_IMAGE_MODEL` | `gemini-3-pro-image` | High-fidelity drawn keyframes |
| `GEMINI_TTS_MODEL` | `gemini-2.5-flash-preview-tts` | Narration voice |
| `GEMINI_TTS_VOICE` | `Kore` | Prebuilt voice name |
| `ENABLE_TTS` | `true` | `false` falls back to Web Speech |
| `ENABLE_IMAGES` | `true` | `false` uses the fast vector engine |
| `ENABLE_HIFI` | `true` | `false` disables drawn keyframes entirely |
| `HIFI_MAX_SCENES` / `HIFI_CONCURRENCY` | `5` / `2` | Cost and latency caps |
| `DATA_DIR` | `./data` | SQLite location (set to `/tmp` on Cloud Run) |
| `INLINE_ASSETS` | — | Inline generated media as data URLs (needed on read-only FS) |
| `SEARXNG_URL` | — | Optional self-hosted search for course research |

---

## Architecture at a glance

```
Next.js 15 (App Router)  ·  React 19  ·  TypeScript
        │
        ├─ lib/pedagogy.ts      mode → method routing (the teaching engine)
        ├─ lib/diagnose.ts      root-cause diagnosis + prerequisite ladders
        ├─ lib/placement.ts     staged adaptive placement
        ├─ lib/assessment.ts    generation, grading, review
        ├─ lib/standards.ts     CCSS-M spine + graph traversal
        ├─ lib/effectiveness.ts per-skill teaching outcomes
        └─ lib/gemini.ts        LLM calls (JSON contracts, timeouts)
        │
   SQLite (better-sqlite3) — 15 tables, additive migrations
        │
   GCP Cloud Run + Litestream → Cloud Storage (durable SQLite)
```

Full detail: **[docs/DESIGN.md](docs/DESIGN.md)**
UI/UX spec: **[docs/DESIGN-BRIEF.md](docs/DESIGN-BRIEF.md)**

---

## Deployment

Containerised standalone Next.js build on **GCP Cloud Run**, with SQLite
replicated to Cloud Storage by **Litestream** so data survives container
restarts. Secrets come from **Secret Manager**.

```bash
gcloud run deploy eduverse --source . --region us-central1
```

---

## Known limits

- **Math only.** The curriculum spine covers CCSS-M. ELA and NGSS would each need
  their own seed; the schema already carries a `subject` column.
- **67% prerequisite coverage.** The remaining standards fall back to
  model-generated ladders, which is the designed fallback, not a failure.
- **Lesson generation takes 60–90 seconds** (image-heavy); high-fidelity mode
  takes several minutes and is opt-in.
- **Auth is app-local** (scrypt + server sessions) and has not been hardened for
  untrusted traffic.
- **No `.mp4` export.** The player is a live synchronized animation, not a file.
- **Figure attachment is model-dependent** — between 0 and 6 per assessment, with
  no guaranteed floor.

---

## Licence / attribution

Curriculum skills follow the **Common Core State Standards for Mathematics**.
© 2010 National Governors Association Center for Best Practices and Council of
Chief State School Officers.
