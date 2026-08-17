"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Element, Entrance, Explainer, Quiz, Scene } from "@/lib/types";
import { CANVAS_H, CANVAS_W } from "@/lib/types";
import { ICONS } from "@/lib/icons";

// A recorded attempt, for the end-of-video review.
interface QuizResult {
  quiz: Quiz;
  /** What the learner picked on their FIRST submission. */
  firstSelection: string[];
  /** How many submissions it took. */
  tries: number;
  /** Correct on the first try? */
  firstTryCorrect: boolean;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

// ---- generated-image scene (new engine) -----------------------------------

function ease(p: number): number {
  return p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.pow(1 - p, 3);
}
function clamp01(p: number): number {
  return Math.max(0, Math.min(1, p));
}

function entranceStyle(entrance: Entrance, p: number): CSSProperties {
  const e = ease(p);
  switch (entrance) {
    case "fade":
      return { opacity: e };
    case "grow":
      return { opacity: 1, transform: `scale(${e})` };
    case "slideL":
      return { opacity: e, transform: `translateX(${(1 - e) * -28}%)` };
    case "slideR":
      return { opacity: e, transform: `translateX(${(1 - e) * 28}%)` };
    case "slideU":
      return { opacity: e, transform: `translateY(${(1 - e) * -28}%)` };
    case "slideD":
      return { opacity: e, transform: `translateY(${(1 - e) * 28}%)` };
    case "draw":
      return { opacity: 1, clipPath: `inset(0 ${(1 - e) * 100}% 0 0)` };
    case "pop":
    default:
      return { opacity: Math.min(1, p * 2), transform: `scale(${0.6 + 0.4 * e})` };
  }
}

type Box = { x: number; y: number; w: number; h: number };

function connectorPath(a: Box, b: Box, curve: number): string {
  const ax0 = a.x + a.w / 2;
  const ay0 = a.y + a.h / 2;
  const bx0 = b.x + b.w / 2;
  const by0 = b.y + b.h / 2;
  const dx = bx0 - ax0;
  const dy = by0 - ay0;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const offA = (Math.min(a.w, a.h) / 2) * 0.85;
  const offB = (Math.min(b.w, b.h) / 2) * 0.85;
  const ax = ax0 + ux * offA;
  const ay = ay0 + uy * offA;
  const bx = bx0 - ux * offB;
  const by = by0 - uy * offB;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const cx = mx - uy * curve * dist * 0.3;
  const cy = my + ux * curve * dist * 0.3;
  let d = `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
  const ta = Math.atan2(by - cy, bx - cx);
  const h = 13;
  d += ` M ${bx} ${by} L ${bx - h * Math.cos(ta - 0.45)} ${by - h * Math.sin(ta - 0.45)}`;
  d += ` M ${bx} ${by} L ${bx - h * Math.cos(ta + 0.45)} ${by - h * Math.sin(ta + 0.45)}`;
  return d;
}

function AnimPath({ d, color, width, progress }: { d: string; color: string; width: number; progress: number }) {
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (ref.current) {
      try {
        setLen(ref.current.getTotalLength());
      } catch {
        setLen(0);
      }
    }
  }, [d]);
  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={len || undefined}
      strokeDashoffset={len ? len * (1 - clamp01(progress)) : undefined}
    />
  );
}

function ObjectScene({ scene, progress }: { scene: Scene; progress: number }) {
  const objects = scene.objects ?? [];
  const connectors = scene.connectors ?? [];
  const labels = scene.labels ?? [];
  const n = Math.max(1, objects.length);
  const kb = 1 + 0.03 * ease(progress);
  const boxes: Record<string, Box> = {};
  objects.forEach((o) => (boxes[o.id] = { x: o.x, y: o.y, w: o.w, h: o.h }));

  return (
    <div className="stage-scene" style={{ transform: `scale(${kb})` }}>
      <div className="obj-layer">
        {objects.map((o, i) => {
          const local = clamp01((progress - i * (0.5 / n)) / 0.45);
          const pos: CSSProperties = {
            left: `${(o.x / CANVAS_W) * 100}%`,
            top: `${(o.y / CANVAS_H) * 100}%`,
            width: `${(o.w / CANVAS_W) * 100}%`,
            height: `${(o.h / CANVAS_H) * 100}%`,
          };
          if (!o.imageUrl) {
            return <div key={o.id} className="obj-missing" style={{ ...pos, opacity: ease(local) * 0.5 }} />;
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={o.id}
              src={o.imageUrl}
              alt=""
              className="obj-img"
              style={{ ...pos, ...entranceStyle(o.entrance, local) }}
            />
          );
        })}
      </div>
      <svg className="obj-overlay" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
        {connectors.map((c, k) => {
          const a = c.from ? boxes[c.from] : undefined;
          const b = c.to ? boxes[c.to] : undefined;
          if (!a || !b) return null;
          const local = clamp01((progress - (0.5 + k * 0.08)) / 0.35);
          const color = c.color || "#6ea8fe";
          const midx = (a.x + a.w / 2 + b.x + b.w / 2) / 2;
          const midy = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
          return (
            <g key={k}>
              <AnimPath d={connectorPath(a, b, c.curve ?? 0.2)} color={color} width={3} progress={local} />
              {c.label && local > 0.55 && (
                <text
                  x={midx}
                  y={midy - 6}
                  textAnchor="middle"
                  fontSize={16}
                  fill={color}
                  opacity={clamp01((local - 0.55) / 0.45)}
                  style={{ fontFamily: "'Caveat','Comic Sans MS',cursive" }}
                >
                  {c.label}
                </text>
              )}
            </g>
          );
        })}
        {labels.map((l, k) => {
          const local = clamp01((progress - (0.45 + k * 0.05)) / 0.4);
          return (
            <text
              key={k}
              x={l.x}
              y={l.y}
              fontSize={l.size ?? 20}
              fontWeight={l.weight === "bold" ? 700 : 400}
              fill={l.color || "#1c2431"}
              opacity={ease(local)}
              style={{ fontFamily: "'Caveat','Comic Sans MS',cursive" }}
            >
              {l.text}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export interface PlayerHandle {
  seekTo: (ms: number) => void;
  getCurrentMs: () => number;
}

interface Props {
  explainer: Explainer;
  onTimeUpdate?: (ms: number) => void;
  onReExplain?: (focusNarration: string) => void;
}

// ---- timing ----------------------------------------------------------------

function estimateMs(scene: Scene): number {
  const words = (scene.narration ?? "").trim().split(/\s+/).filter(Boolean).length;
  const speechSec = Math.max(3.5, words / 2.6);
  const items =
    scene.elements?.length ?? scene.objects?.length ?? scene.beats?.length ?? 3;
  const drawSec = Math.max(2, items * 0.7);
  return Math.round(Math.max(speechSec, drawSec) * 1000);
}
function sceneDurationMs(scene: Scene): number {
  return scene.durationMs && scene.durationMs > 500 ? scene.durationMs : estimateMs(scene);
}
function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g);
  return parts && parts.length ? parts.map((s) => s.trim()).filter(Boolean) : [text];
}

// ---- element -> path -------------------------------------------------------

function toPathD(el: Exclude<Element, { kind: "text" | "icon" }>): string {
  switch (el.kind) {
    case "line":
    case "arrow": {
      let d = `M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`;
      if (el.kind === "arrow") {
        const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
        const h = 12;
        const a1 = ang + Math.PI - 0.4;
        const a2 = ang + Math.PI + 0.4;
        d += ` M ${el.x2} ${el.y2} L ${el.x2 + h * Math.cos(a1)} ${el.y2 + h * Math.sin(a1)}`;
        d += ` M ${el.x2} ${el.y2} L ${el.x2 + h * Math.cos(a2)} ${el.y2 + h * Math.sin(a2)}`;
      }
      return d;
    }
    case "rect":
      return `M ${el.x} ${el.y} L ${el.x + el.w} ${el.y} L ${el.x + el.w} ${el.y + el.h} L ${el.x} ${el.y + el.h} Z`;
    case "circle": {
      const { cx, cy, r } = el;
      return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
    }
    case "path":
      return el.d;
  }
}

function StrokeEl({ d, progress }: { d: string; progress: number }) {
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (ref.current) {
      try {
        setLen(ref.current.getTotalLength());
      } catch {
        setLen(0);
      }
    }
  }, [d]);
  const offset = len * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke="#1c2431"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      strokeDasharray={len || undefined}
      strokeDashoffset={len ? offset : undefined}
      style={{ filter: "url(#sketch)" }}
    />
  );
}

function IconEl({ name, x, y, size, progress }: { name: string; x: number; y: number; size: number; progress: number }) {
  const paths = ICONS[name] ?? [];
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 100})`}>
      {paths.map((d, i) => (
        <StrokeEl key={i} d={d} progress={progress} />
      ))}
    </g>
  );
}

