"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import type { LearningStyle, StudentProfile } from "@/lib/types";

const styleLabel = (s: LearningStyle): string[] => {
  const bits: string[] = [];
  if (s.pace) bits.push(`${s.pace} pace`);
  const scale = ["none", "some", "lots", "heavy"];
  if (typeof s.analogies === "number") bits.push(`${scale[Math.min(3, s.analogies)]} analogies`);
  if (typeof s.examples === "number") bits.push(`${scale[Math.min(3, s.examples)]} examples`);
  if (s.tone) bits.push(`${s.tone} tone`);
  if (s.artStyle) bits.push(`${s.artStyle} illustrations`);
  return bits;
};

const timeAgo = (ms: number): string => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const eventLabel: Record<string, string> = {
  quiz: "Answered a quiz question",
  quiz_generated: "Took a quiz",
  assignment: "Got an assignment",
  doubt: "Asked a doubt",
  explain_again: "Asked for a re-explanation",
  module_started: "Started a module",
  module_completed: "Completed a module",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        setProfile(data.profile ?? null);
        setName(data.profile?.name ?? "");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveName() {
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      setProfile(data.profile ?? null);
      setSavedName(true);
      setTimeout(() => setSavedName(false), 1500);
    } catch {
      /* ignore */
    }
  }

  if (loading)
    return (
      <div className="shell">
        <AppNav />
        <div className="page narrow">
          <p className="muted">Loading profile…</p>
        </div>
      </div>
    );

  if (!profile)
    return (
      <div className="shell">
        <AppNav />
        <div className="page narrow">
          <p className="muted">No profile yet. Start a course to build one.</p>
        </div>
      </div>
    );

  const style = styleLabel(profile.learningStyle);

  return (
    <div className="shell">
      <AppNav />
      <div className="page">
        <header className="page-head">
          <h1>Your learning profile</h1>
          <p>Everything the tutor knows about how you learn, updated as you go.</p>
        </header>

        <div className="profile-grid">
          {/* name (used on certificates) */}
          <section className="pcard">
            <h3>Your name</h3>
            <p className="muted small-note">Used on the certificates you earn.</p>
            <div className="name-row">
              <input
                className="name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                placeholder="e.g. Alex Rivera"
              />
              <button className="ghost-btn" onClick={saveName}>{savedName ? "Saved ✓" : "Save"}</button>
            </div>
          </section>

          {/* earned certificates */}
          <section className="pcard">
            <h3>Certificates <span className="count">{profile.certificates.length}</span></h3>
            {profile.certificates.length ? (
              <div className="cert-list">
                {profile.certificates.map((c) => (
                  <a key={c.id} href={`/cert/${c.id}`} className="cert-row">
                    <span className="cert-row-badge">🎓</span>
                    <span className="cert-row-body">
                      <span className="cert-row-title">{c.courseTitle}</span>
                      <span className="cert-row-meta">{c.score}% · {new Date(c.issuedAt).toLocaleDateString()}</span>
                    </span>
                    <span className="cert-row-view">View ▸</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="muted">Finish a certification course to earn one.</p>
            )}
          </section>

          {/* goals + motivation */}
          <section className="pcard">
            <h3>Goals</h3>
            {profile.goals.length ? (
              <ul className="plist">
                {profile.goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No goals set yet.</p>
            )}
            {profile.motivation && (
              <p className="motivation">
                <span className="pk">Motivation:</span> {profile.motivation}
              </p>
            )}
          </section>

          {/* learning style */}
          <section className="pcard">
            <h3>Learning style</h3>
            {style.length ? (
              <div className="tag-row">
                {style.map((s) => (
                  <span key={s} className="tag">{s}</span>
                ))}
              </div>
            ) : (
              <p className="muted">We&apos;ll learn your style as you interact.</p>
            )}
            {profile.learningStyle.notes?.length ? (
              <ul className="plist small">
                {profile.learningStyle.notes.map((n, i) => (
                  <li key={i}>“{n}”</li>
                ))}
              </ul>
            ) : null}
          </section>

          {/* known concepts */}
          <section className="pcard">
            <h3>Known concepts <span className="count">{profile.knownConcepts.length}</span></h3>
            {profile.knownConcepts.length ? (
              <div className="tag-row">
                {profile.knownConcepts.map((c) => (
                  <span key={c.name} className="tag known" title={`strength ${(c.strength * 100).toFixed(0)}%`}>
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">None mastered yet.</p>
            )}
          </section>

          {/* weak concepts */}
          <section className="pcard">
            <h3>Needs reinforcement <span className="count">{profile.weakConcepts.length}</span></h3>
            {profile.weakConcepts.length ? (
              <div className="tag-row">
                {profile.weakConcepts.map((c) => (
                  <span key={c.name} className="tag weak" title={`strength ${(c.strength * 100).toFixed(0)}%`}>
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">Nothing flagged. Quiz yourself to find gaps.</p>
            )}
          </section>

          {/* progress */}
          <section className="pcard">
            <h3>Course progress</h3>
            {profile.progress.length ? (
              <div className="prog-list">
                {profile.progress.map((p) => {
                  const pc = p.total ? Math.round((p.completed / p.total) * 100) : 0;
                  return (
                    <Link key={p.courseId} href={`/course/${p.courseId}`} className="prog-row">
                      <span className="prog-title">{p.title}</span>
                      <span className="cc-bar"><span style={{ width: `${pc}%` }} /></span>
                      <span className="prog-num">{p.completed}/{p.total}</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No courses yet.</p>
            )}
          </section>

          {/* mistakes */}
          <section className="pcard">
            <h3>Recent mistakes <span className="count">{profile.mistakes.length}</span></h3>
            {profile.mistakes.length ? (
              <ul className="plist small">
                {profile.mistakes.slice(0, 8).map((m) => (
                  <li key={m.id}>
                    {m.concept ? <b>{m.concept}</b> : "a question"} · {timeAgo(m.createdAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No mistakes recorded. Keep it up.</p>
            )}
          </section>

          {/* practice history */}
          <section className="pcard wide">
            <h3>Practice history</h3>
            {profile.practiceHistory.length ? (
              <ul className="history">
                {profile.practiceHistory.slice(0, 20).map((e) => (
                  <li key={e.id}>
                    <span className={`hist-dot ${e.isCorrect === false ? "bad" : e.isCorrect ? "good" : ""}`} />
                    <span className="hist-label">{eventLabel[e.type] ?? e.type}</span>
                    {e.concept && <span className="hist-concept">{e.concept}</span>}
                    <span className="hist-time">{timeAgo(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing yet. Your activity will show up here.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
