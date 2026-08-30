"use client";

import { useState } from "react";
import ItemVisualFigure from "@/components/ItemVisual";
import type { ItemVisual } from "@/lib/visuals";

export interface ReviewOption {
  id: string;
  text: string;
  isCorrect: boolean;
  chosen: boolean;
  reason?: string;
}
export interface ReviewBlank {
  index: number;
  yours: string;
  expected: string;
  correct: boolean;
}
export interface ReviewRow {
  itemId: string;
  aspect: string;
  question: string;
  type: string;
  options?: ReviewOption[];
  blanks?: ReviewBlank[];
  starterCode?: string;
  language?: string;
  visual?: ItemVisual;
  yourAnswer: string;
  correctAnswer?: string;
  correct: boolean;
  score: number;
  explanation?: string;
  feedback?: string;
  stage?: number;
}

const TYPE_LABEL: Record<string, string> = {
  mcq: "Choose one",
  multi_mcq: "Select all that apply",
  fill_blank: "Fill in the blanks",
  short_answer: "Short answer",
  math_multistep: "Show your working",
  essay: "Written answer",
  pseudocode: "Pseudocode",
  code_bugfix: "Fix the bug",
  code_write: "Write the code",
};

/**
 * Go back over what was asked and why the right answer is right.
 *
 * The review renders each question the way it was ASKED: options with the one
 * they picked and the one that was right, blanks compared side by side, code and
 * figures shown again. A rendered answer string alone is not a review, because
 * the learner cannot see what they were choosing between.
 *
 * Tone follows the rest of the product: a missed question is marked "Review
 * this", never "Wrong", and the explanation is the point rather than the score.
 */
export default function AnswerReview({ rows, title }: { rows: ReviewRow[]; title?: string }) {
  const [showAll, setShowAll] = useState(false);
  if (!rows.length) return null;

  const missed = rows.filter((r) => !r.correct);
  const shown = showAll ? rows : missed;
  const right = rows.length - missed.length;

  return (
    <section className="rv">
      <div className="rv-head">
        <div>
          <h2>{title ?? "Review your answers"}</h2>
          <p className="muted">
            {right} of {rows.length} correct.{" "}
            {missed.length
              ? `Here ${missed.length === 1 ? "is the one" : `are the ${missed.length}`} worth a second look.`
              : "Nothing to fix, but you can look back at any question."}
          </p>
        </div>
        <button className="ghost-btn sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Only what I missed" : `Show all ${rows.length} questions`}
        </button>
      </div>

      {shown.length === 0 && <p className="muted rv-empty">You got every question right.</p>}

      {shown.map((r) => (
        <div key={r.itemId} className={`rv-item ${r.correct ? "ok" : "miss"}`}>
          <div className="rv-top">
            <span className={`rv-mark ${r.correct ? "ok" : "miss"}`}>{r.correct ? "✓" : "↻"}</span>
            <span className="rv-q">{r.question}</span>
            <span className="rv-kind">{TYPE_LABEL[r.type] ?? r.type}</span>
          </div>

          {r.visual && <ItemVisualFigure visual={r.visual} />}
          {r.starterCode && (
            <pre className="rv-code">
              <code>{r.starterCode}</code>
            </pre>
          )}

          {/* Multiple choice: show every option, marked. */}
          {r.options?.length ? (
            <div className="rv-options">
              {r.options.map((o) => {
                const cls = o.isCorrect ? "correct" : o.chosen ? "wrong" : "";
                return (
                  <div key={o.id} className={`rv-opt ${cls}`}>
                    <span className="rv-opt-mark">{o.isCorrect ? "✓" : o.chosen ? "✕" : ""}</span>
                    <span className="rv-opt-text">
                      {o.text}
                      {o.reason && <small className="rv-opt-why">{o.reason}</small>}
                    </span>
                    {o.chosen && <span className="rv-tag you">your answer</span>}
                    {o.isCorrect && !o.chosen && <span className="rv-tag right">correct</span>}
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Fill in the blanks: compare each blank. */}
          {r.blanks?.length ? (
            <div className="rv-blanks">
              {r.blanks.map((b) => (
                <div key={b.index} className={`rv-blank ${b.correct ? "ok" : "miss"}`}>
                  <span className="rv-lbl">Blank {b.index + 1}</span>
                  <span className="rv-blank-you">{b.yours || "(blank)"}</span>
                  {!b.correct && (
                    <>
                      <span className="rv-arrow">→</span>
                      <span className="rv-blank-exp">{b.expected}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {/* Everything else (open answers): the plain comparison. */}
          {!r.options?.length && !r.blanks?.length && (
            <div className="rv-answers">
              <div className={`rv-ans ${r.correct ? "ok" : "miss"}`}>
                <span className="rv-lbl">You said</span>
                <span>{r.yourAnswer || "(left blank)"}</span>
              </div>
              {!r.correct && r.correctAnswer && (
                <div className="rv-ans ok">
                  <span className="rv-lbl">Correct answer</span>
                  <span>{r.correctAnswer}</span>
                </div>
              )}
            </div>
          )}

          {r.explanation && (
            <div className="rv-why">
              <span className="rv-why-ico">💡</span>
              <span>{r.explanation}</span>
            </div>
          )}
          {r.feedback && <div className="rv-feedback">{r.feedback}</div>}

          <div className="rv-foot">
            <span className="rv-aspect">{r.aspect}</span>
            {typeof r.stage === "number" && <span className="rv-stage">Part {r.stage}</span>}
          </div>
        </div>
      ))}
    </section>
  );
}
