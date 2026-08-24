# EduVerse — Product Description & API Spec
_Design brief for a website/UI design tool. Paste whole, or section by section._

---

## 1. One-liner

**EduVerse is an AI tutor for kids that adapts the *teaching*, not just the questions.**
When a child gets something wrong, it works out *why*, finds the missing building block, and re-teaches it a different way — as a narrated, hand-drawn explainer video.

## 2. Who it's for

| Audience | Uses it to |
|---|---|
| **Children, roughly ages 6–14** (primary UI) | Watch short lessons, answer checks, earn XP, follow a daily plan |
| **Parents / guardians** (account owner) | Add child profiles, switch between kids, see progress |
| **Teachers / tutors** (secondary) | See which teaching approach works for which child on which skill |

The **child-facing screens must stay extremely simple**. All the sophistication is hidden.

## 3. The core promise

> ❤️ Love math · 🧠 Understand math · 🏆 Master math · 🔁 Remember math

The learning loop:

```
Try → Understand the mistake → Re-teach differently → "I got it!" → Practice → Master → Review before forgetting
```

## 4. What makes it different

1. **Root-cause diagnosis.** A wrong answer produces a named *misconception* ("added the column sums side by side instead of regrouping"), not just a red X.
2. **Drops to the real gap.** If the foundation is missing it teaches *that* — possibly several grades lower — and says so kindly.
3. **Never repeats a failed lesson.** Retries change the *teaching method*, not the wording.
4. **Learns what works per concept.** The same child may learn fractions visually but multiplication by repetition. Tracked per skill, not as one fixed "learning style."
5. **Remembers before forgetting.** Mastered skills come back for spaced review.

## 5. Teaching modes — the ONLY choice a child sees

This is the signature UI component. **"Teach Me the Best Way" is the prominent default** and should visually dominate; the other five are secondary.

| | Label | Sub-label |
|---|---|---|
| ✨ | **Teach Me the Best Way** | *I'll pick what works best for you* — **RECOMMENDED, hero treatment** |
| 👀 | Show Me | Pictures, models and animations |
| 🪜 | Step-by-Step | Smaller steps, guided all the way |
| 💡 | Explain Why | Understand the reason behind it |
| 🎯 | Let Me Practice | Short, focused practice |
| 🚀 | Challenge Me | Puzzles and deeper thinking |

**Never show the child the underlying methods** (Kumon, Singapore, Japanese, Russian, Montessori, Socratic, Mastery, worked-example fading). Those may appear only in a parent/teacher view.

## 6. Tone & voice rules (important for copy in mockups)

- **Never punish a mistake.** No "Wrong", no "Failed", no red X lists.
  - Miss → 💪 **"Almost!"** + *"I found exactly what tripped you up. Let's fix it together."*
  - Improvement → 📈 "You're getting closer!"
  - Mastery → 🎉 "You got it!"
  - Mastery after struggling → 🔥 **"Great comeback!"** (celebrated hardest)
  - Review passed → 🧠 "Still got it!"
- **Scores are de-emphasised.** The percentage lives behind a collapsed "See how each part went".
- **Every attempt earns XP,** including a miss.
- Plain language. No em dashes. No jargon in child-facing text.

## 7. Screens to design

| Route | Screen | Notes |
|---|---|---|
| `/login`, `/signup` | Auth | Simple, warm |
| `/onboarding` | Diagnostic quiz | 14–20 questions, progress feel, not exam-like |
| `/adaptive` | **Child home / dashboard** | XP + streak badges, "Today's Math" plan, due-for-review cards, skill grid |
| `/adaptive/[id]` | **The learning loop** ⭐ | Video player → mode picker → feedback → assessment → celebration |
| `/children` | Manage child profiles | Avatar, name, grade, add/remove |
| `/profile` | Learner profile | Name, age, grade, preferences |
| `/chat` | Quick explainer chat | Ask anything, get a video |
| `/course/new`, `/course/[id]` | Structured courses | Outline → modules → quizzes → certificate |
| `/cert/[id]` | Certificate | Shareable, celebratory |

### 7a. `/adaptive` — child home (highest design value)

Contains, in priority order:
1. **XP + streak badges** (⭐ 120 XP · 🔥 4)
2. **"Today's Math"** — 3–4 time-boxed cards, ~18 min total, each with emoji, title, skill, one-line *why*, and minutes
   - 🟢 Quick Review · 🔵 Strengthen a Skill · 🟣 Learn Something New · 🟠 Fun Challenge
