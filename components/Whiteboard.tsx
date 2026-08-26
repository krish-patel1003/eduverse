"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A scratchpad the learner can write working on, with a pen, an eraser, undo and
// clear. Handwriting matters here: for a multi step problem, showing the working
// IS the skill, and typing it into a text box is a worse test of that than
// simply writing it the way they would on paper.
//
// Strokes are kept as points rather than pixels so undo is cheap and the canvas
// can be redrawn crisply at any device pixel ratio.

interface Point {
  x: number;
  y: number;
}
interface Stroke {
  points: Point[];
  /** Eraser strokes paint the background colour over what is beneath. */
  erase: boolean;
  width: number;
}

const PEN_WIDTH = 3;
const ERASER_WIDTH = 24;
const INK = "#1c2431";
const PAPER = "#fdfdfa";

interface Props {
  /** Called whenever the drawing changes; null once it is empty again. */
  onChange?: (dataUrl: string | null) => void;
  /** Aspect ratio height as a fraction of width. */
  ratio?: number;
  /** Hard cap in px, so a wide screen does not produce an enormous pad. */
  maxHeight?: number;
  label?: string;
}

export default function Whiteboard({ onChange, ratio = 0.5, maxHeight = 320, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [hasInk, setHasInk] = useState(false);

  // Draw everything at device resolution so strokes stay sharp.
  const redraw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.width / dpr;
    const h = cv.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);

    // Faint ruled lines: a blank white box invites nothing, ruled paper invites working.
    ctx.strokeStyle = "rgba(28,36,49,0.08)";
    ctx.lineWidth = 1;
    for (let y = 36; y < h; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = drawingRef.current ? [...strokesRef.current, drawingRef.current] : strokesRef.current;
    for (const s of all) {
      if (s.points.length < 2) {
        // A single tap should still leave a dot.
        const p = s.points[0];
        if (!p) continue;
        ctx.fillStyle = s.erase ? PAPER : INK;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s.width / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.strokeStyle = s.erase ? PAPER : INK;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    }
  }, []);

  const resize = useCallback(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    // Cap the height: a full-width pad at a fixed ratio becomes absurdly tall on
    // a desktop and pushes the actual question off screen.
    const h = Math.min(Math.round(w * ratio), maxHeight);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    redraw();
  }, [ratio, maxHeight, redraw]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [resize]);

  const emit = useCallback(() => {
    const ink = strokesRef.current.some((s) => !s.erase);
    setHasInk(ink);
    if (!onChange) return;
    if (!ink) {
      onChange(null);
      return;
    }
    // JPEG on an off-white ground keeps the payload small; this is going into a
    // grading prompt, not an art gallery.
    onChange(canvasRef.current?.toDataURL("image/jpeg", 0.7) ?? null);
  }, [onChange]);

  function pos(e: React.PointerEvent): Point {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function down(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = {
      points: [pos(e)],
      erase: tool === "eraser",
      width: tool === "eraser" ? ERASER_WIDTH : PEN_WIDTH,
    };
    redraw();
  }

  function move(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    e.preventDefault();
    drawingRef.current.points.push(pos(e));
    redraw();
  }

  function up() {
    if (!drawingRef.current) return;
    strokesRef.current = [...strokesRef.current, drawingRef.current];
    drawingRef.current = null;
    redraw();
    emit();
  }

  function undo() {
    strokesRef.current = strokesRef.current.slice(0, -1);
    redraw();
    emit();
  }

  function clear() {
    strokesRef.current = [];
    drawingRef.current = null;
    redraw();
    emit();
  }

  return (
    <div className="wb">
      <div className="wb-bar">
        <span className="wb-label">{label ?? "Scratchpad"}</span>
        <div className="wb-tools">
          <button
            type="button"
            className={`wb-tool ${tool === "pen" ? "on" : ""}`}
            onClick={() => setTool("pen")}
            title="Pen"
          >
            ✏️
          </button>
          <button
            type="button"
            className={`wb-tool ${tool === "eraser" ? "on" : ""}`}
            onClick={() => setTool("eraser")}
            title="Eraser"
          >
            🧽
          </button>
          <button type="button" className="wb-tool" onClick={undo} disabled={!hasInk} title="Undo">
            ↺
          </button>
          <button type="button" className="wb-tool" onClick={clear} disabled={!hasInk} title="Clear">
            ✕
          </button>
        </div>
      </div>
      <div className="wb-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="wb-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
      </div>
    </div>
  );
}
