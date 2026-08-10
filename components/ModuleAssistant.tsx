"use client";

import { useRef, useState } from "react";
import type { Explainer } from "@/lib/types";

// Entries in the Ask-AI chat log.
type Entry =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "answer"; text: string }
  | { id: string; kind: "note"; text: string };

interface Props {
  courseId: string;
  moduleId: string;
  /** A re-explanation swaps the player in the parent. */
  onNewExplainer: (ex: Explainer) => void;
}

function eid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

// The "Ask AI" tab: ask doubts, or ask for a fresh explanation in a certain way
// (which also nudges future modules toward that structural style).
export default function ModuleAssistant({ courseId, moduleId, onNewExplainer }: Props) {
  const [log, setLog] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explainMode, setExplainMode] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const push = (e: Entry) => {
    setLog((l) => [...l, e]);
    requestAnimationFrame(() => {
      const el = logRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  async function call(type: string, body: Record<string, unknown> = {}) {
    const res = await fetch(`/api/course/${courseId}/module/${moduleId}/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Request failed");
    return data;
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    if (explainMode) {
      setBusy("explain");
      push({ id: eid(), kind: "user", text: `Explain again: ${text}` });
      try {
        const data = await call("explain", { request: text });
        push({ id: eid(), kind: "note", text: "New explanation ready above. I'll keep the way you like things explained in mind for later modules." });
        if (data.explainer) onNewExplainer(data.explainer as Explainer);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Explain failed");
      } finally {
        setBusy(null);
        setExplainMode(false);
      }
    } else {
      setBusy("doubt");
      push({ id: eid(), kind: "user", text });
      try {
        const data = await call("doubt", { request: text });
        push({ id: eid(), kind: "answer", text: data.answer ?? "" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Answer failed");
      } finally {
        setBusy(null);
      }
    }
  }

  return (
    <div className="assistant">
      <div className="assistant-log" ref={logRef}>
        {log.length === 0 && (
          <p className="assistant-empty">
            Ask a doubt about this module, or hit <b>Explain differently</b> and describe how you want it
            (simpler, with a specific analogy, more examples). I&apos;ll make a fresh video and adapt to how you learn.
          </p>
        )}
        {log.map((e) => {
          if (e.kind === "user") return <div key={e.id} className="am user">{e.text}</div>;
          if (e.kind === "answer") return <div key={e.id} className="am bot">{e.text}</div>;
          return <div key={e.id} className="am note">{e.text}</div>;
        })}
        {busy && (
          <div className="am bot loading">
            {busy === "doubt" && "Thinking…"}
            {busy === "explain" && "Re-explaining it a fresh way (about a minute)…"}
          </div>
        )}
      </div>

      {error && <div className="err small">{error}</div>}

      <div className="assistant-actions">
        <button onClick={() => setExplainMode((v) => !v)} disabled={!!busy} className={explainMode ? "on" : ""}>
          {explainMode ? "Explaining differently…" : "Explain differently"}
        </button>
      </div>

      <div className="assistant-compose">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={explainMode ? "How should I explain it? e.g. simpler, with a cooking analogy" : "Ask a doubt about this module…"}
        />
        <button onClick={send} disabled={!!busy || !input.trim()}>
          {explainMode ? "Re-explain" : "Ask"}
        </button>
      </div>
    </div>
  );
}
