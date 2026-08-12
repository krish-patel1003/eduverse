"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import type { Course, StudentProfile } from "@/lib/types";

const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, pRes] = await Promise.all([fetch("/api/courses"), fetch("/api/profile")]);
        const c = await cRes.json();
        const p = await pRes.json();
        setCourses(c.courses ?? []);
        setProfile(p.profile ?? null);
      } catch {
        /* first run: empty */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const done = (course: Course) => course.modules.filter((m) => m.status === "completed").length;

  return (
    <div className="shell">
      <AppNav />
      <div className="page hub">
        <header className="hub-hero">
          <h1>What do you want to learn today?</h1>
          <p>Build a full, adaptive course for yourself, or ask for a single quick explainer.</p>
        </header>

        <div className="mode-cards three">
          <Link href="/adaptive" className="mode-card primary">
            <span className="mode-ico">🧭</span>
            <span className="mode-title">Adaptive Tutor</span>
            <span className="mode-desc">
              We diagnose what you struggle with, then teach and re-teach, testing you until you
              truly master each weak spot.
            </span>
            <span className="mode-cta">Start learning ▸</span>
          </Link>
          <Link href="/course/new" className="mode-card">
            <span className="mode-ico">🎓</span>
            <span className="mode-title">Build a course</span>
            <span className="mode-desc">
              Pick a topic and your goals. We outline it, you approve, then modules unlock one by one
              and adapt to how you learn.
            </span>
            <span className="mode-cta">Start a course ▸</span>
          </Link>
          <Link href="/chat" className="mode-card">
            <span className="mode-ico">✎</span>
            <span className="mode-title">Quick explainer</span>
            <span className="mode-desc">
              Just want one thing explained? Chat a prompt (attach docs if you like) and get a
              narrated hand-drawn video.
            </span>
            <span className="mode-cta">Open chat ▸</span>
          </Link>
        </div>

        {!loading && profile && profile.certificates.length > 0 && (
          <section className="hub-section">
            <h2>Your certificates</h2>
            <div className="badge-row">
              {profile.certificates.map((c) => (
                <Link key={c.id} href={`/cert/${c.id}`} className="badge-card">
                  <span className="badge-emoji">🎓</span>
                  <span className="badge-title">{c.courseTitle}</span>
                  <span className="badge-meta">{c.score}% · verified</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && courses.length > 0 && (
          <section className="hub-section">
            <h2>Continue learning</h2>
            <div className="course-grid">
              {courses.map((c) => {
                const d = done(c);
                const total = c.modules.length;
                const href = c.status === "draft" ? `/course/${c.id}` : `/course/${c.id}`;
                return (
                  <Link key={c.id} href={href} className="course-card">
                    <div className="cc-top">
                      <span className="cc-title">{c.title}</span>
                      <span className={`cc-badge ${c.status}`}>{c.status}</span>
                    </div>
                    <div className="cc-chips">
                      <span className={`cc-mode ${c.mode}`}>
                        {c.mode === "certification" ? "🎓 Certification" : "🧭 Self-eval"}
                      </span>
                    </div>
                    <div className="cc-meta">
                      {d}/{total} modules · {pct(d, total)}%
                    </div>
                    <div className="cc-bar">
                      <span style={{ width: `${pct(d, total)}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {!loading && profile && (
          <section className="hub-section">
            <h2>Your profile</h2>
            <div className="profile-strip">
              <div className="ps-item">
                <span className="ps-num">{profile.knownConcepts.length}</span>
                <span className="ps-label">concepts known</span>
              </div>
              <div className="ps-item">
                <span className="ps-num">{profile.weakConcepts.length}</span>
                <span className="ps-label">to reinforce</span>
              </div>
              <div className="ps-item">
                <span className="ps-num">{profile.practiceHistory.length}</span>
                <span className="ps-label">activities</span>
              </div>
              <div className="ps-item grow">
                <span className="ps-label">weak spots</span>
                <span className="ps-tags">
                  {profile.weakConcepts.slice(0, 5).map((c) => (
                    <span key={c.name} className="tag weak">
                      {c.name}
                    </span>
                  ))}
                  {profile.weakConcepts.length === 0 && <span className="muted">none yet</span>}
                </span>
              </div>
              <Link href="/profile" className="ps-link">
                View profile ▸
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
