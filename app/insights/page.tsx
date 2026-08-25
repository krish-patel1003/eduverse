"use client";

import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { humanizeSkill } from "@/lib/display";

interface Stat {
  mode: string;
  method: string;
  attempts: number;
  wins: number;
  rate: number;
  avgGain: number | null;
  modeLabel: string;
  modeEmoji: string;
  methodLabel: string;
}
interface SkillRow { skill: string; topic?: string; stats: Stat[] }
interface SpeedRow { skill: string; pace: number; attempts: number; totalSeconds: number; needsSpeedWork: boolean }

interface Data {
  child: { name: string; avatar: string; educationLevel?: string } | null;
  hifi: boolean;
  skills: SkillRow[];
  speed?: SpeedRow[];
  summary: { tracked: number; mastered: number; learning: number; weak: number; graph: { rows: number; totalUses: number } };
}

export default function InsightsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/insights").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  async function toggleHiFi(on: boolean) {
    setSaving(true);
    setData((d) => (d ? { ...d, hifi: on } : d));
    await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hifi: on }),
    }).catch(() => {});
    setSaving(false);
  }

  if (!data) {
    return (
      <div className="shell"><AppNav /><div className="page"><p className="muted">Loading…</p></div></div>
    );
  }

  return (
    <div className="shell">
      <AppNav />
      <div className="page">
        <header className="page-head">
          <h1>Insights</h1>
          <p>
            {data.child ? `${data.child.avatar} ${data.child.name}` : "This learner"}
            {data.child?.educationLevel ? ` · ${data.child.educationLevel}` : ""} · for parents and teachers
          </p>
        </header>

        <div className="ins-stats">
          <div className="ins-stat"><b>{data.summary.tracked}</b><span>skills tracked</span></div>
          <div className="ins-stat good"><b>{data.summary.mastered}</b><span>mastered</span></div>
          <div className="ins-stat mid"><b>{data.summary.learning}</b><span>learning</span></div>
          <div className="ins-stat bad"><b>{data.summary.weak}</b><span>needs work</span></div>
        </div>

        {/* Lesson quality is a grown-up decision: it trades minutes for fidelity. */}
        <section className="ins-setting">
          <div className="ins-setting-text">
            <b>High-fidelity drawn lessons</b>
            <span>
              Each scene is drawn stroke by stroke instead of illustrated in one pass. Noticeably more beautiful,
              but a lesson takes several minutes instead of about one.
            </span>
          </div>
          <button
            className={`toggle ${data.hifi ? "on" : ""}`}
            onClick={() => toggleHiFi(!data.hifi)}
            disabled={saving}
            aria-pressed={data.hifi}
          >
            <span className="toggle-knob" />
          </button>
        </section>

        {(data.speed?.length ?? 0) > 0 && (
          <section className="hub-section">
            <h2>Speed</h2>
            <p className="muted ins-note">
              How long answers take compared with what the question should need. This only appears once the answers
              are mostly right, because speed on material a learner cannot yet do is not a meaningful number. A child
              is never shown a timer.
            </p>
            {data.speed!.map((sp) => {
              const cls = sp.pace <= 0.8 ? "good" : sp.pace <= 1.6 ? "mid" : "bad";
              const label = sp.pace <= 0.8 ? "quick and automatic" : sp.pace <= 1.6 ? "steady" : "accurate but slow";
              return (
                <div key={sp.skill} className="ins-row speed">
                  <span className="ins-mode">{humanizeSkill(sp.skill)}</span>
                  <span className="ins-method">{label}</span>
                  <span className="ins-bar">
                    <span className={cls} style={{ width: `${Math.min(100, Math.round((sp.pace / 2.5) * 100))}%` }} />
                  </span>
                  <span className="ins-rate">{sp.pace}×</span>
                  <span className="ins-n">
                    {sp.needsSpeedWork ? "drill speed" : `${sp.attempts} ${sp.attempts === 1 ? "try" : "tries"}`}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        <section className="hub-section">
          <h2>What actually works for this learner</h2>
          <p className="muted ins-note">
            The best approach is not one fixed &ldquo;learning style&rdquo;. It changes by concept, so it is tracked
            per skill. Percentages are how often that approach led to mastery.
          </p>

          {data.skills.length === 0 ? (
            <div className="ins-empty">
              No teaching data yet. After a few lessons and checks, this fills in with the approaches that worked
              best for each skill.
            </div>
          ) : (
            data.skills.map((s) => (
              <div key={s.skill} className="ins-skill">
                <div className="ins-skill-head">
                  <b>{humanizeSkill(s.skill)}</b>
                  {s.topic && <span className="muted">{s.topic}</span>}
                </div>
                {s.stats.map((st, i) => (
                  <div key={`${st.mode}-${st.method}`} className={`ins-row ${i === 0 && st.wins > 0 ? "best" : ""}`}>
                    <span className="ins-mode">
                      <span className="ins-mode-emoji">{st.modeEmoji}</span>
                      <span>{st.modeLabel}</span>
                    </span>
                    <span className="ins-method">{st.methodLabel}</span>
                    <span className="ins-bar">
                      <span className={st.rate >= 70 ? "good" : st.rate >= 40 ? "mid" : "bad"} style={{ width: `${st.rate}%` }} />
                    </span>
                    <span className="ins-rate">{st.rate}%</span>
                    <span className="ins-n">{st.attempts} {st.attempts === 1 ? "try" : "tries"}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>

        <p className="muted ins-foot">
          Prerequisite graph: {data.summary.graph.rows} skill ladder{data.summary.graph.rows === 1 ? "" : "s"} learned
          and reused {data.summary.graph.totalUses} time{data.summary.graph.totalUses === 1 ? "" : "s"}.
        </p>
      </div>
    </div>
  );
}
