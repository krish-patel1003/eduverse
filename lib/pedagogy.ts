// The teaching engine.
//
// Two layers, deliberately separated:
//
//   MODE   = what the CHILD experiences and can choose. Six plain-language
//            options, plus a prominent "best way" default. A child should never
//            be asked to pick between "Kumon" and "Singapore": that puts the
//            instructional-design decision on the learner.
//
//   METHOD = how the engine actually delivers it, drawn from established
//            instructional traditions (Kumon, Singapore, Japanese, Russian,
//            Montessori, Socratic/Polya, Mastery, worked-example fading).
//            Chosen automatically from the diagnosis and from what has actually
//            worked for THIS child on THIS skill.
//
// The product rule this encodes: adapt the TEACHING, not just the questions.

export const US_PEDAGOGY = `PEDAGOGICAL GROUNDING: use UNITED STATES curriculum standards and scope and sequence.
- Math: Common Core State Standards for Mathematics (CCSS-M). Use US grade bands (Kindergarten through Grade 12), and US conventions: the standard algorithm taught in US classrooms, place value language ("ones, tens, hundreds"), "regrouping" or "carrying" as taught in US schools.
- English language arts: Common Core ELA standards, US grade-level reading and writing expectations.
- Science: Next Generation Science Standards (NGSS) grade bands.
- Computer science: CSTA K-12 standards, and US university course conventions (CS1/CS2, AP Computer Science A).
- Use US spelling, US units where units appear (inches, feet, miles, pounds, Fahrenheit), US currency (dollars and cents), and US classroom vocabulary.
- Map any grade word the learner gives ("5th grade", "high school", "undergraduate") to the matching US grade band and teach exactly at that band.`;

/** Compact one-line variant for prompts that only need the grade-band pinning. */
export const US_LEVEL_HINT = `Interpret the education level as a US grade band and align content to US standards (Common Core, NGSS, CSTA) with US units, spelling and classroom vocabulary.`;

// ---- what the child sees ----------------------------------------------------

/** The only teaching choice a learner is ever shown. */
export type TeachingMode = "auto" | "show_me" | "step_by_step" | "explain_why" | "practice" | "challenge";

/** Modes the engine can actually deliver (everything except the auto sentinel). */
export type ConcreteMode = Exclude<TeachingMode, "auto">;

export const CONCRETE_MODES: ConcreteMode[] = [
  "show_me",
  "step_by_step",
  "explain_why",
  "practice",
  "challenge",
];

export interface ModeOption {
  id: TeachingMode;
  emoji: string;
  label: string;
  blurb: string;
}

/** Child-facing menu. "auto" is listed first and styled as the recommendation. */
export const MODE_OPTIONS: ModeOption[] = [
  { id: "auto", emoji: "✨", label: "Teach Me the Best Way", blurb: "I'll pick what works best for you" },
  { id: "show_me", emoji: "👀", label: "Show Me", blurb: "Pictures, models and animations" },
  { id: "step_by_step", emoji: "🪜", label: "Step-by-Step", blurb: "Smaller steps, guided all the way" },
  { id: "explain_why", emoji: "💡", label: "Explain Why", blurb: "Understand the reason behind it" },
  { id: "practice", emoji: "🎯", label: "Let Me Practice", blurb: "Short, focused practice" },
  { id: "challenge", emoji: "🚀", label: "Challenge Me", blurb: "Puzzles and deeper thinking" },
];

export const MODE_LABEL: Record<TeachingMode, string> = Object.fromEntries(
  MODE_OPTIONS.map((m) => [m.id, m.label])
) as Record<TeachingMode, string>;

export const MODE_EMOJI: Record<TeachingMode, string> = Object.fromEntries(
  MODE_OPTIONS.map((m) => [m.id, m.emoji])
) as Record<TeachingMode, string>;

export function isTeachingMode(x: unknown): x is TeachingMode {
  return typeof x === "string" && MODE_OPTIONS.some((m) => m.id === x);
}

// ---- what the engine does ---------------------------------------------------

/**
 * Instructional methods. These are never shown to a child by name; they are how
 * the engine delivers the chosen mode.
 */
export type TeachingMethod =
  | "kumon" // small incremental steps, repetition, fluency, work at the right level
  | "singapore" // concrete -> pictorial -> abstract, bar models, why it works
  | "japanese" // solve, explain your thinking, compare strategies, reflect
  | "russian" // non-routine problems, deeper reasoning over procedure
  | "montessori" // physical objects and manipulatives, hands-on representation
  | "socratic" // guiding questions and hints instead of answers (Polya)
  | "mastery" // do not advance until the foundation is genuinely solid
  | "fading"; // worked example -> do one together -> try one yourself

export const TEACHING_METHODS: TeachingMethod[] = [
  "kumon",
  "singapore",
  "japanese",
  "russian",
  "montessori",
  "socratic",
  "mastery",
  "fading",
];