3. **Due for review** cards
4. **Skill grid** grouped by subject, each with mastery bar + status (weak / learning / mastered)

### 7b. `/adaptive/[id]` — the learning loop (the heart of the product)

Phases the design must cover:
1. **Loading** — "Preparing your lesson…" (takes ~60–90s; needs to feel alive, not broken)
2. **Foundation banner** (conditional) — 🪜 *"Let's build the foundation first"* + warm reason. Must read as deliberate teaching, **not** a demotion.
3. **Video player** — 16:9 hand-drawn animated explainer, captions, transcript, speed, scene ticks, optional in-video checkpoint questions
4. **Mode picker** — "Want it taught a different way?"
5. **Lesson feedback** — 6 reactions (😍 Loved it · 👍 Got it · 🤔 Confusing · 🚀 Too fast · 🐢 Too slow · 👎 Didn't help) + one optional text box
6. **Attempt history** — per round: skill, "foundation" tag, score, Rewatch / Retry test
7. **Assessment** — mixed question types, some with figures (see §8)
8. **Celebration** — big emoji, headline, warm message, XP chip, streak, collapsed detail, **"What's next?"** cards

### 7c. Assessment question figures

Questions can carry an exact drawn figure. Design needs a container style for these:
fraction bars · number lines · dot arrays · grouped counters · base-ten blocks · comparison bar models · labelled shapes · clock faces.
They're SVG, theme-aware, max ~420px wide, with an optional caption.

## 8. Current visual state & what's wanted

**Today:** dark theme, functional, plain. Blue accent `#6ea8fe`, amber `#fbbf24`, panels on near-black, generic system font, rounded 12–16px cards.

**Wanted:** keep it clean and uncluttered but make it feel **warm, playful and encouraging for a child** without becoming babyish — an 11-year-old shouldn't feel patronised. Both light and dark themes. Mobile-first is a plus.

---

# API SPEC

Next.js App Router. All JSON. Auth via httpOnly session cookie (`sid`).
All learning data is scoped to the **active child**; switching child re-scopes everything.
Errors: `{ "error": string }` with 400 / 401 / 404 / 429 / 500.

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password}` | `{user:{id,email}}` |
| POST | `/api/auth/login` | `{email, password}` | `{user:{id,email}}` |
| POST | `/api/auth/logout` | — | `{ok:true}` |
| GET | `/api/auth/me` | — | `{user:{id,email}\|null}` |

## Child profiles
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/children` | — | `{children:Child[], activeId}` |
| POST | `/api/children` | `{name, age?, educationLevel?, avatar?}` | `{child, children, activeId}` |
| POST | `/api/children/select` | `{id}` | `{activeId}` |
| DELETE | `/api/children/[id]` | — | `{ok}` — refuses to delete the last child |

```ts
Child = { id, name, age?, educationLevel?, avatar /* emoji */, xp, streak, createdAt }
```

## Adaptive tutor
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/adaptive` | — | dashboard (below) |
| POST | `/api/adaptive/diagnostic` | `{topic, level}` | `{diagnosticId, topic, domain, level, items:PublicItem[]}` |
| POST | `/api/adaptive/diagnostic/[did]/submit` | `{answers}` | graded report + created weak areas |
| POST | `/api/adaptive/learn` | `{weakAreaId, reteach?, mode?}` | lesson (below) — **slow, 60–90s** |
| GET | `/api/adaptive/learn` | `?sessionId&round?` | `{session, explainer}` (replay a past round) |
| GET | `/api/adaptive/assess` | `?sessionId&round?` | `{items:PublicItem[], domain, skill}` |
| POST | `/api/adaptive/assess` | `{sessionId, answers, retryOf?}` | verdict (below) |

**`GET /api/adaptive` →**
```jsonc
{
  "profile":  { "name", "age", "gender", "educationLevel" },
  "progress": { "xp": 120, "streak": 4 },
  "plan": [ { "kind":"review", "emoji":"🟢", "title":"Quick Review",
              "skill":"single digit addition facts", "why":"…", "minutes":3,
              "weakAreaId":"…", "mode":"practice" } ],
  "dueReviews": [ WeakArea ],
  "nextAction": { "kind":"review|learn", "area": WeakArea },
  "weakAreas":  [ WeakArea ],
  "diagnostics":[ Diagnostic ]
}

WeakArea = { id, topic, aspect, domain, level?, mastery /*0..1*/,
             status:"weak|learning|mastered", intervalDays?, dueAt?, reviews?, updatedAt }
