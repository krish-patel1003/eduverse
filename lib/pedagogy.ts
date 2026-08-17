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