/** Parent/teacher-facing names. Still never shown to the child. */
export const METHOD_LABEL: Record<TeachingMethod, string> = {
  kumon: "Kumon-style practice",
  singapore: "Singapore concrete to abstract",
  japanese: "Japanese explain and compare",
  russian: "Russian-style reasoning",
  montessori: "Montessori manipulatives",
  socratic: "Socratic questioning",
  mastery: "Mastery learning",
  fading: "Worked-example fading",
};

export function isTeachingMethod(x: unknown): x is TeachingMethod {
  return typeof x === "string" && (TEACHING_METHODS as string[]).includes(x);
}

const METHOD_PROMPT: Record<TeachingMethod, string> = {
  kumon:
    "METHOD (Kumon-style): advance in very small increments the learner can complete independently. Each step should be only slightly harder than the last, with enough repetition of the same pattern that the procedure becomes automatic and fast. Do not jump difficulty. Prioritize fluency and confidence over variety.",
  singapore:
    "METHOD (Singapore math): follow CONCRETE then PICTORIAL then ABSTRACT, in that order. Begin with real countable objects, then move to a drawn model (bar model, number line, place-value chart, array), and only then to the symbols and written algorithm. Make the learner see WHY the procedure works before naming it.",
  japanese:
    "METHOD (Japanese lesson study): center the lesson on the learner's own thinking. Pose one rich problem, show more than one valid way to solve it, compare the approaches out loud (which is faster, which is clearer, which generalizes), and finish by reflecting on what was learned. Explaining the reasoning matters as much as the answer.",
  russian:
    "METHOD (Russian-style): favor depth over drill. Use non-routine problems that require genuine reasoning, ask the learner to justify each claim, and probe with 'what if we changed this?' variations. Reveal the underlying mathematical structure rather than a procedure to memorize.",
  montessori:
    "METHOD (Montessori / manipulatives): teach through concrete objects the learner can imagine handling, such as base-ten blocks, counters, fraction tiles, number rods or measuring tools. Show the mathematics physically happening before any symbol appears. Keep language minimal and let the materials carry the idea.",
  socratic:
    "METHOD (Socratic / Polya): do not state the rule. Lead with short questions the learner can answer, one small realization at a time, and let them arrive at the idea themselves. When they are stuck, give the smallest possible hint rather than the answer, and ask them to restate the discovery in their own words.",
  mastery:
    "METHOD (mastery learning): treat the foundation as non-negotiable. Teach one narrow objective only, check it directly, and do not introduce anything that depends on it until it is secure. Explicitly name the one thing the learner must be able to do by the end.",
  fading:
    "METHOD (worked-example fading): follow WATCH ONE, then DO ONE TOGETHER, then TRY ONE YOURSELF. Fully solve the first example with every step narrated, work the second with the learner filling in the steps, then set a third for them to attempt alone. Reduce the support each time.",
};

export function methodToPrompt(method: TeachingMethod): string {
  return METHOD_PROMPT[method] ?? "";
}

const MODE_PROMPT: Record<ConcreteMode, string> = {
  show_me:
    "MODE (Show Me): lead with visuals. Every key idea must be carried by a picture, model or diagram the learner can point at, not by a paragraph of words.",
  step_by_step:
    "MODE (Step-by-Step): break the skill into the smallest sub-steps and teach exactly one per scene, checking understanding after each. Go slower than feels necessary.",
  explain_why:
    "MODE (Explain Why): the goal is understanding, not the answer. Make the reasoning explicit and have the learner articulate why the method works.",
  practice:
    "MODE (Practice): keep explanation short and get to focused repetition quickly. Many similar items, gradually building speed and accuracy.",
  challenge:
    "MODE (Challenge): the learner already has the basics. Stretch them with a harder, non-routine problem that needs real thinking, not more of the same.",
};

export function modeToPrompt(mode: ConcreteMode): string {
  return MODE_PROMPT[mode] ?? "";
}

// ---- mode -> method ---------------------------------------------------------

/**
 * Which methods can deliver a given mode, best first. Multiple entries let the
 * engine change method on a retry without leaving the mode the child picked.
 */
const MODE_METHODS: Record<ConcreteMode, TeachingMethod[]> = {
  show_me: ["singapore", "montessori"],
  step_by_step: ["fading", "kumon", "mastery"],
  explain_why: ["japanese", "socratic"],
  practice: ["kumon", "fading"],
  challenge: ["russian", "japanese"],
};

export function methodsForMode(mode: ConcreteMode): TeachingMethod[] {
  return MODE_METHODS[mode] ?? ["singapore"];
}

// ---- the router -------------------------------------------------------------

