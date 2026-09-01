"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNav from "@/components/AppNav";

interface Step {
  id: string;
  idx: number;
  standardCode: string;
  title: string;
  weakAreaId?: string;
  status: "locked" | "available" | "done";
  mastery?: number;
}
interface Path {
  id: string; grade: string; domain: string;
  steps: Step[]; doneCount: number; total: number;
}

const label = (g: string) => (g === "K" ? "Kindergarten" : `Grade ${g}`);

export default function PathPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [path, setPath] = useState<Path | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/paths/${id}`).then((r) => r.json()).then((d) => setPath(d.path ?? null)).catch(() => {});
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function open(step: Step) {
    if (step.status === "locked") return;
    setOpening(step.id);
    setError(null);
    try {
      const res = await fetch(`/api/paths/${id}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: step.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Could not open that step");
      router.push(`/adaptive/${d.weakAreaId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setOpening(null);
    }
  }

  if (!path) {
    return <div className="shell"><AppNav /><div className="page"><p className="muted">Loading…</p></div></div>;
  }

  const pct = path.total ? Math.round((path.doneCount / path.total) * 100) : 0;

  return (
    <div className="shell">
      <AppNav />
      <div className="page">
        <header className="page-head">
          <h1>{path.domain}</h1>
          <p>{label(path.grade)} · {path.doneCount} of {path.total} done</p>
        </header>

        {error && <div className="alert" role="alert"><span className="alert-icon">⚠️</span><span>{error}</span></div>}

        <div className="pth-bar"><span style={{ width: `${pct}%` }} /></div>

        <div className="pth-steps">
          {path.steps.map((s, i) => {
            const isLast = i === path.steps.length - 1;
            return (
              <div key={s.id} className={`pth-step ${s.status}`}>
                <div className="pth-rail">
                  <span className="pth-dot">
                    {s.status === "done" ? "✓" : s.status === "locked" ? "🔒" : i + 1}
                  </span>
                  {!isLast && <span className="pth-line" />}
                </div>

                <div className="pth-body">
                  <div className="pth-top">
                    <span className="pth-code">{s.standardCode}</span>
                    <span className="pth-title">{s.title}</span>
                  </div>
                  {typeof s.mastery === "number" && s.status !== "locked" && (
                    <div className="pth-mastery">
                      <span className="ra-bar">
                        <span className={s.mastery >= 0.8 ? "good" : s.mastery > 0.3 ? "mid" : "bad"}
                              style={{ width: `${Math.round(s.mastery * 100)}%` }} />
                      </span>
                      <span className="muted">{Math.round(s.mastery * 100)}%</span>
                    </div>
                  )}
                  <div className="pth-action">
                    {s.status === "locked" ? (
                      <span className="muted pth-locked">Finish the step above to unlock this</span>
                    ) : (
                      <button
                        className={s.status === "done" ? "ghost-btn sm" : "send"}
                        onClick={() => open(s)}
                        disabled={opening === s.id}
                      >
                        {opening === s.id
                          ? "Opening…"
                          : s.status === "done"
                            ? "Practise again"
                            : s.mastery
                              ? "Continue ▸"
                              : "Start ▸"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="outline-actions">
          <Link className="ghost-btn" href="/adaptive/browse">Pick a different topic</Link>
        </div>
      </div>
    </div>
  );
}
