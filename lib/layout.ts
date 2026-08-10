import type { Scene, VLabel, SceneObject } from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

// Layout eval layer.
//
// Generated scenes place objects and text labels with model-chosen coordinates,
// which regularly drift off the 800x450 canvas or collide. This pass runs after
// the storyboard merge and BEFORE assets are generated: it clamps every element
// back inside a safe margin, keeps text from overflowing the right/bottom edges
// (using an estimated text width), and nudges overlapping labels apart. It
// returns a list of the issues it corrected so they can be logged.

const PAD = 10; // safe inset from every edge
const GAP = 6; // min gap when separating overlapping labels

// Rough on-screen text metrics for the cursive label font.
const CHAR_W = 0.56; // width per char as a fraction of font size
const LINE_H = 1.25;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutIssue {
  scene: string;
  kind: "overflow-x" | "overflow-y" | "oversize" | "overlap";
  what: string;
}

function clampObject(o: SceneObject, issues: LayoutIssue[], sceneId: string): void {
  // Never larger than the canvas (minus margins).
  const maxW = CANVAS_W - 2 * PAD;
  const maxH = CANVAS_H - 2 * PAD;
  if (o.w > maxW) {
    issues.push({ scene: sceneId, kind: "oversize", what: `object ${o.id} w=${Math.round(o.w)}` });
    o.w = maxW;
  }
  if (o.h > maxH) {
    issues.push({ scene: sceneId, kind: "oversize", what: `object ${o.id} h=${Math.round(o.h)}` });
    o.h = maxH;
  }
  const nx = Math.max(PAD, Math.min(o.x, CANVAS_W - PAD - o.w));
  const ny = Math.max(PAD, Math.min(o.y, CANVAS_H - PAD - o.h));
  if (nx !== o.x) {
    issues.push({ scene: sceneId, kind: "overflow-x", what: `object ${o.id}` });
    o.x = nx;
  }
  if (ny !== o.y) {
    issues.push({ scene: sceneId, kind: "overflow-y", what: `object ${o.id}` });
    o.y = ny;
  }
}

// Label rect: SVG <text> anchors at the baseline (start), so the glyphs run
// right from x and up from y. Approximate the drawn box.
function labelRect(l: VLabel): Rect {
  const size = l.size ?? 20;
  const w = Math.max(size, l.text.length * size * CHAR_W);
  const h = size * LINE_H;
  return { x: l.x, y: l.y - size, w, h };
}

function clampLabel(l: VLabel, issues: LayoutIssue[], sceneId: string): void {
  const r = labelRect(l);
  const size = l.size ?? 20;
  // Horizontal: keep the whole word on-canvas.
  if (r.x + r.w > CANVAS_W - PAD) {
    l.x = Math.max(PAD, CANVAS_W - PAD - r.w);
    issues.push({ scene: sceneId, kind: "overflow-x", what: `label "${l.text.slice(0, 24)}"` });
  } else if (l.x < PAD) {
    l.x = PAD;
    issues.push({ scene: sceneId, kind: "overflow-x", what: `label "${l.text.slice(0, 24)}"` });
  }
  // Vertical: baseline must leave room for ascenders above and stay off the floor.
  if (l.y - size < PAD) {
    l.y = PAD + size;
    issues.push({ scene: sceneId, kind: "overflow-y", what: `label "${l.text.slice(0, 24)}"` });
  } else if (l.y > CANVAS_H - PAD) {
    l.y = CANVAS_H - PAD;
    issues.push({ scene: sceneId, kind: "overflow-y", what: `label "${l.text.slice(0, 24)}"` });
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Separate overlapping labels by pushing the later one down (then re-clamping).
function deOverlapLabels(labels: VLabel[], issues: LayoutIssue[], sceneId: string): void {
  for (let i = 1; i < labels.length; i++) {
    for (let j = 0; j < i; j++) {
      const ri = labelRect(labels[i]);
      const rj = labelRect(labels[j]);
      if (overlaps(ri, rj)) {
        const shift = rj.y + rj.h + GAP - ri.y;
        labels[i].y += Math.max(GAP, shift);
        if (labels[i].y > CANVAS_H - PAD) labels[i].y = CANVAS_H - PAD;
        issues.push({ scene: sceneId, kind: "overlap", what: `label "${labels[i].text.slice(0, 20)}"` });
      }
    }
  }
}

/**
 * Validate + auto-correct scene geometry so nothing overflows the canvas or
 * collides. Mutates the scenes in place; returns the issues it fixed.
 */
export function fixSceneLayout(scenes: Scene[]): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  for (const s of scenes) {
    for (const o of s.objects ?? []) clampObject(o, issues, s.id);
    if (s.labels?.length) {
      for (const l of s.labels) clampLabel(l, issues, s.id);
      deOverlapLabels(s.labels, issues, s.id);
    }
  }
  return issues;
}
