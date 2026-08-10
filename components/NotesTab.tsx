"use client";

import { useEffect, useState } from "react";
import type { PlayerHandle } from "@/components/ExplainerPlayer";
import type { CourseNote } from "@/lib/types";

interface Props {
  courseId: string;
  moduleId: string;
  playerRef: React.RefObject<PlayerHandle | null>;
}

const fmt = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

// Timestamped, persisted notes for the current module. Stamps the player's
// current position and seeks back to it on click.
export default function NotesTab({ courseId, moduleId, playerRef }: Props) {
  const [notes, setNotes] = useState<CourseNote[]>([]);
  const [text, setText] = useState("");
  const [nowMs, setNowMs] = useState(0);

  const base = `/api/course/${courseId}/module/${moduleId}/notes`;

  useEffect(() => {
    let live = true;
    fetch(base)
      .then((r) => r.json())
      .then((d) => live && setNotes(d.notes ?? []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [base]);

  // Keep the "add at" timestamp label roughly live.
  useEffect(() => {
    const t = setInterval(() => setNowMs(playerRef.current?.getCurrentMs() ?? 0), 500);
    return () => clearInterval(t);
  }, [playerRef]);

  async function add() {
    const t = text.trim();
    if (!t) return;
    const tMs = playerRef.current?.getCurrentMs() ?? 0;
    setText("");
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, tMs }),
      });
      const d = await res.json();
      if (d.note) setNotes((n) => [...n, d.note].sort((a, b) => a.tMs - b.tMs));
    } catch {
      /* ignore */
    }
  }

  async function remove(id: string) {
    setNotes((n) => n.filter((x) => x.id !== id));
    try {
      await fetch(base, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: id }),
      });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="notes-tab">
      <div className="nt-compose">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Jot a note about this moment…"
        />
        <button onClick={add} title="Add note at current time">+ {fmt(nowMs)}</button>
      </div>
      {notes.length === 0 ? (
        <p className="nt-empty">No notes yet. Add one while the video plays and it stamps the timestamp.</p>
      ) : (
        <div className="nt-list">
          {notes.map((n) => (
            <div key={n.id} className="nt-item">
              <button className="nt-ts" onClick={() => playerRef.current?.seekTo(n.tMs)} title="Jump to this moment">
                {fmt(n.tMs)}
              </button>
              <span className="nt-text">{n.text}</span>
              <button className="nt-x" onClick={() => remove(n.id)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
