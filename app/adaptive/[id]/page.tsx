"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import ExplainerPlayer from "@/components/ExplainerPlayer";
import AssessmentRunner, { type PublicItem } from "@/components/AssessmentRunner";
import type { Explainer } from "@/lib/types";

type Phase = "loading" | "learning" | "assessLoading" | "assessing" | "verdict";

interface Verdict {
  passed: boolean;
  capped: boolean;
  roundsUsed: number;
  maxRounds: number;
  overall: number;
  perAspect: { aspect: string; score: number }[];
  weakAspects: string[];
  summary: string;
  perItem: { itemId: string; correct: boolean; score: number; feedback: string }[];
}

export default function AdaptiveLoopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionId, setSessionId] = useState("");
  const [explainer, setExplainer] = useState<Explainer | null>(null);
  const [meta, setMeta] = useState<{ topic: string; aspect: string }>({ topic: "", aspect: "" });
  const [round, setRound] = useState(1);
  const [items, setItems] = useState<PublicItem[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teach = useCallback(
    async (reteach: boolean) => {
      setPhase("loading");
      setError(null);
      setVerdict(null);
      try {
        const res = await fetch("/api/adaptive/learn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weakAreaId: id, reteach }),
        });
        const data = await res.json();
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error(data?.error ?? "Could not start");
        setSessionId(data.sessionId);
        setExplainer(data.explainer);
        setMeta({ topic: data.topic, aspect: data.aspect });
        setRound(data.round || 1);
        setPhase("learning");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
        setPhase("learning");
      }
    },
    [id]
  );

  useEffect(() => {
    teach(false);
  }, [teach]);

  async function startAssessment() {
    setPhase("assessLoading");
    setError(null);
    try {
      const res = await fetch(`/api/adaptive/assess?sessionId=${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not build the assessment");
      setItems(data.items);
      setPhase("assessing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setPhase("learning");
    }
  }

  async function submitAssessment(answers: Record<string, unknown>) {
    setPhase("assessLoading");
    setError(null);
    try {
      const res = await fetch("/api/adaptive/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Grading failed");
      setVerdict(data);
      setPhase("verdict");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setPhase("assessing");
    }
  }

  return (
    <div className="shell">
      <AppNav />
      <div className="page">
        <header className="page-head">
          <h1>{meta.aspect || "Learning"}</h1>
          <p>{meta.topic}{round > 1 ? ` · attempt ${round}` : ""}</p>
        </header>

        {phase === "loading" && (
          <div className="render-card standalone">
            <div className="render-title">✎ Preparing your lesson…</div>
            <div className="render-sub">The tutor is building a lesson tailored to this exact weak spot. About a minute.</div>
            <div className="render-bar"><span /></div>
          </div>
        )}

        {phase === "learning" && explainer && (
          <>
            <div className="player-wrap"><ExplainerPlayer explainer={explainer} /></div>
            <div className="module-foot">
              <span className="muted">Watch the lesson, then check your understanding.</span>
              <button className="send big" onClick={startAssessment}>I&apos;m ready, assess me ▸</button>
            </div>
          </>
        )}

        {phase === "assessLoading" && (
          <div className="render-card standalone">
            <div className="render-title">Preparing your assessment…</div>
            <div className="render-bar"><span /></div>
          </div>
        )}

        {phase === "assessing" && (
          <AssessmentRunner
            items={items}
            onSubmit={submitAssessment}
            title="Show what you learned"
            subtitle="Pass every part and this weak area is marked mastered."
            submitLabel="Submit for grading ▸"
          />
        )}

        {phase === "verdict" && verdict && (
          <div className={`verdict ${verdict.passed ? "pass" : "fail"}`}>
            <div className="verdict-head">
              <span className="verdict-icon">{verdict.passed ? "🎉" : "🔁"}</span>
              <div>
                <h2>{verdict.passed ? "Mastered!" : "Not quite yet"}</h2>
                <p className="muted">
                  {verdict.passed
                    ? `You understand ${meta.aspect}. Marked mastered.`
                    : verdict.summary}
                </p>
              </div>
              <span className="verdict-score">{verdict.overall}%</span>
            </div>

            <div className="report-aspects">
              {verdict.perAspect.sort((a, b) => a.score - b.score).map((a) => {
                const cls = a.score >= 70 ? "good" : a.score >= 40 ? "mid" : "bad";
                return (
                  <div key={a.aspect} className="ra-row">
                    <span className="ra-name">{a.aspect}</span>
                    <span className="ra-bar"><span className={cls} style={{ width: `${a.score}%` }} /></span>
                    <span className="ra-score">{a.score}%</span>
                  </div>
                );
              })}
            </div>

            {!verdict.passed && verdict.perItem.some((p) => p.feedback) && (
              <div className="verdict-feedback">
                <h3>Feedback</h3>
                {verdict.perItem.filter((p) => !p.correct && p.feedback).slice(0, 5).map((p, i) => (
                  <div key={i} className="vf-item">✗ {p.feedback}</div>
                ))}
              </div>
            )}

            <div className="verdict-actions">
              {verdict.passed ? (
                <Link className="send big" href="/adaptive">Back to my tutor ▸</Link>
              ) : verdict.capped ? (
                <>
                  <p className="muted">You&apos;ve had {verdict.roundsUsed} goes at this. Take a short break and come back with fresh eyes.</p>
                  <Link className="ghost-btn" href="/adaptive">Back to my tutor</Link>
                </>
              ) : (
                <>
                  <button className="send big" onClick={() => teach(true)}>Teach me again, differently ▸</button>
                  <Link className="ghost-btn" href="/adaptive">Later</Link>
                </>
              )}
            </div>
          </div>
        )}

        {error && <div className="err">{error}</div>}
      </div>
    </div>
  );
}
