"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import type { ChildInfo } from "@/components/ChildSwitcher";

const AVATARS = ["🦊", "🐼", "🦉", "🐙", "🦋", "🐬", "🦕", "🐨", "🦁", "🐢", "🦄", "🐧"];

const GRADES = [
  "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5",
  "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
];

export default function ChildrenPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // new-child form
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [grade, setGrade] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/children");
      if (res.status === 401) return router.push("/login");
      const d = await res.json();
      setChildren(d.children ?? []);
      setActiveId(d.activeId ?? "");
    } catch {
      setError("Could not load learners.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, age: age || undefined, educationLevel: grade || undefined, avatar }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Could not add learner");
      // A new learner becomes active, so reload to re-scope the whole app (and
      // refresh the learner chip in the top bar).
      window.location.reload();
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function switchTo(id: string) {
    const res = await fetch("/api/children/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) window.location.reload();
  }

  async function remove(c: ChildInfo) {
    if (!confirm(`Remove ${c.name}? This permanently deletes their lessons, progress and mastery.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/children/${c.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Could not remove learner");
      // Removing the active learner switches scope, so reload to stay consistent.
      if (c.id === activeId) {
        window.location.reload();
        return;
      }
      setChildren(d.children ?? []);
      setActiveId(d.activeId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="shell">
      <AppNav />
      <div className="page">
        <header className="page-head">
          <h1>Learners</h1>
          <p>Each learner has their own lessons, mastery and review schedule.</p>
        </header>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <div className="muted">Loading…</div>
        ) : (
          <div className="kid-grid">
            {children.map((c) => (
              <div key={c.id} className={`kid-card ${c.id === activeId ? "active" : ""}`}>
                <div className="kid-avatar">{c.avatar}</div>
                <div className="kid-name">{c.name}</div>
                <div className="kid-sub">{c.educationLevel || (c.age ? `Age ${c.age}` : "No grade set")}</div>
                <div className="kid-stats">
                  <span>⭐ {c.xp} XP</span>
                  {c.streak > 0 && <span>🔥 {c.streak}</span>}
                </div>
                <div className="kid-actions">
                  {c.id === activeId ? (
                    <span className="kid-badge">Active</span>
                  ) : (
                    <button className="ghost-btn sm" onClick={() => switchTo(c.id)}>Switch to</button>
                  )}
                  {children.length > 1 && (
                    <button className="ghost-btn sm danger" onClick={() => remove(c)}>Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <form className="kid-form" onSubmit={addChild}>
          <h2>Add a learner</h2>
          <div className="kid-avatars">
            {AVATARS.map((a) => (
              <button
                type="button"
                key={a}
                className={`kid-pick ${avatar === a ? "on" : ""}`}
                onClick={() => setAvatar(a)}
                aria-label={`Choose ${a}`}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="kid-fields">
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya" maxLength={80} />
            </label>
            <label>
              <span>Age</span>
              <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="8" inputMode="numeric" />
            </label>
            <label>
              <span>Grade</span>
              <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">Choose…</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="send big" type="submit" disabled={!name.trim() || saving}>
            {saving ? "Adding…" : "+ Add learner"}
          </button>
        </form>
      </div>
    </div>
  );
}
