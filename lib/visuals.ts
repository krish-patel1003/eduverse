// Visual models for assessment questions.
//
// These are NOT generated images. A picture of "three quarters shaded" produced
// by an image model frequently shades the wrong number of parts, which is fatal
// in an assessment. Instead the model emits a small STRUCTURED SPEC and we draw
// it deterministically, so the mathematics in the picture is always exactly
// right, renders instantly, costs nothing, and looks consistent.
//
// This also makes the Singapore "pictorial" stage real inside the assessment,
// not just inside lessons.

export type VisualKind =
  | "fraction_bar" // a bar split into equal parts, some shaded
  | "number_line" // a line with ticks, optionally marking a value
  | "array" // rows x cols of dots (multiplication / area)
  | "base_ten" // hundreds / tens / ones place-value blocks
  | "bar_model" // Singapore comparison bars
  | "shape" // rectangle / triangle / circle with labelled dimensions
  | "counters" // equal groups of counters (division / grouping)
  | "clock"; // an analogue clock face

export interface ItemVisual {
  kind: VisualKind;
  /** Short caption under the figure. Never gives the answer away. */
  caption?: string;
  // fraction_bar
  parts?: number;
  shaded?: number;
  // number_line
  min?: number;
  max?: number;
  step?: number;
  /** Values to mark with a dot on the line. */
  marks?: number[];
  // array / counters
  rows?: number;
  cols?: number;
  groups?: number;
  per?: number;
  // base_ten
  hundreds?: number;
  tens?: number;
  ones?: number;
  // bar_model
  bars?: { label: string; value: number }[];
  // shape
  shape?: "rect" | "triangle" | "circle";
  width?: number;
  height?: number;
  radius?: number;
  /** Unit suffix for shape labels, e.g. "cm". */
  unit?: string;
  // clock
  hour?: number;
  minute?: number;
}

const KINDS: VisualKind[] = [
  "fraction_bar",
  "number_line",
  "array",
  "base_ten",
  "bar_model",
  "shape",
  "counters",
  "clock",
];

const int = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};
const num = (v: unknown, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

/**
 * Validate and clamp a model-produced visual spec. Returns null when the spec is
 * unusable, so a bad figure simply disappears rather than rendering nonsense.
 * Every kind is clamped to a size that stays legible on a phone.
 */
export function normalizeVisual(raw: unknown): ItemVisual | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind as VisualKind;
  if (!KINDS.includes(kind)) return null;

  const v: ItemVisual = { kind };
  if (typeof r.caption === "string" && r.caption.trim()) v.caption = r.caption.trim().slice(0, 120);

  switch (kind) {
    case "fraction_bar": {
      v.parts = int(r.parts, 2, 12, 4);
      v.shaded = int(r.shaded, 0, v.parts, 1);
      return v;
    }
    case "number_line": {
      const min = num(r.min, 0);
      const max = num(r.max, 10);
      if (max <= min) return null;
      v.min = min;
      v.max = max;
      const span = max - min;
      // Keep tick count sane: between 2 and 24 intervals.
      let step = num(r.step, span / 10);
      if (!(step > 0) || span / step > 24) step = span / 10;
      if (span / step < 2) step = span / 2;
      v.step = step;
      v.marks = Array.isArray(r.marks)
        ? (r.marks as unknown[]).map((m) => Number(m)).filter((m) => Number.isFinite(m) && m >= min && m <= max).slice(0, 6)
        : [];
      return v;
    }
    case "array": {
      v.rows = int(r.rows, 1, 12, 3);
      v.cols = int(r.cols, 1, 12, 4);
      return v;
    }
    case "counters": {
      v.groups = int(r.groups, 1, 8, 3);
      v.per = int(r.per, 1, 10, 4);
      return v;
    }
    case "base_ten": {
      v.hundreds = int(r.hundreds, 0, 9, 0);
      v.tens = int(r.tens, 0, 9, 0);
      v.ones = int(r.ones, 0, 9, 0);
      if (!v.hundreds && !v.tens && !v.ones) return null;
      return v;
    }
    case "bar_model": {
      const bars = Array.isArray(r.bars) ? r.bars : [];
      v.bars = bars
        .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
        .slice(0, 4)
        .map((b) => ({
          label: typeof b.label === "string" ? b.label.trim().slice(0, 24) : "",
          value: Math.max(0, num(b.value, 0)),
        }))
        .filter((b) => b.value > 0);
      return v.bars.length ? v : null;
    }
    case "shape": {
      const s = r.shape === "triangle" || r.shape === "circle" ? r.shape : "rect";
      v.shape = s;
      if (typeof r.unit === "string") v.unit = r.unit.trim().slice(0, 6);
      if (s === "circle") v.radius = Math.max(1, num(r.radius, 5));
      else {
        v.width = Math.max(1, num(r.width, 6));
        v.height = Math.max(1, num(r.height, 4));
      }
      return v;
    }
    case "clock": {
      v.hour = int(r.hour, 1, 12, 3);
      v.minute = int(r.minute, 0, 59, 0);
      return v;
    }
  }
  return null;
}

/** Prompt fragment describing the schema to the assessment generator. */
export const VISUAL_SPEC = `VISUALS: for math and geometry items where a picture genuinely helps the learner
reason (fractions, place value, multiplication, number sense, measurement, time,
word problems), attach a "visual" object. Do NOT attach one to items where a
picture would give the answer away, and do NOT attach one just for decoration.
The figure is DRAWN EXACTLY from your numbers, so the numbers must be correct.

"visual" is one of:
  { "kind": "fraction_bar", "parts": 8, "shaded": 3 }
  { "kind": "number_line", "min": 0, "max": 10, "step": 1, "marks": [7] }
  { "kind": "array", "rows": 3, "cols": 4 }
  { "kind": "counters", "groups": 3, "per": 4 }
  { "kind": "base_ten", "hundreds": 1, "tens": 4, "ones": 7 }
  { "kind": "bar_model", "bars": [{"label":"Ana","value":12},{"label":"Ben","value":8}] }
  { "kind": "shape", "shape": "rect"|"triangle"|"circle", "width": 6, "height": 4, "radius": 5, "unit": "cm" }
  { "kind": "clock", "hour": 3, "minute": 30 }
Optionally add "caption": a short label under the figure that does not reveal the answer.

CRITICAL: the figure must match the QUESTION'S OWN numbers and framing exactly.
If the question talks about the segment from 0 to 1 split into sixths, the number
line must be min 0, max 1 with step 1/6 (use decimals), NOT 0 to 6. If the numbers
in the question and the figure disagree, omit the visual entirely.`;
