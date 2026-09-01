"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { humanizeSkill } from "@/lib/display";
import type { Diagnostic, WeakArea } from "@/lib/types";

interface Data {
  profile: { name?: string; educationLevel?: string; age?: number };
  diagnostics: Diagnostic[];
  weakAreas: WeakArea[];
  dueReviews?: WeakArea[];
  nextAction?: { kind: "review" | "learn"; area: WeakArea } | null;
  plan?: PlanItem[];
  progress?: { xp: number; streak: number };
}

interface PlanItem {
  kind: string;
  minutes: number;
  emoji: string;
  title: string;
  skill: string;
  weakAreaId: string;
  mode: string;
  why: string;
}

export default function AdaptiveDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/adaptive")
      .then(async (r) => {
        if (r.status === 401) {
          setAuthed(false);
          return null;
        }
        setAuthed(true);
        return r.json();
      })
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  if (authed === false) {
    return (
      <div className="shell">
        <AppNav />
        <div className="page narrow">
          <div className="auth-card">
            <h1>Your adaptive tutor</h1>
            <p className="muted">Log in or create an account to build your profile and start learning.</p>
            <div className="outline-actions">
              <Link className="send big" href="/signup">Create account</Link>
              <Link className="ghost-btn" href="/login">Log in</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="shell">
        <AppNav />
        <div className="page narrow"><p className="muted">Loading your tutor…</p></div>
      </div>
    );
  }

  // Group weak areas by topic.
  const byTopic = new Map<string, WeakArea[]>();
  for (const w of data.weakAreas) {
    const arr = byTopic.get(w.topic) ?? [];
    arr.push(w);
    byTopic.set(w.topic, arr);
  }
  const noProfile = !data.profile.educationLevel;

  return (
    <div className="shell">
      <AppNav />
      <div className="page">
        <header className="page-head with-progress">
          <div>
            <h1>Adaptive Tutor</h1>
            <p>
              {data.profile.name ? `${data.profile.name} · ` : ""}
              {data.profile.educationLevel ?? "Finish your profile to calibrate everything to your level."}
            </p>
          </div>
          {data.progress && (
            <div className="progress-badges">
              <span className="pb xp" title="Experience points earned">⭐ {data.progress.xp} XP</span>
              {data.progress.streak > 0 && (
                <span className="pb streak" title="Days in a row">🔥 {data.progress.streak}</span>
              )}
            </div>
          )}
        </header>

        {noProfile && (
          <div className="cert-banner exam">
            <span className="cb-badge">🧭</span>
            <div className="cb-text"><b>Build your profile</b><span>Answer a few questions and take a diagnostic.</span></div>
            <button className="send" onClick={() => router.push("/onboarding")}>Start ▸</button>
          </div>
        )}

        {/* Today's plan: the child should never have to decide what to study. */}
        {(data.plan?.length ?? 0) > 0 && (
          <section className="today">
            <div className="today-head">
              <h2>Today&apos;s Math</h2>
              <span className="today-mins">
                about {data.plan!.reduce((n, p) => n + p.minutes, 0)} min
              </span>
            </div>
            <div className="today-list">
              {data.plan!.map((p, i) => (
                <Link key={i} className="today-item" href={`/adaptive/${p.weakAreaId}`}>
                  <span className="ti-emoji">{p.emoji}</span>
                  <span className="ti-text">
                    <b>{p.title}</b>
                    <small>{humanizeSkill(p.skill)} · {p.why}</small>
                  </span>
                  <span className="ti-mins">{p.minutes} min</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* One clear next step, so the learner never has to plan their own study. */}
        {(data.plan?.length ?? 0) === 0 && data.nextAction && (
          <div className="next-action">
            <div className="na-text">
              <span className="na-kind">{data.nextAction.kind === "review" ? "Due for review" : "Up next"}</span>
              <b>{humanizeSkill(data.nextAction.area.aspect)}</b>
              <span className="muted">
                {data.nextAction.kind === "review"
                  ? "You learned this. A quick check keeps it from fading."
                  : `${data.nextAction.area.topic} · weakest area right now`}
              </span>
            </div>
            <Link className="send big" href={`/adaptive/${data.nextAction.area.id}`}>
              {data.nextAction.kind === "review" ? "Review it ▸" : "Start learning ▸"}
            </Link>
          </div>
        )}

        {(data.dueReviews?.length ?? 0) > 0 && (
          <section className="hub-section">
            <h2>Due for review ({data.dueReviews!.length})</h2>
            <div className="wa-grid">
              {data.dueReviews!.map((w) => (
                <div key={w.id} className="wa-card mastered due">
                  <div className="wa-top">
                    <span className="wa-aspect">{humanizeSkill(w.aspect)}</span>
                    <span className="wa-badge due">review</span>
                  </div>
                  <div className="wa-foot">
                    <span className="wa-pct">{w.reviews ?? 0} review{(w.reviews ?? 0) === 1 ? "" : "s"} done</span>
                    <Link className="send" href={`/adaptive/${w.id}`}>Review ▸</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Two ways in. Browsing is listed first because a learner often does not
            know what they do not know, and asking them to name a topic assumes
            they already do. The grade on their profile supplies the list. */}
        <div className="two-ways">
          <Link className="way" href="/adaptive/browse">
            <span className="way-ico">📚</span>
            <span className="way-text">
              <b>Show me what to learn</b>
              <small>
                Skills for {data.profile.educationLevel ?? "your grade"}, straight from the curriculum
              </small>
            </span>
            <span className="way-go">▸</span>
          </Link>
          <Link className="way" href="/onboarding">
            <span className="way-ico">✏️</span>
            <span className="way-text">
              <b>I know what I want to work on</b>
              <small>Name a topic and we will find your level in it</small>
            </span>
            <span className="way-go">▸</span>
          </Link>
        </div>

        {data.weakAreas.length === 0 ? (
          <p className="muted">No diagnostics yet. Diagnose a topic to see where you stand.</p>
        ) : (
          [...byTopic.entries()].map(([topic, areas]) => {
            const diag = data.diagnostics.find((d) => d.topic === topic);
            return (
              <section key={topic} className="topic-block">
                <div className="topic-head">
                  <h2>{topic}</h2>
                  {diag && <span className="topic-rank">{diag.rank} · {diag.overall}%</span>}
                </div>
                <div className="wa-grid">
                  {areas
                    .slice()
                    .sort((a, b) => a.mastery - b.mastery)
                    .map((w) => {
                      const pct = Math.round(w.mastery * 100);
                      const mastered = w.status === "mastered";
                      return (
                        <div key={w.id} className={`wa-card ${w.status}`}>
                          <div className="wa-top">
                            <span className="wa-aspect">{humanizeSkill(w.aspect)}</span>
                            {mastered ? (
                              <span className="wa-badge done">✓ Mastered</span>
                            ) : (
                              <span className={`wa-badge ${w.status}`}>{w.status}</span>
                            )}
                          </div>
                          <div className="wa-bar"><span className={mastered ? "good" : pct >= 50 ? "mid" : "bad"} style={{ width: `${pct}%` }} /></div>
                          <div className="wa-foot">
                            <span className="wa-pct">{pct}% mastery</span>
                            <Link className={mastered ? "ghost-btn" : "send"} href={`/adaptive/${w.id}`}>
                              {mastered ? "Review" : "Start learning ▸"}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
