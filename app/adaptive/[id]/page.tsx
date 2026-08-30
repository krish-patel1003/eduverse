"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import ExplainerPlayer from "@/components/ExplainerPlayer";
import AssessmentRunner, { type PublicItem, type SubmitMeta } from "@/components/AssessmentRunner";
import LessonFeedback from "@/components/LessonFeedback";
import AnswerReview, { type ReviewRow } from "@/components/AnswerReview";
import ModePicker from "@/components/ModePicker";
import {
  METHOD_LABEL,
  MODE_EMOJI,
  MODE_LABEL,
  isTeachingMethod,
  isTeachingMode,
  type TeachingMode,
  type TeachingMethod,
} from "@/lib/pedagogy";
import { humanizeSkill } from "@/lib/display";
import type { Explainer } from "@/lib/types";

type Phase = "loading" | "learning" | "assessLoading" | "assessing" | "verdict";

interface RoundInfo {
  round: number;
  taughtSkill?: string;
  mode?: TeachingMode;
  method?: TeachingMethod;
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
  /** Every question with the right answer and why. */
  review?: ReviewRow[];
  reward?: { xp: number; reason: string; headline: string; message: string; emoji: string; comeback: boolean };
  progress?: { xp: number; streak: number; streakExtended: boolean };
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
  // "Math My Way": the child's requested mode. "auto" lets the engine choose.
  const [mode, setMode] = useState<TeachingMode>("auto");
  const [taughtMode, setTaughtMode] = useState<TeachingMode | null>(null);
  const [routeReason, setRouteReason] = useState("");
  // How many different ways we have already tried this skill, and the cap. Shown
  // up front so hitting the limit is never a surprise.
  const [roundsUsed, setRoundsUsed] = useState(0);
  const [maxRounds, setMaxRounds] = useState(4);
  const [capped, setCapped] = useState(false);
  const [sessionId2, setSessionId2] = useState("");
  const [retryOf, setRetryOf] = useState<number | null>(null);
  const [items, setItems] = useState<PublicItem[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read the latest picked mode without rebuilding the teach callback.
  const modeRef = useRef<TeachingMode>("auto");
  modeRef.current = mode;

  const teach = useCallback(
    async (reteach: boolean) => {
      setPhase("loading");
      setError(null);
      setVerdict(null);
      try {
        const res = await fetch("/api/adaptive/learn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weakAreaId: id, reteach, mode: modeRef.current }),
        });
        const data = await res.json();
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (typeof data?.maxRounds === "number") setMaxRounds(data.maxRounds);
        if (typeof data?.roundsUsed === "number") setRoundsUsed(data.roundsUsed);
        // Hitting the cap is a normal, expected state, not an error to bury.
        if (res.status === 429 && data?.capped) {
          setCapped(true);
          setPhase("learning");
          return;
        }
        if (!res.ok) throw new Error(data?.error ?? "Could not start");
        setCapped(false);
        setSessionId(data.sessionId);
        setExplainer(data.explainer);
        setMeta({ topic: data.topic, aspect: data.aspect });
        setRound(data.round || 1);
        setTeachSkill(data.teachSkill || data.aspect || "");
        setDroppedDown(!!data.droppedDown);
        setReason(data.reason || "");
        setTaughtMode((data.mode as TeachingMode) ?? null);
        setRouteReason(data.routeReason || "");
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

  // Capped either because a request told us so, or because the budget is spent.
  // Deriving it means the learner sees the limit on arrival, not after a click
  // that silently does nothing.
  const isCapped = capped || (roundsUsed >= maxRounds && maxRounds > 0);

  // Picking a different kind of help re-teaches the same skill that way.
  function pickMode(next: TeachingMode) {
    setMode(next);
    modeRef.current = next;
    teach(true);
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

  async function submitAssessment(answers: Record<string, unknown>, meta: SubmitMeta) {
    setPhase("assessLoading");
    setError(null);
    try {
      const res = await fetch("/api/adaptive/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId || sessionId2,
          answers,
          hintsUsed: meta.hintsUsed,
          seconds: meta.seconds,
          totalSeconds: meta.totalSeconds,
          working: meta.working,
          retryOf,
        }),
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
          <h1>{humanizeSkill(teachSkill || meta.aspect) || "Learning"}</h1>
          <p>
            {meta.topic}
            {teachSkill && meta.aspect && teachSkill.toLowerCase() !== meta.aspect.toLowerCase()
              ? ` · working toward ${humanizeSkill(meta.aspect)}`
              : ""}
            {round > 1 ? ` · attempt ${round}` : ""}
          </p>
        </header>

        {error && (
          <div className="alert" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
            <button className="alert-x" onClick={() => setError(null)} aria-label="Dismiss">✕</button>
          </div>
        )}

        {/* When the tutor drops to a prerequisite, say so plainly so going back
            a step reads as deliberate teaching, not a downgrade. */}
        {droppedDown && phase === "learning" && (
          <div className="cert-banner exam step-back">
            <span className="cb-badge">🪜</span>
            <div className="cb-text">
              <b>Let&apos;s build the foundation first</b>
              <span>{reason || `Before ${humanizeSkill(meta.aspect)}, we need ${humanizeSkill(teachSkill)} to be solid.`}</span>
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
            {/* What the engine actually chose, in the child's own words. */}
            {taughtMode && (
              <div className="mp-chosen">
                <span className="mp-emoji">{MODE_EMOJI[taughtMode]}</span>
                <span>
                  <b>{MODE_LABEL[taughtMode]}</b>
                  {routeReason ? ` · ${routeReason}` : ""}
                </span>
              </div>
            )}
            <div className="player-wrap"><ExplainerPlayer explainer={explainer} /></div>

            {/* Let them ask for a different kind of help, and be honest up front
                about how many fresh takes are left so the cap never surprises. */}
            {isCapped ? (
              <div className="capped-card">
                <span className="capped-emoji">🌙</span>
                <div className="capped-text">
                  <b>That&apos;s enough on this one for today</b>
                  <span>
                    You&apos;ve already tried this {maxRounds} different ways, which is real effort. Sleeping on it
                    genuinely helps things click, so let&apos;s come back to it tomorrow.
                  </span>
                  <span className="capped-note">
                    You can still rewatch any lesson below or retry a test.
                  </span>
                </div>
                <Link className="send big" href="/adaptive">Try something else ▸</Link>
              </div>
            ) : (
              <div className="mp-again">
                <div className="mp-again-head">
                  <div className="mp-again-title">Want it taught a different way?</div>
                  <span className="mp-tries" title={`A skill can be taught ${maxRounds} different ways before taking a break`}>
                    {Math.max(0, maxRounds - roundsUsed)} of {maxRounds} fresh takes left
                  </span>
                </div>
                <ModePicker value={mode} onPick={pickMode} compact />
              </div>
            )}

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
                      {humanizeSkill(r.taughtSkill || meta.aspect)}
                      {r.droppedDown && <span className="rh-tag">foundation</span>}
                    </span>
                    {/* How it was taught. The child sees their own mode label;
                        the engine method sits in the tooltip for grown-ups. */}
                    {isTeachingMode(r.mode) && (
                      <span
                        className="rh-mode"
                        title={
                          r.method && isTeachingMethod(r.method)
                            ? `Taught as "${MODE_LABEL[r.mode]}" using ${METHOD_LABEL[r.method]}`
                            : MODE_LABEL[r.mode]
                        }
                      >
                        <span className="rh-mode-emoji">{MODE_EMOJI[r.mode]}</span>
                        <span className="rh-mode-label">{MODE_LABEL[r.mode]}</span>
                      </span>
                    )}
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
            {/* Mistakes are information, never a verdict on the child. The
                headline celebrates effort and progress, not just passing. */}
            <div className="celebrate">
              <span className="celebrate-emoji">{verdict.reward?.emoji ?? (verdict.passed ? "🎉" : "💪")}</span>
              <h2>{verdict.reward?.headline ?? (verdict.passed ? "You got it!" : "Almost!")}</h2>
              <p className="celebrate-msg">
                {verdict.reward?.message ??
                  (verdict.passed
                    ? `You just mastered ${teachSkill || meta.aspect}.`
                    : `I found what tripped you up on ${teachSkill || meta.aspect}. Let's fix it together.`)}
              </p>
              {verdict.reward && (
                <div className="xp-row">
                  <span className="xp-chip">+{verdict.reward.xp} XP ⭐</span>
                  <span className="xp-reason">{verdict.reward.reason}</span>
                  {verdict.progress && verdict.progress.streak > 1 && (
                    <span className="xp-streak">🔥 {verdict.progress.streak}-day streak</span>
                  )}
                </div>
              )}
            </div>

            <details className="verdict-detail">
              <summary>See how each part went</summary>
              <div className="report-aspects">
                {verdict.perAspect.sort((a, b) => a.score - b.score).map((a) => {
                  const cls = a.score >= 70 ? "good" : a.score >= 40 ? "mid" : "bad";
                  return (
                    <div key={a.aspect} className="ra-row">
                      <span className="ra-name">{humanizeSkill(a.aspect)}</span>
                      <span className="ra-bar"><span className={cls} style={{ width: `${a.score}%` }} /></span>
                      <span className="ra-score">{a.score}%</span>
                    </div>
                  );
                })}
              </div>
            </details>

            {/* The full review: every question as it was asked, what they chose,
                what was right, and why. This replaces a list of bare grader
                strings like "Incorrect." which told the learner nothing. */}
            <AnswerReview rows={verdict.review ?? []} title="Go over the questions" />

            {/* What's next: always give a clear, small, appealing next step. */}
            <div className="whats-next">
              <div className="wn-title">What&apos;s next?</div>
              <div className="wn-cards">
                {verdict.passed ? (
                  <>
                    <Link className="wn-card" href="/adaptive">
                      <span className="wn-emoji">🔵</span>
                      <b>Next skill</b>
                      <small>5 min</small>
                    </Link>
                    <button className="wn-card" onClick={() => pickMode("challenge")}>
                      <span className="wn-emoji">🟣</span>
                      <b>Fun challenge</b>
                      <small>3 min</small>
                    </button>
                    <button className="wn-card" onClick={() => pickMode("practice")}>
                      <span className="wn-emoji">🟢</span>
                      <b>Quick practice</b>
                      <small>2 min</small>
                    </button>
                  </>
                ) : verdict.capped ? (
                  <>
                    <p className="muted wn-rest">
                      You have worked hard on this today. Fresh eyes tomorrow will make it click.
                    </p>
                    <Link className="wn-card" href="/adaptive">
                      <span className="wn-emoji">🟢</span>
                      <b>Something else</b>
                      <small>5 min</small>
                    </Link>
                  </>
                ) : (
                  <>
                    <button className="wn-card primary" onClick={() => teach(true)}>
                      <span className="wn-emoji">✨</span>
                      <b>Teach me a different way</b>
                      <small>Recommended</small>
                    </button>
                    <button className="wn-card" onClick={() => pickMode("show_me")}>
                      <span className="wn-emoji">👀</span>
                      <b>Show me with pictures</b>
                      <small>4 min</small>
                    </button>
                    <Link className="wn-card" href="/adaptive">
                      <span className="wn-emoji">🌙</span>
                      <b>Come back later</b>
                      <small>Save my spot</small>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
