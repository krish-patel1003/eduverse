"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import type { Course, CourseMode } from "@/lib/types";

const ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,image/*,application/pdf";

export default function NewCoursePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [goals, setGoals] = useState("");
  const [motivation, setMotivation] = useState("");
  const [mode, setMode] = useState<CourseMode>("self_eval");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Course | null>(null);
  const [approving, setApproving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function buildOutline() {
    if (loading) return;
    if (!topic.trim() && files.length === 0) {
      setError("Add a topic or attach some material.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("topic", topic.trim());
      fd.set("goals", goals);
      fd.set("motivation", motivation.trim());
      fd.set("mode", mode);
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/course/outline", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Outline failed");
      setDraft(data.course);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Outline failed");
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    if (!draft || approving) return;
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/course/${draft.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Approve failed");
      router.push(`/course/${draft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
      setApproving(false);
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
  }

  return (
    <div className="shell">
      <AppNav />
      <div className="page narrow">
        {!draft ? (
          <>
            <header className="page-head">
              <h1>Build a course</h1>
              <p>Tell us what you want to learn. We&apos;ll draft an outline for you to approve.</p>
            </header>

            <div className="form">
              <label className="field">
                <span className="field-label">Topic</span>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Neural networks, the French Revolution, options trading…"
                />
              </label>

              <label className="field">
                <span className="field-label">What do you want to learn? (one goal per line)</span>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={4}
                  placeholder={"Understand how backprop works\nBe able to build a small model\nKnow when to use it"}
                />
              </label>

              <label className="field">
                <span className="field-label">Why do you want this? (optional, helps us motivate you)</span>
                <input
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  placeholder="e.g. for an interview, a class, a project…"
                />
              </label>

              <div className="field">
                <span className="field-label">Course mode</span>
                <div className="mode-pick">
                  <button
                    type="button"
                    className={`mode-opt ${mode === "self_eval" ? "active" : ""}`}
                    onClick={() => setMode("self_eval")}
                  >
                    <span className="mo-ico">🧭</span>
                    <span className="mo-title">Self-evaluation</span>
                    <span className="mo-desc">You're in control. Every module is open from the start, quizzes and assignments are optional. Learn at your own pace.</span>
                  </button>
                  <button
                    type="button"
                    className={`mode-opt ${mode === "certification" ? "active" : ""}`}
                    onClick={() => setMode("certification")}
                  >
                    <span className="mo-ico">🎓</span>
                    <span className="mo-title">Certification</span>
                    <span className="mo-desc">Modules unlock in order. Each has a required quiz and assignment to pass, then a final exam earns a shareable certificate.</span>
                  </button>
                </div>
              </div>

              <div className="field">
                <span className="field-label">Reference material (optional)</span>
                <input ref={fileRef} type="file" multiple accept={ACCEPT} onChange={onPickFiles} hidden />
                <button className="ghost-btn" onClick={() => fileRef.current?.click()}>
                  📎 Attach docs
                </button>
                {files.length > 0 && (
                  <div className="staged">
                    {files.map((f, i) => (
                      <span key={i} className="att-chip">
                        📎 {f.name}
                        <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="err">{error}</div>}

              <button className="send big" onClick={buildOutline} disabled={loading}>
                {loading ? "Designing your outline…" : "Generate outline ▸"}
              </button>
              {loading && (
                <div className="render-bar">
                  <span />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <header className="page-head">
              <h1>{draft.title}</h1>
              <p>Here&apos;s your course outline. Approve it to start, or regenerate.</p>
            </header>

            <ol className="outline">
              {draft.modules.map((m, i) => (
                <li key={m.id} className="outline-item">
                  <div className="oi-num">{i + 1}</div>
                  <div className="oi-body">
                    <div className="oi-title">{m.title}</div>
                    {m.summary && <div className="oi-summary">{m.summary}</div>}
                    {m.objectives.length > 0 && (
                      <ul className="oi-objectives">
                        {m.objectives.map((o, j) => (
                          <li key={j}>{o}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {error && <div className="err">{error}</div>}

            <div className="outline-actions">
              <button className="ghost-btn" onClick={() => setDraft(null)} disabled={approving}>
                ◂ Edit request
              </button>
              <button className="send big" onClick={approve} disabled={approving}>
                {approving ? "Starting…" : "Approve & start ▸"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
