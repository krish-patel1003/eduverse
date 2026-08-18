"use client";

import { useState } from "react";
import { REACTIONS } from "@/lib/feedback";

interface Props {
  /** The lesson being reviewed. */
  explainerId?: string;
  /** When the lesson is part of an adaptive session, feeds the next re-teach. */
  sessionId?: string;
  round?: number;
  /** Where this lesson lives, for analytics ("adaptive" | "course" | "chat"). */
  context?: string;
}

/**
 * A one-tap end-of-lesson reaction bar plus an optional note. No stars, no long
 * form. The reactions double as a learning signal: they nudge the learner model
 * and, in adaptive sessions, steer the very next lesson.
 */
export default function LessonFeedback({ explainerId, sessionId, round, context = "lesson" }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function send() {
    if (!picked.length && !text.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explainerId, sessionId, round, context, reactions: picked, text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="lf-card done">
        <span className="lf-check">✓</span>
        <span>Thanks. This shapes your next lesson.</span>
      </div>
    );
  }

  const canSend = picked.length > 0 || text.trim().length > 0;

  return (
    <div className="lf-card">
      <div className="lf-title">How was this lesson?</div>
      <div className="lf-reactions">
        {REACTIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`lf-react ${picked.includes(r.id) ? "on" : ""}`}
            onClick={() => toggle(r.id)}
            aria-pressed={picked.includes(r.id)}
          >
            <span className="lf-emoji">{r.emoji}</span>
            <span className="lf-label">{r.label}</span>
          </button>
        ))}
      </div>
      <textarea
        className="lf-text"
        placeholder="Anything you'd change? (optional)"
        value={text}
        maxLength={1000}
        rows={2}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="lf-foot">
        {state === "error" && <span className="lf-err">Could not save. Try again.</span>}
        <button className="lf-send" onClick={send} disabled={!canSend || state === "sending"}>
          {state === "sending" ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </div>
  );
}
