"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import type { Diagnostic, WeakArea } from "@/lib/types";

interface Data {
  profile: { name?: string; educationLevel?: string; age?: number };
  diagnostics: Diagnostic[];
  weakAreas: WeakArea[];
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
        <header className="page-head">
          <h1>Adaptive Tutor</h1>
          <p>
            {data.profile.name ? `${data.profile.name} · ` : ""}
            {data.profile.educationLevel ?? "Finish your profile to calibrate everything to your level."}
          </p>
        </header>

        {noProfile && (
          <div className="cert-banner exam">
            <span className="cb-badge">🧭</span>
            <div className="cb-text"><b>Build your profile</b><span>Answer a few questions and take a diagnostic.</span></div>
            <button className="send" onClick={() => router.push("/onboarding")}>Start ▸</button>
          </div>
        )}

        <div className="adaptive-actions">
          <button className="send big" onClick={() => router.push("/onboarding")}>+ Diagnose a new topic</button>
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
                            <span className="wa-aspect">{w.aspect}</span>
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
