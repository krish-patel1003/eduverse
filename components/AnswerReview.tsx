"use client";

import { useState } from "react";

export interface ReviewRow {
  itemId: string;
  aspect: string;
  question: string;
  yourAnswer: string;
  correctAnswer?: string;
  correct: boolean;
  score: number;
  explanation?: string;
  feedback?: string;
  stage?: number;
}

/**
 * Go back over what was asked and why the right answer is right.
 *
 * Tone follows the rest of the product: a missed question is marked "Review
 * this", never "Wrong", and the explanation is the point of the screen rather
 * than the score. Defaults to showing only the missed questions, because that
 * is what is worth a learner's attention, with everything one click away.
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
          {showAll ? "Only what I missed" : "Show all questions"}
        </button>
      </div>

      {shown.length === 0 && <p className="muted rv-empty">You got every question right.</p>}

      {shown.map((r, i) => (
        <div key={r.itemId} className={`rv-item ${r.correct ? "ok" : "miss"}`}>
          <div className="rv-top">
            <span className={`rv-mark ${r.correct ? "ok" : "miss"}`}>{r.correct ? "✓" : "↻"}</span>
            <span className="rv-q">{r.question}</span>
            <span className="rv-aspect">{r.aspect}</span>
          </div>

          <div className="rv-answers">
            <div className={`rv-ans ${r.correct ? "ok" : "miss"}`}>
              <span className="rv-lbl">You said</span>
              <span>{r.yourAnswer || "(left blank)"}</span>
            </div>
            {/* Only show the answer key when they did not already give it. */}
            {!r.correct && r.correctAnswer && (
              <div className="rv-ans ok">
                <span className="rv-lbl">Correct answer</span>
                <span>{r.correctAnswer}</span>
              </div>
            )}
          </div>

          {r.explanation && (
            <div className="rv-why">
              <span className="rv-why-ico">💡</span>
              <span>{r.explanation}</span>
            </div>
          )}
          {r.feedback && <div className="rv-feedback">{r.feedback}</div>}
          {typeof r.stage === "number" && <div className="rv-stage">Part {r.stage}</div>}
          {i < shown.length - 1 && <span className="rv-sep" />}
        </div>
      ))}
    </section>
  );
}
