"use client";

import { useEffect, useRef, useState } from "react";
import type { AssessmentItemType, QuizOption } from "@/lib/types";
import type { ItemVisual } from "@/lib/visuals";
import ItemVisualFigure from "@/components/ItemVisual";

// The client-safe item shape (no answer keys).
export interface PublicItem {
  id: string;
  type: AssessmentItemType;
  aspect: string;
  prompt: string;
  options?: QuizOption[];
  language?: string;
  starterCode?: string;
  blanks?: number;
  /** An exact figure drawn with the question (fraction bar, number line, ...). */
  visual?: ItemVisual;
  /** Progressive hints, gentlest first. */
  hints?: string[];
}

export interface SubmitMeta {
  /** Hints revealed per item id. */
  hintsUsed: Record<string, number>;
  /** ACTIVE seconds per item id (idle and backgrounded time excluded). */
  seconds: Record<string, number>;
  /** Active seconds across the whole assessment. */
  totalSeconds: number;
}

interface Props {
  items: PublicItem[];
  onSubmit: (answers: Record<string, unknown>, meta: SubmitMeta) => void;
  submitting?: boolean;
  submitLabel?: string;
  title?: string;
  subtitle?: string;
}

const TYPE_LABEL: Record<AssessmentItemType, string> = {
  mcq: "Choose one",
  multi_mcq: "Select all that apply",
  fill_blank: "Fill in the blanks",
  short_answer: "Short answer",
  code_bugfix: "Find and fix the bug",
  code_write: "Write the code",
  pseudocode: "Write pseudocode",
  essay: "Writing task",
  math_multistep: "Show your working",
};

