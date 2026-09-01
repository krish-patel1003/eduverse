# EduVerse — Product & UI Spec (v2)
_Design brief for a website/UI design tool. Paste whole, or section by section._
_Supersedes v1. Reflects the shipped product as of the current build._

---

## 1. One-liner

**EduVerse is an AI tutor for K-12 that adapts the *teaching*, not just the questions.**
When a learner gets something wrong, it works out *why*, finds the missing building block, and re-teaches it a **different way** — as a narrated, hand-drawn explainer video.

## 2. Who it's for

| Audience | Uses it to |
|---|---|
| **Children, roughly ages 6–16** (primary UI) | Watch lessons, answer checks, write working, earn XP, follow a daily plan |
| **Parents / guardians** (account owner) | Add child profiles, switch between kids, see what actually works |
| **Teachers / tutors** (secondary) | Browse the curriculum, review per-skill teaching effectiveness |

The **child-facing screens must stay extremely simple**. All sophistication is hidden.

## 3. The core loop

```
Place → Teach → Check → Diagnose why → Re-teach differently → Master → Review before forgetting
```

Goals, in the product's own words: **❤️ Love math · 🧠 Understand math · 🏆 Master math · 🔁 Remember math**

## 4. What makes it different (design should make these legible)

1. **Root-cause diagnosis** — a wrong answer produces a named *misconception*, not a red X.
2. **Drops to the real gap** — teaches a prerequisite, possibly several grades lower, and says so kindly.
3. **Never repeats a failed lesson** — retries change the *teaching method*, not the wording.
4. **Learns what works per concept** — the same child may need visuals for fractions but repetition for multiplication.
5. **Anchored to real standards** — 267 Common Core skills, K-12, with official codes.
6. **Remembers before forgetting** — spaced review; "mastered" is never permanent.

---

## 5. Teaching modes — the ONLY choice a child sees

The signature component. **"Teach Me the Best Way" is the default and must visually dominate**; the other five are secondary.

| | Label | Sub-label |
|---|---|---|
| ✨ | **Teach Me the Best Way** | *I'll pick what works best for you* — **HERO TREATMENT** |
| 👀 | Show Me | Pictures, models and animations |
| 🪜 | Step-by-Step | Smaller steps, guided all the way |
| 💡 | Explain Why | Understand the reason behind it |
| 🎯 | Let Me Practice | Short, focused practice |
| 🚀 | Challenge Me | Puzzles and deeper thinking |

**Never show a child the underlying methods** (Kumon, Singapore, Japanese, Russian, Montessori, Socratic, Mastery, worked-example fading). Those appear **only** in the parent/teacher Insights view.

## 6. Tone & copy rules (critical — these drive real UI decisions)

- **Never punish a mistake.** No "Wrong", no "Failed", no red X lists.
  - Miss → 💪 **"Almost!"** + *"I found exactly what tripped you up. Let's fix it together."*
  - Improvement → 📈 "You're getting closer!"
  - Mastery → 🎉 "You got it!"
  - Mastery after struggling → 🔥 **"Great comeback!"** (celebrated hardest, most XP)
  - Review passed → 🧠 "Still got it!"
- **Scores are de-emphasised.** The percentage sits behind a collapsed *"See how each part went"*.
- **Every attempt earns XP**, including a miss.
- **A missed question in review is "↻ Review this"**, never a cross.
- **No countdown timers are ever shown to a child.** Timing is measured silently; time pressure raises anxiety and degrades maths performance specifically.
- Plain language. No em dashes. No jargon in child-facing text.
- Internal tags are humanised for display (`multi_digit_addition` → "Multi digit addition").

---

## 7. Screens

| Route | Screen | Priority |
|---|---|---|
| `/login`, `/signup` | Auth | Low |
| `/onboarding` | **Adaptive placement** (staged) | **High** |
| `/adaptive` | **Child home / dashboard** | **High** |
| `/adaptive/[id]` | **The learning loop** ⭐ | **Highest** |
| `/curriculum` | Curriculum browser (K-12) | Medium |
| `/insights` | Parent/teacher view | Medium |
| `/children` | Manage child profiles | Low |
| `/profile` | Learner profile | Low |
| `/chat` | Quick explainer chat | Low |
| `/course/new`, `/course/[id]` | Structured courses | Low |
| `/cert/[id]` | Certificate | Low |