```

**`POST /api/adaptive/learn` →**
```jsonc
{
  "sessionId": "…",
  "round": 2,
  "explainer": Explainer,
  "topic": "Mathematics",
  "aspect": "multi_digit_addition",   // what they set out to learn
  "teachSkill": "Identify place value in two digit numbers",  // what we're ACTUALLY teaching
  "droppedDown": true,                // → show the 🪜 foundation banner
  "reason": "Before we add larger numbers, it helps to be confident about…",
  "mode": "show_me",                  // child-facing mode used
  "method": "singapore",              // hidden engine method (parent view only)
  "routeReason": "Let's start by seeing how this works.",
  "auto": true
}
```

**`POST /api/adaptive/assess` →**
```jsonc
{
  "passed": false, "overall": 45, "capped": false,
  "roundsUsed": 2, "maxRounds": 4,
  "summary": "…",
  "perAspect": [ { "aspect":"regrouping", "score":40 } ],
  "perItem":   [ { "itemId", "correct", "score", "feedback" } ],
  "weakAspects": ["regrouping"],
  "reward":   { "emoji":"💪", "headline":"Almost!",
                "message":"I found exactly what tripped you up…",
                "xp":5, "reason":"Nice effort", "comeback":false },
  "progress": { "xp":125, "streak":4, "streakExtended":true }
}
```

## Explainer video model
```ts
Explainer = { id, title, style:"linear"|"interactive", scenes: Scene[], quizzes?: Quiz[], sources? }
Scene = {
  id, narration, durationMs?, audioUrl?,      // narration audio (WAV data URL)
  sceneImageUrl?,                              // one coherent illustration
  parts?: [{name,x,y,w,h}], beats?: [{say,op,target?,label?}],  // spotlight/annotate timeline
  keyframes?: string[],                        // hi-fi: build-up frames drawn in order
  objects?, connectors?, labels?               // composited diagram fallback
}
Quiz = { id, afterScene, multi, question, options:[{id,text}], correct:[id], explanation }
```
Canvas is **800×450 (16:9)**.

## Assessment items
```ts
PublicItem = { id, type, aspect, prompt, options?, starterCode?, language?, blanks?, visual? }
type = "mcq" | "multi_mcq" | "fill_blank" | "short_answer"
     | "code_bugfix" | "code_write" | "pseudocode" | "essay" | "math_multistep"
```
Answer keys are **never** sent to the client.

**`visual`** (exact drawn figure, one of):
```jsonc
{ "kind":"fraction_bar", "parts":8, "shaded":3 }
{ "kind":"number_line",  "min":0, "max":10, "step":1, "marks":[7] }
{ "kind":"array",        "rows":3, "cols":4 }
{ "kind":"counters",     "groups":3, "per":4 }
{ "kind":"base_ten",     "hundreds":1, "tens":4, "ones":7 }
{ "kind":"bar_model",    "bars":[{"label":"Ana","value":12},{"label":"Ben","value":8}] }
{ "kind":"shape",        "shape":"rect|triangle|circle", "width":6,"height":4,"radius":5,"unit":"cm" }
{ "kind":"clock",        "hour":3, "minute":30 }
// optional: "caption": "short label that does not reveal the answer"
```

## Feedback
| Method | Path | Body |
|---|---|---|
| POST | `/api/feedback` | `{reactions:string[], text?, explainerId?, sessionId?, round?, context?}` |

Reaction ids: `loved` · `got_it` · `confusing` · `too_fast` · `too_slow` · `not_helpful`

## Courses (secondary surface)
`GET /api/courses` · `POST /api/course/outline` · `GET /api/course/[id]` · `POST /api/course/[id]/approve`
`POST /api/course/[id]/module/[mid]/generate|submit-quiz|submit-assignment|complete|interact`
`GET|POST /api/course/[id]/exam` · `GET /api/cert/[certId]`

## Quick chat
`POST /api/generate` (multipart: `prompt`, `style`, `fidelity`, files) → `{explainer, skipped}`
`POST /api/reexplain` → a fresh take on a clip

---

## Design constraints worth knowing

- **Lesson generation takes 60–90 seconds.** The waiting state is a real screen that needs to feel alive and worth waiting for, not broken.
- **Videos are generated, not uploaded** — no thumbnails until a lesson exists.
- **Avatars are emoji**, not uploaded images.
- **Everything re-scopes on child switch** — the switcher must be obvious and always visible.
- Skill names come from the engine as tags (`multi_digit_addition`) and are humanized for display (`Multi digit addition`).