export interface RouteInput {
  /** What the child asked for. "auto" hands the decision to the engine. */
  requested: TeachingMode;
  /** 1-based attempt number for this skill. */
  round: number;
  /** Current mastery 0..1 for the skill being taught. */
  mastery?: number;
  /** True when diagnosis dropped to a prerequisite below the original aspect. */
  droppedDown?: boolean;
  /** True when the same misconception has now appeared more than once. */
  repeatedMistake?: boolean;
  /** True when this is a scheduled review of previously mastered material. */
  isReview?: boolean;
  /** True when they can compute but could not justify or explain. */
  canDoCannotExplain?: boolean;
  /** True when answers are right but slow or inconsistent. */
  needsFluency?: boolean;
  /** (mode, method) pairs already tried for this skill, so we never repeat a miss. */
  alreadyTried?: { mode: ConcreteMode; method: TeachingMethod }[];
  /** What has historically worked for THIS child on THIS skill. */
  bestForSkill?: { mode: ConcreteMode; method: TeachingMethod } | null;
  /**
   * A starting hypothesis read from how the learner ANSWERED (figures helped,
   * could recognise but not produce, and so on). Used when there is no history
   * for this skill yet, which is exactly the cold-start case.
   */
  prior?: { mode: ConcreteMode; method: TeachingMethod; reason: string; confidence: number } | null;
}

export interface Route {
  mode: ConcreteMode;
  method: TeachingMethod;
  /** Why the engine chose this, for the parent/teacher view and for debugging. */
  rationale: string;
  /** True when the child let the system decide. */
  auto: boolean;
}

/**
 * Pick the mode and method for the next lesson.
 *
 * When the child chooses a mode we honor it and only select the METHOD. When
 * they choose "Teach Me the Best Way" we select both, from the diagnosis and
 * from this child's history on this specific skill.
 */
export function routeTeaching(input: RouteInput): Route {
  const tried = input.alreadyTried ?? [];
  const usedMethods = new Set(tried.map((t) => t.method));
  const usedModes = new Set(tried.map((t) => t.mode));

  // Honor an explicit child choice: pick the best method that has not failed yet.
  if (input.requested !== "auto") {
    const mode = input.requested;
    const candidates = methodsForMode(mode);
    const method = candidates.find((m) => !usedMethods.has(m)) ?? candidates[0];
    return {
      mode,
      method,
      rationale: `You chose ${MODE_LABEL[mode]}.`,
      auto: false,
    };
  }

  // ---- automatic routing, most specific signal first ----
  const pick = (mode: ConcreteMode, rationale: string): Route => {
    const candidates = methodsForMode(mode);
    const method = candidates.find((m) => !usedMethods.has(m)) ?? candidates[0];
    return { mode, method, rationale, auto: true };
  };

  // A scheduled review is a short check, not a fresh course.
  if (input.isReview) {
    return pick("practice", "A quick refresher so this stays sharp.");
  }

  // A missing foundation outranks everything: rebuild it in small guided steps.
  if (input.droppedDown) {
    return pick("step_by_step", "We are rebuilding the foundation this rests on, one small step at a time.");
  }

  // The same misconception twice means the delivery itself is not landing.
  if (input.repeatedMistake) {
    const mode: ConcreteMode =
      (CONCRETE_MODES.find((m) => !usedModes.has(m) && m !== "challenge") as ConcreteMode) ?? "show_me";
    return pick(mode, "That explanation did not click, so we are trying a completely different approach.");
  }

  // Can compute but cannot justify: make the reasoning the lesson.
  if (input.canDoCannotExplain) {
    return pick("explain_why", "You can get the answer, so now let's nail down why it works.");
  }

  // Solid understanding, just not fluent yet.
  if (input.needsFluency) {
    return pick("practice", "You understand it. Now let's make it quick and automatic.");
  }

  // Genuine mastery: stretch rather than repeat.
  if ((input.mastery ?? 0) >= 0.85) {
    return pick("challenge", "You have this. Time for something that makes you think harder.");
  }

  // Prefer what has actually worked for this child on this exact skill.
  if (input.bestForSkill && !usedMethods.has(input.bestForSkill.method)) {
    const { mode, method } = input.bestForSkill;
    return { mode, method, rationale: "Using the approach that has worked best for you on this skill.", auto: true };
  }

  // No history for this skill yet, but the way they answered is evidence. This
  // is what turns the first lesson from a default into an informed guess.
  if (input.prior && !usedMethods.has(input.prior.method)) {
    return {
      mode: input.prior.mode,
      method: input.prior.method,
      rationale: `Starting here because ${input.prior.reason}.`,
      auto: true,
    };
  }

  // First contact with a skill: see it before formalizing it.
  if (input.round <= 1) {
    return pick("show_me", "Let's start by seeing how this works.");
  }

  // Later attempts: move to guided steps.
  return pick("step_by_step", "Let's slow this down and build it step by step.");
}

/** Assemble the full teaching instruction block for the lesson prompt. */
export function routeToPrompt(route: Route): string {
  return `${modeToPrompt(route.mode)}\n${methodToPrompt(route.method)}`;
}
