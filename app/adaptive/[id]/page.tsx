"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import ExplainerPlayer from "@/components/ExplainerPlayer";
import AssessmentRunner, { type PublicItem } from "@/components/AssessmentRunner";
import LessonFeedback from "@/components/LessonFeedback";
import type { Explainer } from "@/lib/types";

type Phase = "loading" | "learning" | "assessLoading" | "assessing" | "verdict";

interface RoundInfo {
  round: number;
  taughtSkill?: string;
  droppedDown?: boolean;
  reason?: string;
  overall?: number;
  passed?: boolean;
  at: number;
}

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
  // What the tutor decided to teach this round, and why (it may have dropped to
  // a prerequisite below the aspect the learner picked).
  const [teachSkill, setTeachSkill] = useState("");
  const [droppedDown, setDroppedDown] = useState(false);
  const [reason, setReason] = useState("");
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [sessionId2, setSessionId2] = useState("");
  const [retryOf, setRetryOf] = useState<number | null>(null);
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
        setTeachSkill(data.teachSkill || data.aspect || "");
        setDroppedDown(!!data.droppedDown);
        setReason(data.reason || "");
        loadHistory(data.sessionId);
        setPhase("learning");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
        setPhase("learning");
      }
    },
    [id]
  );

  // Past rounds, so the learner can rewatch a lesson or retry that attempt.
  const loadHistory = useCallback(async (sid: string) => {
    if (!sid) return;
    setSessionId2(sid);
    try {
      const res = await fetch(`/api/adaptive/learn?sessionId=${sid}`);
      const data = await res.json();
      setRounds((data.session?.rounds ?? []) as RoundInfo[]);
    } catch {
      /* history is a nicety */
    }
  }, []);

  // Replay the lesson from an earlier round.
  async function rewatch(r: number) {
    if (!sessionId2) return;
    setPhase("loading");
    setVerdict(null);
    try {
      const res = await fetch(`/api/adaptive/learn?sessionId=${sessionId2}&round=${r}`);
      const data = await res.json();
      if (!data.explainer) throw new Error("That lesson is no longer available.");
      setExplainer(data.explainer);
      const info = (data.session?.rounds ?? []).find((x: RoundInfo) => x.round === r);
      setTeachSkill(info?.taughtSkill || meta.aspect);
      setDroppedDown(!!info?.droppedDown);
      setReason(info?.reason || "");
      setRound(r);
      setPhase("learning");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setPhase("learning");
    }
  }

  // Retake the exact assessment from an earlier round.
  async function retry(r: number) {
    if (!sessionId2) return;
    setPhase("assessLoading");
    setError(null);
    try {
      const res = await fetch(`/api/adaptive/assess?sessionId=${sessionId2}&round=${r}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not load that attempt");
      setItems(data.items);
      setRetryOf(r);
      setPhase("assessing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setPhase("learning");
    }
  }

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
        body: JSON.stringify({ sessionId: sessionId || sessionId2, answers, retryOf }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Grading failed");
      setVerdict(data);
      setRetryOf(null);
      setPhase("verdict");
      loadHistory(sessionId || sessionId2);
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
          <h1>{teachSkill || meta.aspect || "Learning"}</h1>
          <p>
            {meta.topic}
            {teachSkill && meta.aspect && teachSkill.toLowerCase() !== meta.aspect.toLowerCase()
              ? ` · working toward ${meta.aspect}`
              : ""}
            {round > 1 ? ` · attempt ${round}` : ""}
          </p>
        </header>

        {/* When the tutor drops to a prerequisite, say so plainly so going back
            a step reads as deliberate teaching, not a downgrade. */}
        {droppedDown && phase === "learning" && (
          <div className="cert-banner exam step-back">
            <span className="cb-badge">🪜</span>
            <div className="cb-text">
              <b>Let&apos;s build the foundation first</b>
              <span>{reason || `Before ${meta.aspect}, we need ${teachSkill} to be solid.`}</span>
            </div>
          </div>
        )}

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
            <LessonFeedback
              key={`${explainer.id}-${round}`}
              explainerId={explainer.id}
              sessionId={sessionId}
              round={round}
              context="adaptive"
            />
            <div className="module-foot">
              <span className="muted">Watch the lesson, then check your understanding.</span>
              <button className="send big" onClick={startAssessment}>I&apos;m ready, assess me ▸</button>
            </div>

            {rounds.length > 1 && (
              <div className="round-history">
                <h3>Your attempts</h3>
                {rounds.map((r) => (
                  <div key={r.round} className={`rh-row ${r.round === round ? "current" : ""}`}>
                    <span className="rh-num">#{r.round}</span>
                    <span className="rh-skill">
                      {r.taughtSkill || meta.aspect}
                      {r.droppedDown && <span className="rh-tag">foundation</span>}
                    </span>
                    <span className="rh-score">
                      {typeof r.overall === "number" ? `${r.overall}%` : "not assessed"}
                    </span>
                    <button className="ghost-btn sm" onClick={() => rewatch(r.round)}>Rewatch</button>
                    <button
                      className="ghost-btn sm"
                      onClick={() => retry(r.round)}
                      disabled={typeof r.overall !== "number"}
                      title={typeof r.overall === "number" ? "Retake this exact assessment" : "No assessment taken yet"}
                    >
                      Retry test
                    </button>
                  </div>
                ))}
              </div>
            )}
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
