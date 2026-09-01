# EduVerse — Technical Design

How the system is put together, and **why** each significant decision went the way
it did. The rationale matters more than the structure: most of these choices have
an obvious-looking alternative that turned out to be wrong.

---

## 1. The central idea

Adaptive learning products usually adapt the **questions**. Get it wrong, get an
easier one. That leaves the learner inside the same misunderstanding.

EduVerse adapts the **instruction**. Every wrong answer is treated as evidence
about *what the learner believes*, and the response is a different lesson about a
possibly different skill — not the same lesson reworded.

Three consequences shape the whole architecture:

1. **Per-item evidence must be preserved.** An aggregate score cannot tell you
   what to teach next.
2. **The engine needs a curriculum**, not a vibe about difficulty. "Grade 4 maths"
   is a guess; `4.NBT.B.5` is a specific, sequenced, checkable skill.
3. **What works must be learned per skill.** A learner does not have one fixed
   "learning style"; the best approach changes by concept.

---

## 2. Layers

```
┌───────────────────────────────────────────────────────────┐
│  UI          Next.js App Router · React 19 · CSS tokens   │
├───────────────────────────────────────────────────────────┤
│  Routes      app/api/**  — thin; orchestration only       │
├───────────────────────────────────────────────────────────┤
│  Engine      pedagogy · diagnose · placement · prior      │
│              assessment · effectiveness · timing · rewards│
├───────────────────────────────────────────────────────────┤
│  Knowledge   standards (CCSS-M) · prerequisite graph      │
├───────────────────────────────────────────────────────────┤
│  Memory      SQLite — 15 tables, additive migrations      │
├───────────────────────────────────────────────────────────┤
│  Model       gemini.ts — JSON contracts, timeouts         │
└───────────────────────────────────────────────────────────┘
```

Routes contain **no teaching logic**. Everything decidable is a pure function in
`lib/`, which is why the engine is testable without standing up a server.

---

## 3. The teaching engine

### 3.1 Mode vs method (`lib/pedagogy.ts`)

Two deliberately separated layers:

- **MODE** — what the child experiences and may choose. Six plain-language
  options plus a prominent `auto`.
- **METHOD** — how the engine delivers it: `kumon`, `singapore`, `japanese`,
  `russian`, `montessori`, `socratic`, `mastery`, `fading`.

**Why separated:** asking a 9-year-old to choose between Kumon and Singapore puts
the instructional-design decision on the learner. The child expresses a
*preference for help*; the system owns the *pedagogy*.

### 3.2 Routing

`routeTeaching()` picks both, most specific signal first:

| Signal | Route |
|---|---|
| Scheduled review | `practice` — a short refresher |
| Foundation missing (`droppedDown`) | `step_by_step` + mastery |
| Same misconception twice | **a different mode entirely** |
| Right answer, no justification | `explain_why` + japanese |
| Right but slow / hint-dependent | `practice` + kumon |
| Mastery ≥ 0.85 | `challenge` + russian |
| History exists for this skill | whatever previously worked |
| No history | cold-start prior (§5) |

A method already tried and failed is **excluded**, so the loop cannot converge on
repeating what did not work.

### 3.3 The loop, and why it terminates

Two convergent loops, both bounded:

- **Remediation** — `MAX_ROUNDS = 4`, state in `adaptive_sessions.rounds[]`
- **Placement** — `MAX_STAGES = 3`, converges when a probe lands in the
  productive middle (40–80%)

These are **deterministic state machines that orchestrate LLM calls**. The model
never chooses its own next action. That is a design choice, not a limitation: the
decisions are pedagogical and must be inspectable and reproducible.

---

## 4. Diagnosis (`lib/diagnose.ts`, `lib/assessment.ts`)

Grading produces, per item: correctness, a **named misconception**, a **missing
skill**, and an **error type** from a 7-value taxonomy.

The misconception describes the mistake. The **error type decides what to do**:

| Error type | → Method |
|---|---|
| `procedural_slip` | Kumon practice |
| `concept_gap` | Singapore concrete → abstract |
| `prerequisite_gap` | Mastery + step-by-step |
| `cannot_justify` | Japanese |
| `transfer_failure` | Russian |
| `notation_error` | Worked-example fading |
| `guessing` | Back up to mastery |