export default function AssessmentRunner({ items, onSubmit, submitting, submitLabel, title, subtitle }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  // Hints revealed per item. Asking for help is encouraged, but it is recorded:
  // a right answer reached with hints is progress, not yet independent mastery.
  const [hintsShown, setHintsShown] = useState<Record<string, number>>({});

  const revealHint = (id: string, total: number) =>
    setHintsShown((h) => ({ ...h, [id]: Math.min(total, (h[id] ?? 0) + 1) }));

  // ---- silent response timing ------------------------------------------------
  // Time is measured but NEVER shown as a countdown: time pressure raises
  // anxiety, and anxiety degrades mathematics performance specifically. We
  // accrue time only to the question actually on screen, and only while the
  // learner is present, so a backgrounded tab or a child leaving the room does
  // not turn into a 400 second "answer".
  const msRef = useRef<Record<string, number>>({});
  const activeIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const IDLE_MS = 45_000; // no interaction for this long: stop counting
    const bump = () => (lastActivityRef.current = Date.now());
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    let last = Date.now();
    const tick = window.setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      const present = document.visibilityState === "visible";
      const active = now - lastActivityRef.current < IDLE_MS;
      const id = activeIdRef.current;
      if (present && active && id) msRef.current[id] = (msRef.current[id] ?? 0) + delta;
    }, 1000);

    // Attribute time to whichever question is most in view.
    const io = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) activeIdRef.current = (best.target as HTMLElement).dataset.itemId ?? null;
      },
      { threshold: [0.25, 0.5, 0.75], rootMargin: "-15% 0px -35% 0px" }
    );
    Object.values(itemRefs.current).forEach((el) => el && io.observe(el));

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(tick);
      io.disconnect();
    };
  }, [items]);

  function collectMeta(): SubmitMeta {
    const seconds: Record<string, number> = {};
    let total = 0;
    for (const it of items) {
      const sec = Math.round((msRef.current[it.id] ?? 0) / 1000);
      seconds[it.id] = sec;
      total += sec;
    }
    return { hintsUsed: hintsShown, seconds, totalSeconds: total };
  }

  const set = (id: string, v: unknown) => setAnswers((a) => ({ ...a, [id]: v }));

  const toggleMulti = (id: string, oid: string) =>
    setAnswers((a) => {
      const cur = (a[id] as string[]) ?? [];
      return { ...a, [id]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
    });

  const setBlank = (id: string, i: number, v: string) =>
    setAnswers((a) => {
      const cur = ((a[id] as string[]) ?? []).slice();
      cur[i] = v;
      return { ...a, [id]: cur };
    });

  const answered = items.filter((it) => {
    const a = answers[it.id];
    if (Array.isArray(a)) return a.some((x) => String(x).trim());
    return String(a ?? "").trim().length > 0;
  }).length;

  return (
    <div className="assess">
      {(title || subtitle) && (
        <div className="assess-head">
          {title && <h2>{title}</h2>}
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      )}
      <div className="assess-items">
        {items.map((it, i) => {
          const a = answers[it.id];
          return (
            <div
              key={it.id}
              className="assess-item"
              data-item-id={it.id}
              ref={(el) => {
                itemRefs.current[it.id] = el;
              }}
            >
              <div className="ai-top">
                <span className="ai-num">{i + 1}</span>
                <span className="ai-kind">{TYPE_LABEL[it.type]}</span>
                <span className="ai-aspect">{it.aspect}</span>
              </div>
              <div className="ai-prompt">{it.prompt}</div>

              {it.visual && <ItemVisualFigure visual={it.visual} />}

              {(it.hints?.length ?? 0) > 0 && (
                <div className="ai-hints">
                  {(it.hints ?? []).slice(0, hintsShown[it.id] ?? 0).map((h, hi) => (
                    <div key={hi} className="ai-hint">
                      <span className="ai-hint-ico">💡</span>
                      <span>{h}</span>
                    </div>
                  ))}
                  {(hintsShown[it.id] ?? 0) < (it.hints?.length ?? 0) && (
                    <button
                      type="button"
                      className="ai-hint-btn"
                      onClick={() => revealHint(it.id, it.hints!.length)}
                    >
                      {(hintsShown[it.id] ?? 0) === 0 ? "💡 Stuck? Get a hint" : "💡 One more hint"}
                    </button>
                  )}
                </div>
              )}

              {it.starterCode && (
                <pre className="ai-starter"><code>{it.starterCode}</code></pre>
              )}

              {(it.type === "mcq" || it.type === "multi_mcq") && (
                <div className="ai-options">
                  {(it.options ?? []).map((o) => {
                    const picked =
                      it.type === "mcq" ? (a as string[])?.[0] === o.id : ((a as string[]) ?? []).includes(o.id);
                    return (
                      <button
                        key={o.id}
                        className={`ai-opt ${picked ? "picked" : ""}`}
                        onClick={() => (it.type === "mcq" ? set(it.id, [o.id]) : toggleMulti(it.id, o.id))}
                      >
                        <span className="ai-opt-mark">{picked ? "●" : "○"}</span>
                        {o.text}
                      </button>
                    );
                  })}
                </div>
              )}

              {it.type === "fill_blank" && (
                <div className="ai-blanks">
                  {Array.from({ length: it.blanks ?? 1 }).map((_, k) => (
                    <input
                      key={k}
                      className="ai-blank"
                      placeholder={`Blank ${k + 1}`}
                      value={((a as string[]) ?? [])[k] ?? ""}
                      onChange={(e) => setBlank(it.id, k, e.target.value)}
                    />
                  ))}
                </div>
              )}

              {it.type === "short_answer" && (
                <textarea className="ai-text" rows={2} value={(a as string) ?? ""} onChange={(e) => set(it.id, e.target.value)} placeholder="Your answer…" />
              )}

              {(it.type === "essay") && (
                <textarea className="ai-text" rows={7} value={(a as string) ?? ""} onChange={(e) => set(it.id, e.target.value)} placeholder="Write your response…" />
              )}

              {(it.type === "code_bugfix" || it.type === "code_write" || it.type === "pseudocode") && (
                <textarea
                  className="ai-text ai-code"
                  rows={8}
                  spellCheck={false}
                  value={(a as string) ?? (it.type === "code_bugfix" ? it.starterCode ?? "" : "")}
                  onChange={(e) => set(it.id, e.target.value)}
                  placeholder={it.type === "pseudocode" ? "Outline the steps…" : "Write your code…"}
                />
              )}

              {it.type === "math_multistep" && (
                <textarea className="ai-text ai-code" rows={6} value={(a as string) ?? ""} onChange={(e) => set(it.id, e.target.value)} placeholder="Show each step of your working, then your final answer…" />
              )}
            </div>
          );
        })}
      </div>

      <div className="assess-foot">
        <span className="assess-progress">{answered}/{items.length} answered</span>
        <button className="send big" onClick={() => onSubmit(answers, collectMeta())} disabled={submitting || answered === 0}>
          {submitting ? "Grading…" : submitLabel ?? "Submit"}
        </button>
      </div>
    </div>
  );
}