### 7a. `/onboarding` — adaptive placement (NEW in v2)

No longer a fixed 20-question test. It is **staged**: a 5-item probe, then it moves **up or down a grade band** and probes again, converging in **10–15 questions**.

Needs:
1. **Progress bar of stages** — "Part 2 of up to 3", segment track (done / current / upcoming)
2. **A band indicator** — "Trying Grade 4 level"
3. **A between-stage reason** — *"Let's find the right starting point at Grade 3."* This must read as the tutor **finding the right level**, never as failure.
4. Result screen: score ring + rank + per-aspect bars, **plus the placement outcome** ("You said Grade 5, we'll start at Grade 3")
5. **Answer review** (see §8)

### 7b. `/adaptive` — child home

In priority order:
1. **XP + streak badges** (⭐ 120 XP · 🔥 4)
2. **"Today's Math"** — 3–4 time-boxed cards, ~18 min total. Each: emoji, title, skill, one-line *why*, minutes.
   🟢 Quick Review · 🔵 Strengthen a Skill · 🟣 Learn Something New · 🟠 Fun Challenge
3. **Due for review** cards
4. **Skill grid** by subject, mastery bar + status (weak / learning / mastered)

### 7c. `/adaptive/[id]` — the learning loop ⭐

The heart of the product. Phases to design:

1. **Loading** — *"Preparing your lesson…"*, takes **60–90 seconds**. Must feel alive and worth waiting for.
2. **Foundation banner** (conditional) — 🪜 *"Let's build the foundation first"* + warm reason. Deliberate teaching, **not** a demotion.
3. **Chosen-approach chip** — e.g. "👀 Show Me · Let's start by seeing how this works."
4. **Video player** — 16:9 hand-drawn animated explainer; captions, transcript, speed, scene ticks, optional in-video checkpoints.
5. **Mode picker** — *"Want it taught a different way?"* with **"N of 4 fresh takes left"**.
6. **Round-cap card** (conditional) — 🌙 *"That's enough on this one for today"* — **replaces** the picker, shows on arrival, offers "Try something else".
7. **Lesson feedback** — 6 reactions (😍 👍 🤔 🚀 🐢 👎) + one optional text box.
8. **Attempt history** — per round: number, skill, "foundation" tag, **mode chip** (💡 Explain Why), score, Rewatch / Retry test.
9. **Assessment** — see §8.
10. **Celebration** — big emoji, headline, warm message, XP chip, streak, collapsed detail, **"What's next?"** cards.
11. **Answer review** — see §8.

---

## 8. Assessment & review (heavily expanded in v2)

### 8a. Taking an assessment

Each question can carry:

- **A drawn figure** (see §9)
- **Progressive hints** — 💡 *"Stuck? Get a hint"* → *"One more hint"*. Encouraged, but recorded.
- **A whiteboard** — "✏️ Scratchpad" on any question; on multi-step items it becomes **"Show your working"** and the drawing is **submitted and graded on method**.
- Response modes: single choice, multi-select, fill-in-the-blank (multiple blanks), short answer, show-your-working, essay, code.

**Silent instrumentation:** per-question active time is measured (pauses on tab-hidden and after 45s idle). **Never surfaced as a timer.**

### 8b. Answer review (NEW in v2)

Shown after both the placement diagnostic and every adaptive check. Renders each question **the way it was asked**:

- **Multiple choice** — every option listed; ✓ **CORRECT** (green) on the right one, ✕ **YOUR ANSWER** (amber) on their pick. Optional per-option rationale.
- **Multi-select** — marks **every** correct option.
- **Fill-in-the-blank** — per blank: `BLANK 1 · (blank) → 36`, wrong entry struck through.
- **Open answers** — "You said" box + grader feedback.
- **Figures and starter code redisplayed**, so review looks like the question did.
- **💡 explanation on every question**, right or wrong.
- Defaults to **only the missed questions**; **"Show all N questions"** toggles.
- Placement reviews are tagged **"Part 1/2/3"** because they span probes.

## 9. Question figures

Deterministic SVG, theme-aware, max ~420px, optional caption:
**fraction bars · number lines · dot arrays · grouped counters · base-ten blocks · comparison bar models · labelled shapes · clock faces**