function SceneView({ scene, progress }: { scene: Scene; progress: number }) {
  const els = scene.elements ?? [];
  const n = Math.max(1, els.length);
  return (
    <>
      {els.map((el, i) => {
        const start = i / n;
        const local = Math.max(0, Math.min(1, (progress - start) * n));
        if (el.kind === "text") {
          return (
            <text
              key={i}
              x={el.x}
              y={el.y}
              fontSize={el.size ?? 22}
              fontWeight={el.weight === "bold" ? 700 : 400}
              fill="#1c2431"
              opacity={Math.min(1, local * 1.6)}
              style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
            >
              {el.text}
            </text>
          );
        }
        if (el.kind === "icon") {
          return <IconEl key={i} name={el.name} x={el.x} y={el.y} size={el.size} progress={local} />;
        }
        return <StrokeEl key={i} d={toPathD(el)} progress={local} />;
      })}
    </>
  );
}

// ---- Strategy A: coherent image + beat-synced spotlight reveal -------------

/**
 * Hi-fi scene: an ordered stack of build-up frames of the SAME canvas, each the
 * previous plus one drawn layer. We show frame N and reveal frame N+1 over it
 * with a soft top-to-bottom sweep. Because the two frames are identical except
 * for the new ink, only the NEW strokes appear, exactly as if they were being
 * drawn on. Each layer draws, then holds, before the next begins.
 */
function SceneKeyframes({ scene, progress }: { scene: Scene; progress: number }) {
  const frames = scene.keyframes ?? [];
  if (frames.length === 0) return null;
  if (frames.length === 1) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="kf-img" src={frames[0]} alt="" />;
  }

  const steps = frames.length - 1;
  const seg = Math.max(0, Math.min(steps, progress * steps));
  const i = Math.min(steps - 1, Math.floor(seg));
  const t = seg - i;
  // Draw over the first 72% of each step, then hold so the eye can catch up.
  const drawT = Math.max(0, Math.min(1, t / 0.72));
  // Leading edge sweeps past both ends so strokes at the very top/bottom land.
  const edge = drawT * 118 - 9;

  return (
    <div className="kf-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="kf-img" src={frames[i]} alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="kf-img kf-top"
        src={frames[i + 1]}
        alt=""
        style={{
          WebkitMaskImage: `linear-gradient(to bottom, #000 ${edge - 7}%, rgba(0,0,0,0) ${edge + 7}%)`,
          maskImage: `linear-gradient(to bottom, #000 ${edge - 7}%, rgba(0,0,0,0) ${edge + 7}%)`,
        }}
      />
    </div>
  );
}