`diagnoseNextSkill()` then reads the evidence against a prerequisite ladder and
picks the **lowest broken rung** — which may be several grades below the aspect
the learner started on.

> **Design note.** Non-attempts are excluded from this pass. A random click that
> produced a confident, invented misconception used to steer the entire re-teach
> from pure noise. See §7.

---

## 5. Knowing what works

### 5.1 Per-skill effectiveness (`lib/effectiveness.ts`)

`teaching_outcomes` records `(child, skill, mode, method) → success`.
`bestForSkill()` returns what has demonstrably worked **for this child on this
skill**.

**Why per skill:** an earlier version stored one global `bestMode` per learner.
That is wrong. Real data from a single profile:

```
decimals         → Singapore visual   100%   Kumon repetition  25%
multiplication   → Kumon repetition   100%   Singapore visual  25%
```

One "learning style" would have been wrong half the time.

### 5.2 Cold start (`lib/prior.ts`)

A new learner has no history, so the router used to fall back to a generic
default. The diagnostic already contained method-relevant evidence we were
discarding:

- items **with a figure vs without** → do visuals help?
- **recognition vs production** items → can they recognise but not execute?
- proportion left blank → a confidence problem?
- the dominant error type

No extra model call. This turns the first lesson from a default into a hypothesis.

---

## 6. The curriculum spine

### 6.1 Why Common Core, not a vendor taxonomy

Vendor skill lists are proprietary and are themselves derived from Common Core.
Going to the source is legally clean, more authoritative, free, and yields the
official codes teachers and parents recognise.

`lib/ccssm.ts` seeds **267 standards, K-12**. High-school standards are published
by conceptual category rather than grade, so each is placed at its **typical US
course** (9 Algebra 1, 10 Geometry, 11 Algebra 2, 12 Precalculus) to keep
placement and band enforcement consistent with K-8.

### 6.2 The prerequisite graph

`PREREQS` encodes **178 entries / 262 edges**. `standardLadder()` walks it
backwards breadth-first, cycle-guarded, ordered easiest-first.

**Why a graph instead of generating a ladder:** generation cost a model call per
re-teach and produced a fresh guess each time, so two learners on the same skill
got different ladders. The graph is deterministic, identical for everyone, free,
and every rung is a code a teacher can check. Unmapped standards fall through to
generation — a designed fallback, currently covering the other 33%.

### 6.3 Grade-band enforcement (`lib/gradeband.ts`)

Enforced **twice**, because prompting alone is not reliable:

1. An explicit "NOT YET introduced" list injected into every generation prompt
2. A post-generation screen that drops out-of-band items and figures

Two guards keep it safe: a concept the learner **explicitly asked to study** is
never screened out, and screening can never empty an assessment.

---

## 7. Measurement

### 7.1 Mastery is not accuracy

`mastery` separates:

- **raw** — percentage correct
- **independent** — correct with **zero hints**
- **effective** — hint-discounted (100% unaided / 80% after one / 60% after two)

Mastery is judged on `effective`. Two learners both scoring 100% raw separate to
100% vs 60% effective once hint use is counted.

### 7.2 Timing (`lib/timing.ts`)

Per-question active time is measured — pausing on tab-hidden and after 45s idle,
attributing time only to the question on screen.

Verdicts are conditioned on **correctness and chance level**:

| | Correct | Wrong |
|---|---|---|
| **Very fast** | `fluent` (the goal) — unless the item is highly guessable | `rapid_guess` → **discarded** |
| **Normal** | `expected` | `expected` |
| **Slow** | `effortful` (understands, not automatic) | `struggled` (genuine difficulty) |

Three rules that are easy to get wrong:

- **Fast + correct is fluency, not cheating.** It only reads as luck on a
  4-option MCQ, never on a fill-in-the-blank.
- **Slow is not a bad sign.** Careful checking, long word problems and real
  reasoning all look slow. Expected time therefore includes a **reading allowance**.
- **Timing never touches the mastery score.** It is a separate dimension that only
  matters once accuracy exists, so a careful learner is never marked down.

**The most valuable output is not speed** — it is rapid-guess detection, which
keeps non-attempts out of misconception diagnosis.

### 7.3 Spaced repetition

