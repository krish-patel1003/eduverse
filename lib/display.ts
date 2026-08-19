// Pure presentation helpers, safe to import from client components.
// Nothing here may touch the database or any server-only API.

/**
 * Turn an internal skill tag into something a child can read.
 * "multi_digit_addition" -> "Multi digit addition".
 */
export function humanizeSkill(raw: string): string {
  const s = (raw ?? "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "this skill";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