function SceneA({ scene, beatIdx }: { scene: Scene; beatIdx: number }) {
  const beats = scene.beats ?? [];
  const parts = scene.parts ?? [];
  const beat = beats[beatIdx];
  const target = beat?.target ? parts.find((p) => p.name === beat.target) : undefined;
  const spotlight = !!target && !!beat && beat.op !== "intro";
  const zoom = !!target && beat?.op === "zoom";
  const cut = spotlight && target
    ? { x: target.x - 10, y: target.y - 10, w: target.w + 20, h: target.h + 20 }
    : { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
  const ox = target ? ((target.x + target.w / 2) / CANVAS_W) * 100 : 50;
  const oy = target ? ((target.y + target.h / 2) / CANVAS_H) * 100 : 50;
  const maskId = `spot-${scene.id}`;
  const calloutText = spotlight && (beat?.label || beat?.op === "annotate") ? beat!.label || beat!.target : null;

  return (
    <div className="stage-a">
      <div
        className="a-zoom"
        style={{ transform: `scale(${zoom ? 1.28 : 1})`, transformOrigin: `${ox}% ${oy}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="scene-a-img" src={scene.sceneImageUrl} alt="" />
        <svg className="a-overlay" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="white" />
              <rect className="a-cut" x={cut.x} y={cut.y} width={cut.w} height={cut.h} rx="16" fill="black" />
            </mask>
          </defs>
          <rect
            className="a-scrim"
            x="0"
            y="0"
            width={CANVAS_W}
            height={CANVAS_H}
            fill="#0b0e18"
            mask={`url(#${maskId})`}
            style={{ opacity: spotlight ? 0.5 : 0 }}
          />
          <rect
            className="a-glow"
            x={cut.x}
            y={cut.y}
            width={cut.w}
            height={cut.h}
            rx="16"
            fill="none"
            stroke="#6ea8fe"
            strokeWidth="3"
            style={{ opacity: spotlight ? 1 : 0 }}
          />
        </svg>
      </div>
      {calloutText && target && (() => {
        // Keep the callout pill on-canvas: anchor to the target's right edge when
        // it sits in the right portion, and drop it below the target near the top.
        const nearRight = target.x + target.w / 2 > CANVAS_W * 0.6;
        const nearTop = target.y < CANVAS_H * 0.14;
        const horiz = nearRight
          ? { right: `${(1 - (target.x + target.w) / CANVAS_W) * 100}%` }
          : { left: `${(target.x / CANVAS_W) * 100}%` };
        const top = nearTop ? target.y + target.h + 4 : Math.max(2, target.y - 4);
        return (
          <div
            className={`a-callout ${nearTop ? "below" : ""}`}
            style={{ ...horiz, top: `${(top / CANVAS_H) * 100}%` }}
          >
            {calloutText}
          </div>
        );
      })()}
    </div>
  );
}

// ---- interactive quiz ------------------------------------------------------

interface QuizCardProps {
  quiz: Quiz;
  index: number;
  count: number;
  onPass: (result: { firstSelection: string[]; tries: number; firstTryCorrect: boolean }) => void;
  /** Dismiss the checkpoint and keep watching without answering. */
  onSkip: () => void;
}

/**
 * Checkpoint card that pops when playback naturally reaches it. It is NOT a hard
 * gate: the learner can answer, or skip (or just scrub past it on the timeline).
 */
function QuizCard({ quiz, index, count, onPass, onSkip }: QuizCardProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [outcome, setOutcome] = useState<"correct" | "wrong" | null>(null);
  const [tries, setTries] = useState(0);
  const firstSelection = useRef<string[] | null>(null);
  const firstTryCorrect = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // reset when a new quiz mounts
  useEffect(() => {
    setSelected([]);
    setSubmitted(false);
    setOutcome(null);
    setTries(0);
    firstSelection.current = null;
    firstTryCorrect.current = false;
  }, [quiz.id]);

  // after answering, bring the verdict + explanation into view
  useEffect(() => {
    if (submitted && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [submitted]);

  function toggle(id: string) {
    if (submitted) return; // locked while showing a result
    setSelected((sel) => {
      if (quiz.multi) return sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
      return [id];
    });
  }

  function submit() {
    if (selected.length === 0) return;
    const correct = sameSet(selected, quiz.correct);
    const n = tries + 1;
    setTries(n);
    if (n === 1) {
      firstSelection.current = selected;
      firstTryCorrect.current = correct;
    }
    setOutcome(correct ? "correct" : "wrong");
    setSubmitted(true);
  }

  function retry() {
    setSubmitted(false);
    setOutcome(null);
    setSelected([]);
  }

  function cont() {
    onPass({
      firstSelection: firstSelection.current ?? selected,
      tries,
      firstTryCorrect: firstTryCorrect.current,
    });
  }

  const isCorrect = (id: string) => quiz.correct.includes(id);
  const showResult = submitted;

  return (
    <div className="quiz-takeover">
      <div className="quiz-card">
        <div className="quiz-scroll" ref={scrollRef}>
          <div className="quiz-head">
            <span className="quiz-badge">Checkpoint {index + 1} / {count}</span>
            <span className="quiz-kind">{quiz.multi ? "Select all that apply" : "Choose one"}</span>
          </div>
          <div className="quiz-q">{quiz.question}</div>

          <div className="quiz-options">
            {quiz.options.map((o) => {
              const picked = selected.includes(o.id);
              let cls = "quiz-opt";
              if (picked && !showResult) cls += " picked";
              if (showResult && isCorrect(o.id)) cls += " correct";
              if (showResult && picked && !isCorrect(o.id)) cls += " wrong";
              return (
                <button key={o.id} className={cls} onClick={() => toggle(o.id)} disabled={showResult}>
                  <span className="quiz-mark">
                    {showResult && isCorrect(o.id) ? "✓" : showResult && picked ? "✕" : picked ? "●" : ""}
                  </span>
                  <span>{o.text}</span>
                </button>
              );
            })}
          </div>

          {showResult && (
            <div className={`quiz-result ${outcome}`}>
              <div className="quiz-verdict">
                {outcome === "correct" ? "✓ Correct" : "✕ Not quite"}
              </div>
              <div className="quiz-explain">{quiz.explanation}</div>
            </div>
          )}
        </div>

        <div className="quiz-foot">
          {!showResult && (
            <>
              <button className="quiz-skip" onClick={onSkip}>Skip for now</button>
              <button className="quiz-submit" onClick={submit} disabled={selected.length === 0}>
                Submit answer
              </button>
            </>
          )}
          {showResult && outcome === "correct" && (
            <button className="quiz-continue" onClick={cont}>Continue →</button>
          )}
          {showResult && outcome === "wrong" && (
            <>
              <button className="quiz-skip" onClick={onSkip}>Skip</button>
              <button className="quiz-retry" onClick={retry}>↻ Try again</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QuizReview({ results, onClose }: { results: QuizResult[]; onClose: () => void }) {
  const right = results.filter((r) => r.firstTryCorrect).length;
  return (
    <div className="quiz-review">
      <div className="qr-head">
        <div>
          <div className="qr-title">Quiz review</div>
          <div className="qr-score">
            {right} / {results.length} correct on the first try
          </div>
        </div>
        <button className="mini" onClick={onClose}>✕ Close</button>
      </div>
      <div className="qr-list">
        {results.map((r, i) => {
          const opt = (id: string) => r.quiz.options.find((o) => o.id === id)?.text ?? id;
          return (
            <div key={r.quiz.id} className="qr-item">
              <div className="qr-q">
                <span className="qr-n">{i + 1}.</span> {r.quiz.question}
              </div>
              <div className={`qr-line ${r.firstTryCorrect ? "ok" : "no"}`}>
                Your answer: {r.firstSelection.map(opt).join(", ") || "—"}
                {r.firstTryCorrect ? " ✓" : ` ✕ (took ${r.tries} tr${r.tries === 1 ? "y" : "ies"})`}
              </div>
              {!r.firstTryCorrect && (
                <div className="qr-line ok">Correct answer: {r.quiz.correct.map(opt).join(", ")}</div>
              )}
              <div className="qr-explain">{r.quiz.explanation}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- player ----------------------------------------------------------------

const ExplainerPlayer = forwardRef<PlayerHandle, Props>(function ExplainerPlayer(
  { explainer, onTimeUpdate, onReExplain },
  ref
) {
  const durations = useMemo(() => explainer.scenes.map(sceneDurationMs), [explainer]);
  const starts = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const d of durations) {
      out.push(acc);
      acc += d;
    }
    return out;
  }, [durations]);
  const total = useMemo(() => durations.reduce((a, b) => a + b, 0), [durations]);

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);

  const [showTranscript, setShowTranscript] = useState(false);
  const [clipMode, setClipMode] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);

  // interactive-mode checkpoints
  const quizzes = useMemo(
    () =>
      (explainer.quizzes ?? [])
        .filter((q) => q.afterScene >= 0 && q.afterScene < explainer.scenes.length)
        .sort((a, b) => a.afterScene - b.afterScene),
    [explainer.quizzes, explainer.scenes.length]
  );
  const interactive = explainer.style === "interactive" && quizzes.length > 0;
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [passedIds, setPassedIds] = useState<string[]>([]);
  // Checkpoints the learner chose to skip (or scrubbed past). They no longer
  // gate playback and never auto-pop, but stay reachable via timeline markers.
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  // Scene index whose natural end just gated playback and should pop its quiz.
  const [gateScene, setGateScene] = useState<number | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [showReview, setShowReview] = useState(false);

  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const spokenScene = useRef<number>(-1);
  const elapsedRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const curAudioScene = useRef<number>(-1);
  const playingRef = useRef(false);
  const clipStartRef = useRef(0);
  const clipEndRef = useRef(0);
  const clipTrackRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<null | "start" | "end">(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  elapsedRef.current = elapsed;
  playingRef.current = playing;
  clipStartRef.current = clipStart;
  clipEndRef.current = clipEnd;

  // Fresh views of quiz state for the audio/rAF event closures.
  const quizzesRef = useRef(quizzes);
  const passedRef = useRef(passedIds);
  const skippedRef = useRef(skippedIds);
  const activeQuizRef = useRef<Quiz | null>(activeQuiz);
  quizzesRef.current = quizzes;
  passedRef.current = passedIds;
  skippedRef.current = skippedIds;
  activeQuizRef.current = activeQuiz;
  // True when scene `idx` ends on a checkpoint the learner hasn't passed OR
  // skipped → natural playback pauses there to pop the question. Skipping (or
  // scrubbing past) a checkpoint clears the gate so it won't stop playback again.
  const isGatedAfter = useCallback(
    (idx: number) =>
      quizzesRef.current.some(
        (q) => q.afterScene === idx && !passedRef.current.includes(q.id) && !skippedRef.current.includes(q.id)
      ),
    []
  );

  const voiceOk = typeof window !== "undefined" && "speechSynthesis" in window;
  const hasAudio = explainer.scenes.some((s) => !!s.audioUrl);

  // Registry of unique (source, page) citations → [n] markers for the transcript.
  const citeReg = useMemo(() => {
    const key = (c: { source: string; page?: number }) => `${c.source}|${c.page ?? ""}`;
    const index = new Map<string, number>();
    const list: { source: string; page?: number }[] = [];
    for (const s of explainer.scenes) {
      for (const c of s.citations ?? []) {
        const k = key(c);
        if (!index.has(k)) {
          index.set(k, list.length + 1);
          list.push(c);
        }
      }
    }
    const urlByName = new Map((explainer.sources ?? []).map((s) => [s.name, s.url]));
    const href = (c: { source: string; page?: number }) => {
      const u = urlByName.get(c.source);
      return u ? `${u}${c.page ? `#page=${c.page}` : ""}` : undefined;
    };
    return { key, index, list, href };
  }, [explainer]);

  const sceneIndexFor = useCallback(
    (ms: number) => {
      let i = starts.findIndex((s, idx) => ms < s + durations[idx]);
      if (i === -1) i = explainer.scenes.length - 1;
      return Math.max(0, i);
    },
    [starts, durations, explainer.scenes.length]
  );

  const sceneIndex = sceneIndexFor(elapsed);
  const sStart = starts[sceneIndex] ?? 0;
  const sDur = durations[sceneIndex] ?? 1;
  const sceneProgress = Math.max(0, Math.min(1, (elapsed - sStart) / sDur));

  // which sentence in the current scene is "active" (for follow-along highlight)
  const activeSentence = useMemo(() => {
    const scene = explainer.scenes[sceneIndex];
    if (!scene) return 0;
    const sents = splitSentences(scene.narration);
    const lens = sents.map((s) => s.length || 1);
    const totalLen = lens.reduce((a, b) => a + b, 0) || 1;
    const target = sceneProgress * totalLen;
    let acc = 0;
    for (let i = 0; i < sents.length; i++) {
      if (target < acc + lens[i]) return i;
      acc += lens[i];
    }
    return sents.length - 1;
  }, [explainer.scenes, sceneIndex, sceneProgress]);

  // word-by-word follow-along for the caption
  const captionWords = useMemo(() => {
    const text = explainer.scenes[sceneIndex]?.narration ?? "";
    const parts = text.split(/\s+/).filter(Boolean);
    const lens = parts.map((w) => w.length + 1);
    const totalLen = lens.reduce((a, b) => a + b, 0) || 1;
    const cum: number[] = [];
    let acc = 0;
    for (const l of lens) {
      cum.push(acc);
      acc += l;
    }
    return { parts, cum, totalLen };
  }, [explainer.scenes, sceneIndex]);

  const activeWord = useMemo(() => {
    const { parts, cum, totalLen } = captionWords;
    if (!parts.length) return -1;
    const target = sceneProgress * totalLen;
    let idx = 0;
    for (let i = 0; i < parts.length; i++) {
      if (target >= cum[i]) idx = i;
      else break;
    }
    return idx;
  }, [captionWords, sceneProgress]);

  const pauseNarration = useCallback(() => {
    if (voiceOk) window.speechSynthesis.cancel();
    const a = audioRef.current;
    if (a) {
      a.oncanplay = null; // cancel any pending play scheduled on load
      a.pause();
    }
  }, [voiceOk]);

  const startNarration = useCallback(
    (idx: number, offsetMs: number) => {
      const sc = explainer.scenes[idx];
      if (voiceOk) window.speechSynthesis.cancel();
      const a = audioRef.current;
      if (sc?.audioUrl && a) {
        const play = () => {
          try {
            a.currentTime = Math.max(0, offsetMs / 1000);
          } catch {
            /* ignore */
          }
          a.playbackRate = speed;
          a.muted = muted;
          a.play().catch(() => {});
        };
        if (curAudioScene.current !== idx) {
          curAudioScene.current = idx;
          a.src = sc.audioUrl;
          a.oncanplay = () => {
            a.oncanplay = null;
            play();
          };
          a.load();
        } else {
          play();
        }
      } else if (voiceOk && !muted && sc?.narration) {
        const u = new SpeechSynthesisUtterance(sc.narration);
        u.rate = speed;
        window.speechSynthesis.speak(u);
      }
    },
    [explainer.scenes, speed, muted, voiceOk]
  );

  useEffect(() => {
    if (!playing) return;
    const scenes = explainer.scenes;
    const tick = (ts: number) => {
      const idx = spokenScene.current;
      const sc = scenes[idx];
      const a = audioRef.current;
      const audioIsClock =
        idx >= 0 && !!sc?.audioUrl && !!a && curAudioScene.current === idx && a.readyState >= 1;
      if (audioIsClock && a) {
        lastTs.current = null;
        const dur = a.duration && isFinite(a.duration) ? a.duration : (durations[idx] ?? 1) / 1000;
        if (a.ended || a.currentTime >= dur - 0.03) {
          if (isGatedAfter(idx)) {
            setElapsed(Math.max(0, (starts[idx + 1] ?? total) - 1));
            setPlaying(false);
            setGateScene(idx);
          } else if (idx + 1 < scenes.length) setElapsed(starts[idx + 1] ?? total);
          else {
            setElapsed(total);
            setPlaying(false);
          }
        } else {
          setElapsed((starts[idx] ?? 0) + a.currentTime * 1000);
        }
      } else {
        if (lastTs.current == null) lastTs.current = ts;
        const dt = (ts - lastTs.current) * speed;
        lastTs.current = ts;
        setElapsed((prev) => {
          const next = Math.min(total, prev + dt);
          if (next >= total) setPlaying(false);
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTs.current = null;
    };
  }, [playing, speed, total, starts, durations, explainer.scenes]);

  useEffect(() => {
    if (!playing) pauseNarration();
  }, [playing, pauseNarration]);

  // audio events keep the clock moving even if rAF throttles
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTimeUpdate = () => {
      const idx = spokenScene.current;
      if (playingRef.current && curAudioScene.current === idx && idx >= 0) {
        setElapsed((starts[idx] ?? 0) + a.currentTime * 1000);
      }
    };
    const onEnded = () => {
      if (!playingRef.current) return;
      const idx = spokenScene.current;
      if (isGatedAfter(idx)) {
        setElapsed(Math.max(0, (starts[idx + 1] ?? total) - 1));
        setPlaying(false);
        setGateScene(idx);
      } else if (idx + 1 < explainer.scenes.length) setElapsed(starts[idx + 1] ?? total);
      else {
        setElapsed(total);
        setPlaying(false);
      }
    };
    a.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTimeUpdate);
      a.removeEventListener("ended", onEnded);
    };
  }, [starts, total, explainer.scenes]);

  useEffect(() => {
    if (playing && spokenScene.current !== sceneIndex) {
      spokenScene.current = sceneIndex;
      startNarration(sceneIndex, elapsedRef.current - (starts[sceneIndex] ?? 0));
    }
  }, [playing, sceneIndex, startNarration, starts]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
    if (muted && voiceOk) window.speechSynthesis.cancel();
  }, [muted, voiceOk]);
  useEffect(() => {
    onTimeUpdate?.(elapsed);
  }, [elapsed, onTimeUpdate]);

  // Pop a checkpoint ONLY when natural playback has just gated at its scene end
  // (signalled by setGateScene from the rAF/audio stop). Seeking never sets
  // gateScene, so scrubbing ahead past checkpoints does not force them, and the
  // learner is not made to answer questions they skipped over.
  useEffect(() => {
    if (gateScene == null) return;
    if (!interactive || activeQuiz) {
      setGateScene(null);
      return;
    }
    const q = quizzes.find(
      (x) => x.afterScene === gateScene && !passedIds.includes(x.id) && !skippedIds.includes(x.id)
    );
    if (q) {
      pauseNarration();
      spokenScene.current = gateScene;
      setActiveQuiz(q);
    }
    setGateScene(null);
  }, [gateScene, interactive, activeQuiz, quizzes, passedIds, skippedIds, pauseNarration]);

  const passQuiz = useCallback(
    (res: { firstSelection: string[]; tries: number; firstTryCorrect: boolean }) => {
      const q = activeQuiz;
      if (!q) return;
      setResults((prev) =>
        prev.some((r) => r.quiz.id === q.id)
          ? prev
          : [...prev, { quiz: q, ...res }]
      );
      setPassedIds((p) => (p.includes(q.id) ? p : [...p, q.id]));
      setSkippedIds((s) => s.filter((id) => id !== q.id));
      setActiveQuiz(null);
      const k = q.afterScene;
      if (k + 1 < explainer.scenes.length) {
        spokenScene.current = -1;
        setElapsed(starts[k + 1] ?? 0);
        setPlaying(true);
      } else {
        setElapsed(total);
        setPlaying(false);
      }
    },
    [activeQuiz, explainer.scenes.length, starts, total]
  );

  // keep the active transcript line in view
  useEffect(() => {
    if (showTranscript) activeLineRef.current?.scrollIntoView({ block: "nearest" });
  }, [sceneIndex, showTranscript]);

  // reset for a new explainer
  useEffect(() => {
    setElapsed(0);
    setPlaying(false);
    setClipMode(false);
    setActiveQuiz(null);
    setPassedIds([]);
    setSkippedIds([]);
    setGateScene(null);
    setResults([]);
    setShowReview(false);
    spokenScene.current = -1;
    curAudioScene.current = -1;
    if (voiceOk) window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
    }
  }, [explainer.id, voiceOk]);

  const positionTo = useCallback(
    (ms: number, shouldPlay: boolean) => {
      // Seeking never forces a checkpoint: if one is popped, dismiss it and mark
      // it skipped so it won't gate playback (it stays reachable via its marker).
      const aq = activeQuizRef.current;
      if (aq) {
        setSkippedIds((s) => (s.includes(aq.id) ? s : [...s, aq.id]));
        setActiveQuiz(null);
      }
      setGateScene(null);
      const clamped = Math.max(0, Math.min(total, ms));
      setElapsed(clamped);
      const idx = sceneIndexFor(clamped);
      spokenScene.current = idx;
      pauseNarration();
      if (shouldPlay) startNarration(idx, clamped - (starts[idx] ?? 0));
    },
    [total, sceneIndexFor, pauseNarration, startNarration, starts]
  );

  // Dismiss the popped checkpoint without answering and continue watching.
  const skipActiveQuiz = useCallback(() => {
    const aq = activeQuizRef.current;
    if (!aq) return;
    setSkippedIds((s) => (s.includes(aq.id) ? s : [...s, aq.id]));
    setActiveQuiz(null);
    setGateScene(null);
    spokenScene.current = -1;
    setPlaying(true);
  }, []);

  // Jump to a checkpoint from its timeline marker and open its question.
  const jumpToQuiz = useCallback(
    (q: Quiz) => {
      const b = (starts[q.afterScene] ?? 0) + (durations[q.afterScene] ?? 0);
      setPlaying(false);
      pauseNarration();
      setGateScene(null);
      setElapsed(Math.max(0, b - 1));
      spokenScene.current = q.afterScene;
      setActiveQuiz(q);
    },
    [starts, durations, pauseNarration]
  );

  useImperativeHandle(ref, () => ({
    seekTo: (ms: number) => positionTo(ms, playing),
    getCurrentMs: () => elapsedRef.current,
  }));

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
            (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
        )
      );
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  function toggleFullscreen() {
    const el = rootRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => void })
      | null;
    const doc = document as unknown as {
      fullscreenElement?: Element;
      webkitFullscreenElement?: Element;
      exitFullscreen?: () => void;
      webkitExitFullscreen?: () => void;
    };
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
      (el?.requestFullscreen ?? el?.webkitRequestFullscreen)?.call(el);
    } else {
      (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
    }
  }

  function togglePlay() {
    // Pressing play with a checkpoint popped skips it (marks it skipped) and
    // keeps watching, rather than forcing an answer.
    const aq = activeQuizRef.current;
    if (aq) {
      setSkippedIds((s) => (s.includes(aq.id) ? s : [...s, aq.id]));
      setActiveQuiz(null);
      setGateScene(null);
      spokenScene.current = -1;
      setPlaying(true);
      return;
    }
    if (elapsed >= total) {
      setElapsed(0);
      spokenScene.current = -1;
    }
    setPlaying((p) => {
      const next = !p;
      if (!next) pauseNarration();
      else spokenScene.current = -1;
      return next;
    });
  }

  // YouTube-style keyboard shortcuts. Ref keeps the mounted-once listener
  // reading current handlers/state without re-subscribing every frame.
  const kbRef = useRef({ togglePlay, toggleFullscreen, positionTo, total, elapsed, activeQuiz });
  kbRef.current = { togglePlay, toggleFullscreen, positionTo, total, elapsed, activeQuiz };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = kbRef.current;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const seek = (d: number) =>
        k.positionTo(Math.max(0, Math.min(k.total, k.elapsed + d)), playingRef.current);
      const jumpTo = (frac: number) => k.positionTo(frac * k.total, playingRef.current);

      // Checkpoints no longer trap the player: play/seek shortcuts work while a
      // question is popped (they dismiss it as a skip, same as scrubbing).
      if (key === " " || key === "k") {
        e.preventDefault();
        k.togglePlay();
      } else if (key === "f") {
        e.preventDefault();
        k.toggleFullscreen();
      } else if (key === "m") {
        setMuted((m) => !m);
      } else if (key === "j") {
        e.preventDefault();
        seek(-10000);
      } else if (key === "l") {
        e.preventDefault();
        seek(10000);
      } else if (key === "ArrowLeft") {
        e.preventDefault();
        seek(-5000);
      } else if (key === "ArrowRight") {
        e.preventDefault();
        seek(5000);
      } else if (key === "Home") {
        e.preventDefault();
        jumpTo(0);
      } else if (key === "End") {
        e.preventDefault();
        jumpTo(1);
      } else if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        jumpTo(Number(key) / 10);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleClip() {
    setClipMode((v) => {
      const next = !v;
      if (next) {
        // Transcript and Clip are heavy panels; showing both stacked breaks the
        // layout, so opening one closes the other.
        setShowTranscript(false);
        const s = Math.min(elapsed, total * 0.8);
        setClipStart(s);
        setClipEnd(Math.min(total, s + Math.max(5000, total * 0.2)));
      }
      return next;
    });
  }

  function msFromClientX(clientX: number): number {
    const el = clipTrackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.round(frac * total);
  }

  function startDrag(which: "start" | "end") {
    return (e: React.PointerEvent | React.MouseEvent) => {
      e.preventDefault();
      if (draggingRef.current) return;
      draggingRef.current = which;
      const move = (ev: PointerEvent | MouseEvent) => {
        if (!draggingRef.current) return;
        const ms = msFromClientX(ev.clientX);
        if (draggingRef.current === "start") setClipStart(Math.min(ms, clipEndRef.current - 300));
        else setClipEnd(Math.max(ms, clipStartRef.current + 300));
      };
      const up = () => {
        draggingRef.current = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };
  }

  function reExplainClip() {
    if (!onReExplain) return;
    const lo = Math.min(clipStart, clipEnd);
    const hi = Math.max(clipStart, clipEnd);
    const picked = explainer.scenes
      .filter((_, i) => {
        const s = starts[i];
        const e = s + durations[i];
        return e > lo && s < hi;
      })
      .map((s) => s.narration)
      .join(" ");
    onReExplain(picked || explainer.scenes.map((s) => s.narration).join(" "));
  }

  const scene = explainer.scenes[sceneIndex];
  const sceneBeats = scene?.beats ?? [];
  const activeBeat = (() => {
    if (!sceneBeats.length) return 0;
    const lens = sceneBeats.map((b) => b.say.length || 1);
    const total = lens.reduce((a, b) => a + b, 0) || 1;
    const t = sceneProgress * total;
    let acc = 0;
    for (let i = 0; i < sceneBeats.length; i++) {
      if (t < acc + lens[i]) return i;
      acc += lens[i];
    }
    return sceneBeats.length - 1;
  })();
  const isSceneA = !!scene && scene.strategy === "A" && !!scene.sceneImageUrl;
  // Hi-fi scenes carry their own drawn build-up frames and take over the stage.
  const isKeyframes = !!scene && (scene.keyframes?.length ?? 0) > 0;
  const clipLo = Math.min(clipStart, clipEnd);
  const clipHi = Math.max(clipStart, clipEnd);
  const pct = (ms: number) => `${total ? (ms / total) * 100 : 0}%`;

  return (
    <div className={`player ${isFullscreen ? "is-fullscreen" : ""}`} ref={rootRef}>
      <audio ref={audioRef} hidden />
      <div className="stage">
        {isKeyframes ? (
          <SceneKeyframes key={scene!.id} scene={scene!} progress={sceneProgress} />
        ) : isSceneA ? (
          <SceneA key={scene!.id} scene={scene!} beatIdx={activeBeat} />
        ) : scene && scene.objects && scene.objects.length > 0 ? (
          <ObjectScene key={scene.id} scene={scene} progress={sceneProgress} />
        ) : (
          <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="canvas">
            <defs>
              <filter id="sketch">
                <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={7} result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale={2.2} />
              </filter>
            </defs>
            {scene && <SceneView key={scene.id} scene={scene} progress={sceneProgress} />}
          </svg>
        )}
        {!activeQuiz && !showReview && (
          <div className="scene-badge">
            Scene {sceneIndex + 1}/{explainer.scenes.length}
          </div>
        )}
        {activeQuiz && (
          <QuizCard
            key={activeQuiz.id}
            quiz={activeQuiz}
            index={quizzes.findIndex((q) => q.id === activeQuiz.id)}
            count={quizzes.length}
            onPass={passQuiz}
            onSkip={skipActiveQuiz}
          />
        )}
        {showReview && <QuizReview results={results} onClose={() => setShowReview(false)} />}
      </div>

      <div className="caption">
        {isSceneA
          ? sceneBeats[activeBeat]?.say ?? scene?.narration
          : captionWords.parts.length
            ? captionWords.parts.map((w, i) => (
                <span key={i} className={`cap-word ${i === activeWord ? "active" : ""}`}>
                  {w}{" "}
                </span>
              ))
            : scene?.narration}
      </div>

      <div className="timeline">
        {clipMode && (
          <div className="range" style={{ left: pct(clipLo), width: pct(clipHi - clipLo) }} />
        )}
        {starts.slice(1).map((s, i) => (
          <div key={i} className="tick" style={{ left: pct(s) }} />
        ))}
        <input
          type="range"
          min={0}
          max={total}
          step={50}
          value={elapsed}
          onChange={(e) => positionTo(Number(e.target.value), playing)}
          className="scrub"
          aria-label="Seek"
        />
        {/* Checkpoint markers: click to jump to that question. */}
        {interactive &&
          quizzes.map((q, i) => {
            const b = (starts[q.afterScene] ?? 0) + (durations[q.afterScene] ?? 0);
            const state = passedIds.includes(q.id) ? "done" : skippedIds.includes(q.id) ? "skipped" : "pending";
            return (
              <button
                key={q.id}
                type="button"
                className={`q-marker ${state} ${activeQuiz?.id === q.id ? "active" : ""}`}
                style={{ left: pct(Math.max(0, b - 1)) }}
                title={`Checkpoint ${i + 1}${state === "done" ? " (answered)" : state === "skipped" ? " (skipped)" : ""} — click to open`}
                onClick={() => jumpToQuiz(q)}
              >
                <span className="q-marker-dot" />
              </button>
            );
          })}
      </div>

      <div className="controls">
        <button className="play" onClick={togglePlay}>
          {elapsed >= total ? "↻ Replay" : playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <span className="time">
          {fmt(elapsed)} / {fmt(total)}
        </span>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="speed" aria-label="Speed">
          <option value={0.75}>0.75×</option>
          <option value={1}>1×</option>
          <option value={1.25}>1.25×</option>
          <option value={1.5}>1.5×</option>
        </select>
        <button className="mini" onClick={() => setMuted((m) => !m)} title="Voice">
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="mini" onClick={toggleFullscreen} title="Fullscreen">
          {isFullscreen ? "🡼 Exit" : "⛶ Full"}
        </button>
        <div className="spacer" />
        <button
          className={`mini ${showTranscript ? "on" : ""}`}
          onClick={() =>
            setShowTranscript((v) => {
              const next = !v;
              if (next) setClipMode(false); // mutually exclusive with Clip
              return next;
            })
          }
        >
          ≣ Transcript
        </button>
        <button className={`mini ${clipMode ? "on" : ""}`} onClick={toggleClip}>
          ✂ Clip
        </button>
        {interactive && results.length > 0 && (
          <button
            className={`mini ${showReview ? "on" : ""}`}
            onClick={() => setShowReview((v) => !v)}
          >
            📋 Review
          </button>
        )}
      </div>

      {clipMode && (
        <div className="clip-row">
          <div className="clip-track" ref={clipTrackRef}>
            <div className="clip-band" style={{ left: pct(clipLo), width: pct(clipHi - clipLo) }} />
            <div
              className="clip-handle"
              style={{ left: pct(clipStart) }}
              onPointerDown={startDrag("start")}
              onMouseDown={startDrag("start")}
              title="Drag clip start"
            />
            <div
              className="clip-handle"
              style={{ left: pct(clipEnd) }}
              onPointerDown={startDrag("end")}
              onMouseDown={startDrag("end")}
              title="Drag clip end"
            />
          </div>
          <div className="clip-actions">
            <span className="clip-label">
              Clip {fmt(clipLo)} – {fmt(clipHi)}
            </span>
            <button className="reexplain" onClick={reExplainClip} disabled={clipHi - clipLo < 300}>
              ✎ Re-explain this clip
            </button>
          </div>
        </div>
      )}

      {showTranscript && (
        <div className="transcript">
          {explainer.scenes.map((s, i) => {
            const isCurrent = i === sceneIndex;
            const sents = splitSentences(s.narration);
            return (
              <div
                key={s.id}
                ref={isCurrent ? activeLineRef : undefined}
                className={`ts-scene ${isCurrent ? "current" : ""}`}
                onClick={() => positionTo(starts[i], playing)}
              >
                <span className="ts-num">{i + 1}.</span>{" "}
                {isCurrent
                  ? sents.map((sent, j) => (
                      <span key={j} className={`ts-sent ${j === activeSentence ? "active" : ""}`}>
                        {sent}{" "}
                      </span>
                    ))
                  : s.narration}
                {(s.citations ?? []).map((c, k) => {
                  const n = citeReg.index.get(citeReg.key(c));
                  const href = citeReg.href(c);
                  const title = `${c.source}${c.page ? ` p.${c.page}` : ""}`;
                  return href ? (
                    <a
                      key={k}
                      className="ts-cite"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open ${title}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      [{n}]
                    </a>
                  ) : (
                    <sup key={k} className="ts-cite" title={title}>
                      [{n}]
                    </sup>
                  );
                })}
              </div>
            );
          })}
          {citeReg.list.length > 0 && (
            <div className="ts-sources">
              <div className="ts-sources-h">Sources</div>
              {citeReg.list.map((c, i) => {
                const href = citeReg.href(c);
                const label = `${c.source}${c.page ? ` — p.${c.page}` : ""}`;
                return (
                  <div key={i} className="ts-src">
                    <sup>[{i + 1}]</sup>{" "}
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" title={`Open ${label}`}>
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!hasAudio && (
        <div className="voice-note">
          {voiceOk
            ? "Using your browser's built-in voice. Server TTS wasn't available for this explainer."
            : "No speech voice in this browser — animation and captions still play."}
        </div>
      )}
    </div>
  );
});

export default ExplainerPlayer;