SM-2 style on `weak_areas`: a pass grows the interval by an ease factor, a miss
resets it to tomorrow. "Mastered" is never permanent, and an overdue review
outranks new material in the daily plan.

---

## 8. Model integration (`lib/gemini.ts`)

- **Structured output** — `responseMimeType: "application/json"` against a
  declared schema, then hand-written validators (`normItem`, `normalizeVisual`,
  allowlisted enums). Nothing from the model reaches the database unvalidated.
- **Timeouts** — every call is abort-bounded. This was added after an
  image-attached grading call ran **1,274 seconds**; there had been no timeout
  anywhere, so one stalled generation pinned a route indefinitely.
- **Budget isolation** — handwriting grading runs as a **separate per-item pass**
  with its own shorter budget, so one slow or unreadable image degrades that item
  instead of stalling grading for the whole assessment.
- **Graceful degradation** — high-fidelity rendering falls back to the standard
  renderer rather than failing the lesson.

### Deterministic over generative, twice

Two places where the obvious LLM answer was the wrong one:

1. **Question figures.** An image model asked for "three eighths shaded"
   frequently shades the wrong number of parts — fatal in an assessment. The
   model instead emits a **structured spec** (`{kind:"fraction_bar",parts:8,
   shaded:3}`) rendered as exact SVG. Always correct, instant, free.
2. **Prerequisite ladders.** See §6.2.

---

## 9. Data model

15 SQLite tables. The ones that carry the engine:

| Table | Holds | Memory type |
|---|---|---|
| `students` | Learner profiles (child = a row, owned by a user) | Identity |
| `weak_areas` | Per-skill mastery + spaced-repetition schedule | Semantic |
| `adaptive_sessions` | `rounds[]` — every attempt with full evidence | **Episodic** |
| `teaching_outcomes` | Which approach worked, per skill | **Procedural** |
| `diagnostics` | Placement state, evidence, learner-facing review | Episodic |
| `standards` | CCSS-M spine | **Semantic** |
| `prereq_ladders` | Cached generated ladders | Semantic |
| `events` | Raw activity log | Episodic |

Migrations are **additive and idempotent** — `addCol()` guards on
`PRAGMA table_info`, so every deploy is safe against an older database.

**Multi-tenancy:** every learning row carries `student_id`, and
`currentStudentId(req)` resolves the *active child*. Switching child therefore
re-scopes the entire app with no per-query changes.

---

## 10. Deployment

Containerised **standalone** Next.js on **Cloud Run**. SQLite lives on a writable
path (`DATA_DIR=/tmp`) and is replicated to Cloud Storage by **Litestream**, so
data survives container restarts. Secrets come from **Secret Manager**;
`INLINE_ASSETS` inlines generated media as data URLs because the image filesystem
is read-only.

---

## 11. Decisions worth re-examining

Honest list of what is weakest:

- **The 4-round cap counts all lessons, not failures.** A curious learner
  exploring teaching modes burns the budget without ever failing a check. Capping
  *failed* attempts would be better.
- **Prerequisite coverage is 67%.** Extending `PREREQS` is cheap, mechanical work
  that moves more re-teaches onto the free deterministic path.
- **The visual prior rarely fires.** It needs 2+ figure and 2+ non-figure items,
  and a 5-item probe often has only one figure. Probes could deliberately balance
  this.
- **Maths only.** The `subject` column exists; ELA and NGSS need seeds.
- **No formal eval harness.** Testing is targeted and behavioural, not a versioned
  eval suite with regression tracking.
- **Auth is app-local** and not hardened for untrusted traffic.

---

## 12. Testing approach

There is no unit-test framework. Engine logic is verified by **targeted
behavioural checks against the real running system**, because the failure modes
that actually occurred were integration failures, not logic errors:

- routing decisions across every spec case
- timing verdicts including the conditioned edge cases
- grade-band parsing, including ordinals like "5th grade"
- placement convergence, simulated across learners above and below their stated grade
- graph traversal verified through the API, not a re-implementation

> **Lesson learned.** One verification pass used a hand-written mirror of the
> graph walk inside the test script. The mirror had a bug and the code did not.
> Re-implementing logic in order to test it just produces a second thing that can
> be wrong; check against the running system instead.