## 10. `/curriculum` (NEW in v2)

- **267 skills across 13 grades (K-12)**, Common Core
- Grade tabs `K 1 2 … 12`; grades 9–12 are dashed and show a note ("typically **Algebra 1**")
- Grouped **domain → cluster → standard**
- Each row: monospace code (`4.NBT.B.5`), skill text, **"Before this"** (prerequisites), **"Teach me this"**
- Search box handling everyday phrases ("long division", "times tables", "quadratic formula")
- Attribution line at the foot

## 11. `/insights` (NEW in v2) — the grown-up view

The **only** place instructional methods are named.

- Stat tiles: skills tracked / mastered / learning / needs work
- **High-fidelity lessons toggle** (slower, more beautiful)
- **Speed** section — pace vs expected, only shown once accuracy exists
- **"What actually works for this learner"** — per skill, each approach with mode + method + success bar + attempts
- Footer: prerequisite-graph size

---

## 12. Current visual state & what's wanted

**Today:** dark theme, functional, plain.

```
--bg #0e1016   --panel #1a1e28   --panel-2 #222735   --border #2b3140
--text #e7e9ef --muted #9aa1b1   --accent #6ea8fe    --accent-ink #0a1428
green #34d399  amber #fbbf24     orange #fb923c      red #f87171
```
Rounded 10–16px cards, system font.

**Wanted:** keep it clean and uncluttered, but make it **warm, playful and encouraging for a child** without becoming babyish — a 14-year-old must not feel patronised, and a 7-year-old must not feel lost. Light **and** dark themes. Mobile-first is a plus.

---

# API SPEC

Next.js App Router. JSON throughout. Auth via httpOnly cookie (`sid`).
All learning data is scoped to the **active child**; switching child re-scopes everything.
Errors: `{ "error": string }` with 400 / 401 / 404 / 429 / 500.

## Auth
| Method | Path | Returns |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | `{user:{id,email}}` |
| POST | `/api/auth/logout` | `{ok}` |
| GET | `/api/auth/me` | `{user\|null}` |

## Child profiles
| Method | Path | Returns |
|---|---|---|
| GET/POST | `/api/children` | `{children:Child[], activeId}` |
| POST | `/api/children/select` | `{activeId}` |
| DELETE | `/api/children/[id]` | `{ok}` — refuses the last child |

`Child = { id, name, age?, educationLevel?, avatar /* emoji */, xp, streak, createdAt }`

## Adaptive tutor

**`GET /api/adaptive`** → dashboard
```jsonc
{ "profile":{...}, "progress":{"xp":120,"streak":4},
  "plan":[{"kind":"review","emoji":"🟢","title":"Quick Review","skill":"…",
           "why":"…","minutes":3,"weakAreaId":"…","mode":"practice"}],
  "dueReviews":[WeakArea], "nextAction":{"kind":"review|learn","area":WeakArea},
  "weakAreas":[WeakArea], "diagnostics":[Diagnostic] }
```

**`POST /api/adaptive/diagnostic`** `{topic, standardCode?}` → **stage 1 probe**
```jsonc
{ "diagnosticId", "stage":1, "maxStages":3, "band":"Grade 5",
  "progress":{"asked":0,"estimatedTotal":5}, "items":[PublicItem] }
```

**`POST /api/adaptive/diagnostic/[did]/submit`** `{answers, seconds, totalSeconds, working}`
→ **either the next probe** `{placing:true, stage, band, reason, items}`
→ **or the final result**
```jsonc
{ "placing":false, "overall", "rank", "perAspect", "weakAspects", "summary",
  "workingLevel":"Grade 3", "statedLevel":"Grade 5", "movedLevel":true,
  "questionsAsked":15, "review":[ReviewItem] }
```

**`GET /api/adaptive/diagnostic/[did]/review`** → `{topic, overall, rank, review:[ReviewItem]}`

