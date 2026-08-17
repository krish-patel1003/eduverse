// Shared pedagogical grounding. Everything the tutor generates (diagnostics,
// prerequisite ladders, lessons) is pinned to US scope and sequence so that a
// grade level means a specific, standards-aligned set of skills rather than a
// vague difficulty setting.

export const US_PEDAGOGY = `PEDAGOGICAL GROUNDING: use UNITED STATES curriculum standards and scope and sequence.
- Math: Common Core State Standards for Mathematics (CCSS-M). Use US grade bands (Kindergarten through Grade 12), and US conventions: the standard algorithm taught in US classrooms, place value language ("ones, tens, hundreds"), "regrouping" or "carrying" as taught in US schools.
- English language arts: Common Core ELA standards, US grade-level reading and writing expectations.
- Science: Next Generation Science Standards (NGSS) grade bands.
- Computer science: CSTA K-12 standards, and US university course conventions (CS1/CS2, AP Computer Science A).
- Use US spelling, US units where units appear (inches, feet, miles, pounds, Fahrenheit), US currency (dollars and cents), and US classroom vocabulary.
- Map any grade word the learner gives ("5th grade", "high school", "undergraduate") to the matching US grade band and teach exactly at that band.`;

/** Compact one-line variant for prompts that only need the grade-band pinning. */
export const US_LEVEL_HINT = `Interpret the education level as a US grade band and align content to US standards (Common Core, NGSS, CSTA) with US units, spelling and classroom vocabulary.`;

// ---- teaching modes ---------------------------------------------------------

/**
 * How a lesson is delivered. When a lesson does not land, the retry changes the
 * MODE, not just the wording, so the learner meets the idea a genuinely
 * different way. We record which mode produced mastery and prefer it later.
 */
export type TeachingMode = "worked_example" | "concrete_visual" | "socratic" | "micro_steps" | "story";

export const TEACHING_MODES: TeachingMode[] = [
  "worked_example",
  "concrete_visual",
  "socratic",
  "micro_steps",
  "story",
];

export const MODE_LABEL: Record<TeachingMode, string> = {
  worked_example: "Worked examples",
  concrete_visual: "Concrete and visual",
  socratic: "Guided questions",
  micro_steps: "Tiny steps",
  story: "Story and analogy",
};

const MODE_PROMPT: Record<TeachingMode, string> = {
  worked_example:
    "TEACHING MODE: worked examples. Show complete problems solved start to finish, narrating the reasoning at each step, then a near-identical one, then a slight variation. Make the procedure unmistakable.",
  concrete_visual:
    "TEACHING MODE: concrete and visual. Start with physical, countable objects and pictures before any symbol or notation. Show the idea happening in the real world first, and only name the abstract rule at the very end.",
  socratic:
    "TEACHING MODE: guided questions. Lead with short questions the learner can answer in their head, building one small realization at a time, confirming each before moving on. Never just assert the rule, walk them to it.",
  micro_steps:
    "TEACHING MODE: tiny steps. Break the skill into the smallest possible sub-steps and teach exactly one per scene, with a mini check after each. Go slower than feels necessary.",
  story:
    "TEACHING MODE: story and analogy. Anchor the whole idea in one vivid everyday situation and carry that same situation all the way through, mapping each part of the story onto each part of the concept.",
};

export function modeToPrompt(mode: TeachingMode): string {
  return MODE_PROMPT[mode] ?? "";
}

/**
 * Choose the mode for the next round: prefer what has demonstrably worked for
 * this learner, otherwise take the next mode that has not been tried yet, so a
 * retry never repeats the delivery that already failed.
 */
export function pickTeachingMode(input: {
  alreadyTried: TeachingMode[];
  preferred?: TeachingMode;
  round: number;
}): TeachingMode {
  const { alreadyTried, preferred, round } = input;
  if (round <= 1 && preferred && !alreadyTried.includes(preferred)) return preferred;
  const untried = TEACHING_MODES.filter((m) => !alreadyTried.includes(m));
  if (untried.length) {
    // On a first lesson lead with worked examples; on retries prefer a sharper
    // change of approach (concrete, then micro steps).
    const order: TeachingMode[] =
      round <= 1
        ? ["worked_example", "concrete_visual", "story", "socratic", "micro_steps"]
        : ["concrete_visual", "micro_steps", "story", "socratic", "worked_example"];
    return order.find((m) => untried.includes(m)) ?? untried[0];
  }
  return TEACHING_MODES[(round - 1) % TEACHING_MODES.length];
}
