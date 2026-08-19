"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface ChildInfo {
  id: string;
  name: string;
  avatar: string;
  age?: number;
  educationLevel?: string;
  xp: number;
  streak: number;
}

/**
 * Active-learner chip in the top bar. Switching reloads server data so every
 * surface (dashboard, courses, adaptive sessions) re-scopes to that child.
 */
export default function ChildSwitcher() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/children")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setChildren(d.children ?? []);
        setActiveId(d.activeId ?? "");
      })
      .catch(() => {});
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function select(id: string) {
    if (id === activeId) return setOpen(false);
    setBusy(true);
    try {
      const res = await fetch("/api/children/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setActiveId(id);
        setOpen(false);
        // Server components and cached fetches must re-read under the new scope.
        router.refresh();
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  const active = children.find((c) => c.id === activeId);
  if (!active) return null;

  return (
    <div className="cs" ref={boxRef}>
      <button className="cs-chip" onClick={() => setOpen((v) => !v)} disabled={busy} title="Switch learner">
        <span className="cs-avatar">{active.avatar}</span>
        <span className="cs-name">{active.name}</span>
        <span className="cs-caret">▾</span>
      </button>
      {open && (
        <div className="cs-menu">
          <div className="cs-menu-head">Learners</div>
          {children.map((c) => (
            <button
              key={c.id}
              className={`cs-item ${c.id === activeId ? "on" : ""}`}
              onClick={() => select(c.id)}
            >
              <span className="cs-avatar">{c.avatar}</span>
              <span className="cs-item-text">
                <b>{c.name}</b>
                <small>{c.educationLevel || (c.age ? `Age ${c.age}` : "No grade set")}</small>
              </span>
              {c.id === activeId && <span className="cs-tick">✓</span>}
            </button>
          ))}
          <Link className="cs-manage" href="/children" onClick={() => setOpen(false)}>
            + Add or manage learners
          </Link>
        </div>
      )}
    </div>
  );
}
