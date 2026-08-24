// Grade-band enforcement.
//
// "Grade 3" must mean a specific, bounded set of mathematics, not a vague
// difficulty dial. Without this the generator drifts: we observed a Grade 3
// diagnostic containing a number line running from -5 to 12, when negative
// numbers are not introduced until Grade 6 under Common Core.
//
// Two layers, because prompting alone is not reliable:
//   1. an explicit ALLOWED / NOT YET list injected into every generation prompt
//   2. a post-generation screen that drops items and figures which are clearly
//      above the band

export type Band =
  | "K" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8"
  | "9" | "10" | "11" | "12" | "undergrad" | "adult";

/** Numeric position for comparisons; undergrad/adult sit above school. */
const ORDER: Record<Band, number> = {
  K: 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "11": 11, "12": 12, undergrad: 14, adult: 15,
};

export const bandRank = (b: Band): number => ORDER[b] ?? 15;

/** Map whatever the learner typed to a canonical band. */
export function parseBand(level?: string): Band | null {
  if (!level) return null;
  const s = level.toLowerCase().trim();
  if (/\b(kinder|kg|k-?\d|^k$)/.test(s)) return "K";
  if (/(under ?grad|bachelor|university|college|freshman|sophomore|junior year|senior year)/.test(s)) return "undergrad";
  if (/(master|phd|graduate|professional|adult)/.test(s)) return "adult";
  if (/high ?school/.test(s)) return "10";
  if (/middle ?school/.test(s)) return "7";
  if (/(elementary|primary)/.test(s)) return "3";
  // Accept ordinals too: "5th grade", "3rd grade", "1st grade" are all common.
  const m = s.match(/\b(1[0-2]|[1-9])(?:st|nd|rd|th)?\b/);
  if (m) {
    const n = m[1] as Band;
    if (ORDER[n] !== undefined) return n;
  }
  return null;
}

/**
 * Concepts that must NOT appear at or below a band, with the band at which each
 * is normally introduced (US Common Core scope and sequence for mathematics).
 */
const INTRODUCED_AT: { concept: string; band: Band; test: RegExp }[] = [
  { concept: "negative numbers", band: "6", test: /(?:^|[\s(=,])-\s?\d|negative (?:number|value|integer)|below zero/i },
  { concept: "decimals", band: "4", test: /\b\d+\.\d+\b|\bdecimal\b/i },
  { concept: "percentages", band: "6", test: /\d\s?%|\bpercent(age)?\b/i },
  { concept: "exponents and powers", band: "6", test: /\^\d|\bsquared\b|\bcubed\b|\bexponent\b|\bpower of\b/i },
  { concept: "variables and algebra", band: "6", test: /\bsolve for [a-z]\b|\balgebra|\bequation with (a )?variable|\b[a-z]\s*[+\-]\s*\d+\s*=/i },
  { concept: "ratios and proportions", band: "6", test: /\bratio\b|\bproportion\b/i },
  { concept: "pi and circle area", band: "7", test: /\bpi\b|π|circumference|area of a circle/i },
  { concept: "square roots", band: "8", test: /√|\bsquare root\b/i },
  { concept: "the Pythagorean theorem", band: "8", test: /pythagor/i },
  { concept: "trigonometry", band: "10", test: /\bsine\b|\bcosine\b|\btangent\b|\bsin\(|\bcos\(|\btan\(/i },
  { concept: "calculus", band: "11", test: /\bderivative\b|\bintegral\b|\blimit as\b|\bcalculus\b/i },
  { concept: "multiplication", band: "3", test: /\bmultiply\b|\bmultiplication\b|\btimes table\b|\d\s?[x×]\s?\d/i },
  { concept: "division", band: "3", test: /\bdivide\b|\bdivision\b|\bquotient\b|÷/i },
  { concept: "fractions", band: "3", test: /\bfraction\b|\b\d+\/\d+\b/i },
];

/** The explicit scope block injected into generation prompts. */
export function bandScopePrompt(level?: string): string {
  const band = parseBand(level);
  if (!band) return "";
  const rank = bandRank(band);
  const notYet = INTRODUCED_AT.filter((c) => bandRank(c.band) > rank).map((c) => c.concept);
  if (!notYet.length) return "";
  return `STRICT GRADE BAND: the learner is at US ${band === "K" ? "Kindergarten" : band === "undergrad" || band === "adult" ? band : `Grade ${band}`}.
These are NOT introduced until later grades and MUST NOT appear anywhere in the questions, the answer options, or the figures: ${notYet.join(", ")}.
Stay inside the number ranges and concepts a learner at this exact grade has been taught. If a question would need a later concept, ask a different question instead.`;
}

/**
 * Post-generation screen. Returns the concept that puts this text above the
 * band, or null when it is in scope.
 */
export function outOfBand(text: string, level?: string): string | null {
  const band = parseBand(level);
  if (!band) return null;
  const rank = bandRank(band);
  for (const c of INTRODUCED_AT) {
    if (bandRank(c.band) > rank && c.test.test(text)) return c.concept;
  }
  return null;
}

/** Negative values on a figure are the most common band violation we saw. */
export function visualOutOfBand(v: { kind?: string; min?: number; marks?: number[] } | undefined, level?: string): boolean {
  if (!v) return false;
  const band = parseBand(level);
  if (!band || bandRank(band) >= bandRank("6")) return false;
  if (typeof v.min === "number" && v.min < 0) return true;
  return (v.marks ?? []).some((m) => m < 0);
}