**`POST /api/adaptive/learn`** `{weakAreaId, reteach?, mode?}` → **slow, 60–90s**
```jsonc
{ "sessionId", "round":2, "explainer":Explainer, "topic", "aspect",
  "teachSkill":"Identify place value in two digit numbers",
  "droppedDown":true, "reason":"Before we add larger numbers…",
  "mode":"show_me", "method":"singapore",        // method = grown-ups only
  "routeReason":"Let's start by seeing how this works.", "auto":true,
  "roundsUsed":2, "maxRounds":4 }
```
429 when capped: `{error, capped:true, roundsUsed, maxRounds}`

**`GET /api/adaptive/learn?sessionId&round?`** → `{session, explainer}` (replay a past round)
**`GET /api/adaptive/assess?sessionId&round?`** → `{items:[PublicItem], domain, skill}`

**`POST /api/adaptive/assess`** `{sessionId, answers, hintsUsed, seconds, totalSeconds, working, retryOf?}`
```jsonc
{ "passed", "capped", "roundsUsed", "maxRounds", "overall",
  "perAspect", "perItem", "weakAspects", "summary",
  "mastery":{"raw":100,"independent":40,"hintsUsed":5,"effective":78},
  "fluency":{"pace":1.7,"fluentPct":20,"effortfulPct":40,
             "rapidGuesses":0,"totalSeconds":273,"needsSpeedWork":true},
  "review":[ReviewItem],
  "reward":{"emoji":"💪","headline":"Almost!","message":"…","xp":5,
            "reason":"Nice effort","comeback":false},
  "progress":{"xp":125,"streak":4,"streakExtended":true} }
```

## Curriculum
| Method | Path | Returns |
|---|---|---|
| GET | `/api/standards?grade=4` | `{grades, domains:[{domain,clusters:[{cluster,standards}]}], stats, attribution}` |
| GET | `/api/standards?q=long+division` | `{results:[Standard]}` |
| GET | `/api/standards?ladder=4.NBT.B.5` | `{standard, published, prerequisites:[Standard]}` |

`Standard = { code, subject, grade, domain, cluster, skill }`

## Insights & feedback
| Method | Path | Body / Returns |
|---|---|---|
| GET | `/api/insights` | `{child, hifi, skills:[{skill,stats:[{modeLabel,modeEmoji,methodLabel,rate,attempts,avgGain}]}], speed, summary}` |
| POST | `/api/insights` | `{hifi:boolean}` |
| POST | `/api/feedback` | `{reactions[], text?, explainerId?, sessionId?, round?, context?}` |

Reaction ids: `loved · got_it · confusing · too_fast · too_slow · not_helpful`

## Core data shapes

```ts
PublicItem = { id, type, aspect, prompt, options?, starterCode?, language?,
               blanks?, visual?, hints? }          // answer keys NEVER sent

type = "mcq" | "multi_mcq" | "fill_blank" | "short_answer"
     | "code_bugfix" | "code_write" | "pseudocode" | "essay" | "math_multistep"

ReviewItem = { itemId, aspect, question, type,
               options?: [{id,text,isCorrect,chosen,reason?}],
               blanks?:  [{index,yours,expected,correct}],
               starterCode?, language?, visual?,
               yourAnswer, correctAnswer?, correct, score,
               explanation?, feedback?, stage? }

WeakArea = { id, topic, aspect, domain, level?, mastery /*0..1*/,
             status:"weak|learning|mastered", intervalDays?, dueAt?, reviews? }

visual = { kind: "fraction_bar" | "number_line" | "array" | "counters"
                 | "base_ten" | "bar_model" | "shape" | "clock", …, caption? }
```

**Explainer video model** — canvas is **800×450 (16:9)**
```ts
Explainer = { id, title, style:"linear"|"interactive", scenes:[Scene], quizzes?, sources? }
Scene = { id, narration, durationMs?, audioUrl?, sceneImageUrl?,
          parts?, beats?, keyframes?, objects?, connectors?, labels? }
```

---

## Design constraints worth knowing

- **Lesson generation takes 60–90 seconds.** The waiting state is a real screen.
- **Placement is multi-step** — the diagnostic is not one form submit.
- **Videos are generated, not uploaded** — no thumbnails until a lesson exists.
- **Avatars are emoji**, not uploaded images.
- **Everything re-scopes on child switch** — the switcher must always be visible.
- **The whiteboard needs pointer/touch/stylus** and must not swallow page scroll.
- **Figures are inline SVG** and must stay legible in both themes.
