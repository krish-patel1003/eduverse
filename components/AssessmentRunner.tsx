"use client";

import { useState } from "react";
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
}

interface Props {
  items: PublicItem[];
  onSubmit: (answers: Record<string, unknown>) => void;
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
            <div key={it.id} className="assess-item">
              <div className="ai-top">
                <span className="ai-num">{i + 1}</span>
                <span className="ai-kind">{TYPE_LABEL[it.type]}</span>
                <span className="ai-aspect">{it.aspect}</span>
              </div>
              <div className="ai-prompt">{it.prompt}</div>

              {it.visual && <ItemVisualFigure visual={it.visual} />}

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
        <button className="send big" onClick={() => onSubmit(answers)} disabled={submitting || answered === 0}>
          {submitting ? "Grading…" : submitLabel ?? "Submit"}
        </button>
      </div>
    </div>
  );
}
