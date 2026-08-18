"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ExplainerPlayer, { type PlayerHandle } from "@/components/ExplainerPlayer";
import LessonFeedback from "@/components/LessonFeedback";
import AppNav from "@/components/AppNav";
import type { Chat, Explainer, Fidelity, Note, Style } from "@/lib/types";

const ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,image/*,application/pdf";

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

function emptyChat(): Chat {
  return {
    id: uid(),
    title: "New chat",
    messages: [],
    explainers: {},
    currentExplainerId: null,
    notes: [],
  };
}

const fmt = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");

  const [input, setInput] = useState("");
  const [style, setStyle] = useState<Style>("linear");
  const [fidelity, setFidelity] = useState<Fidelity>("fast");
  const [files, setFiles] = useState<File[]>([]);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const [liveMs, setLiveMs] = useState(0);
  const handleTime = useCallback((ms: number) => {
    setLiveMs((prev) => (Math.abs(ms - prev) >= 200 || ms === 0 ? ms : prev));
  }, []);
  const playerRef = useRef<PlayerHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSeek = useRef<{ id: string; ms: number } | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // start with one chat
  useEffect(() => {
    if (chats.length === 0) {
      const c = emptyChat();
      setChats([c]);
      setActiveChatId(c.id);
    }
  }, [chats.length]);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const current = activeChat?.currentExplainerId
    ? activeChat.explainers[activeChat.currentExplainerId]
    : null;
  const notes = activeChat?.notes ?? [];
  const activeLoading = loadingChatId != null && loadingChatId === activeChatId;

  // keep the chat scrolled to the newest message
  const msgCount = activeChat?.messages.length ?? 0;
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgCount, loadingChatId, activeChatId]);

  const updateChat = useCallback((id: string, fn: (c: Chat) => Chat) => {
    setChats((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  // apply a deferred seek once the target explainer is loaded
  useEffect(() => {
    const p = pendingSeek.current;
    if (current && p && p.id === current.id) {
      const ms = p.ms;
      pendingSeek.current = null;
      requestAnimationFrame(() => playerRef.current?.seekTo(ms));
    }
  }, [current]);

  function newChat() {
    const c = emptyChat();
    setChats((prev) => [c, ...prev]);
    setActiveChatId(c.id);
    setCollapsed(false);
    setInput("");
    setFiles([]);
    setError(null);
  }

  async function submit() {
    if (loadingChatId || !activeChatId) return;
    if (!input.trim() && files.length === 0) return;
    const chatId = activeChatId;
    const prompt = input.trim();
    const filesToSend = files;
    const attNames = files.map((f) => f.name);
    setError(null);
    setLoadingChatId(chatId);
    // clear the composer immediately so the chat feels responsive
    setInput("");
    setFiles([]);
    updateChat(chatId, (c) => ({
      ...c,
      title: c.title === "New chat" && prompt ? prompt.slice(0, 42) : c.title,
      messages: [
        ...c.messages,
        {
          id: `u${uid()}`,
          role: "user",
          text: prompt || "(explain the attached files)",
          attachments: attNames.length ? attNames : undefined,
        },
      ],
    }));

    try {
      const fd = new FormData();
      fd.set("prompt", prompt);
      fd.set("style", style);
      fd.set("fidelity", fidelity);
      // Conversation memory: give the planner the recent thread + the explainer
      // on screen, so follow-ups ("simpler", "add examples", "the earlier one")
      // resolve in context instead of inventing a new topic.
      const history = (activeChat?.messages ?? [])
        .map((m) => {
          if (m.role === "user") return `User: ${m.text}`;
          if (m.explainerId) {
            const t = activeChat?.explainers[m.explainerId]?.title;
            return t ? `Assistant: created an explainer titled "${t}"` : null;
          }
          return null;
        })
        .filter((x): x is string => Boolean(x))
        .slice(-8);
      const prevId =
        activeChat?.currentExplainerId ??
        [...(activeChat?.messages ?? [])].reverse().find((m) => m.explainerId)?.explainerId;
      const prev = prevId ? activeChat?.explainers[prevId] : undefined;
      if (history.length || prev) {
        fd.set(
          "context",
          JSON.stringify({
            history,
            lastTitle: prev?.title,
            lastSummary: prev
              ? prev.scenes.map((s) => s.narration).filter(Boolean).join(" ").slice(0, 900)
              : undefined,
          })
        );
      }
      filesToSend.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Generation failed");
      const ex: Explainer = data.explainer;
      updateChat(chatId, (c) => ({
        ...c,
        explainers: { ...c.explainers, [ex.id]: ex },
        currentExplainerId: ex.id,
        messages: [
          ...c.messages,
          { id: `a${uid()}`, role: "assistant", text: ex.title, explainerId: ex.id },
        ],
      }));
      setCollapsed(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      updateChat(chatId, (c) => ({
        ...c,
        messages: [...c.messages, { id: `e${uid()}`, role: "assistant", text: `⚠ ${msg}` }],
      }));
    } finally {
      setLoadingChatId(null);
    }
  }

  const reExplain = useCallback(
    async (focusNarration: string) => {
      if (loadingChatId || !activeChat || !current) return;
      const chatId = activeChat.id;
      setError(null);
      setLoadingChatId(chatId);
      updateChat(chatId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { id: `u${uid()}`, role: "user", text: "Re-explain the part I marked — I didn't get it." },
        ],
      }));
      try {
        const res = await fetch("/api/reexplain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalTitle: current.title,
            style: current.style,
            focusNarration,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Re-explain failed");
        const ex: Explainer = data.explainer;
        updateChat(chatId, (c) => ({
          ...c,
          explainers: { ...c.explainers, [ex.id]: ex },
          currentExplainerId: ex.id,
          messages: [
            ...c.messages,
            { id: `a${uid()}`, role: "assistant", text: ex.title, explainerId: ex.id },
          ],
        }));
        setCollapsed(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Re-explain failed");
      } finally {
        setLoadingChatId(null);
      }
    },
    [loadingChatId, activeChat, current, updateChat]
  );

  function loadExplainer(id: string) {
    if (!activeChatId) return;
    updateChat(activeChatId, (c) => ({ ...c, currentExplainerId: id }));
    setCollapsed(false);
  }

  function addNote() {
    if (!activeChatId || !current || !noteInput.trim()) return;
    const note: Note = {
      id: `n${uid()}`,
      tMs: liveMs,
      text: noteInput.trim(),
      explainerId: current.id,
    };
    updateChat(activeChatId, (c) => ({
      ...c,
      notes: [...c.notes, note].sort((a, b) => a.tMs - b.tMs),
    }));
    setNoteInput("");
  }

  function deleteNote(id: string) {
    if (!activeChatId) return;
    updateChat(activeChatId, (c) => ({ ...c, notes: c.notes.filter((n) => n.id !== id) }));
  }

  function goToNote(note: Note) {
    setCollapsed(false);
    if (current?.id === note.explainerId) {
      playerRef.current?.seekTo(note.tMs);
    } else {
      pendingSeek.current = { id: note.explainerId, ms: note.tMs };
      updateChat(activeChatId, (c) => ({ ...c, currentExplainerId: note.explainerId }));
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    // Capture the files synchronously — reading e.target.files inside the state
    // updater would run after we reset the input below, yielding an empty list.
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
  }

  return (
    <div className="shell">
      <AppNav />
      <div className="app">
        {/* ---- chats rail ---- */}
        <aside className="rail">
          <div className="rail-head">
            <span className="logo">Chats</span>
            <button className="new-chat" onClick={newChat} title="New chat">
              ＋
            </button>
          </div>
          <div className="chat-list">
            {chats.map((c) => (
              <button
                key={c.id}
                className={`chat-item ${c.id === activeChatId ? "active" : ""}`}
                onClick={() => {
                  setActiveChatId(c.id);
                  setCollapsed(false);
                }}
              >
                <span className="ci-title">{c.title}</span>
                {c.messages.length > 0 && <span className="ci-count">{c.messages.length}</span>}
              </button>
            ))}
          </div>
        </aside>

        {/* ---- center: collapsible player + chat ---- */}
        <main className="center">
          {current && (
            <div className={`dock ${collapsed ? "is-collapsed" : ""}`}>
              <div className="dock-head">
                <button className="collapse-btn" onClick={() => setCollapsed((v) => !v)}>
                  {collapsed ? "▸" : "▾"}
                </button>
                <span className="dock-ico">▶</span>
                <span className="dock-title">{current.title}</span>
                <span className="dock-sub">{collapsed ? "expand" : "collapse"}</span>
              </div>
              {!collapsed && (
                <div className="dock-body">
                  <ExplainerPlayer
                    ref={playerRef}
                    explainer={current}
                    onTimeUpdate={handleTime}
                    onReExplain={reExplain}
                  />
                  <LessonFeedback key={current.id} explainerId={current.id} context="chat" />
                </div>
              )}
            </div>
          )}

          <div className="chat">
            <div className="messages" ref={messagesRef}>
              {(!activeChat || activeChat.messages.length === 0) && (
                <div className="empty">
                  <div className="empty-art">✎</div>
                  <h1>Ask anything — I&apos;ll draw you an explainer</h1>
                  <p>
                    Type a prompt (attach a PDF, doc, sheet, or image if you like), pick a
                    style, and press <b>Generate</b>. Your narrated hand-drawn video appears
                    above the chat — collapse it any time to keep talking.
                  </p>
                </div>
              )}
              {activeChat?.messages.map((m) => (
                <div key={m.id} className={`msg ${m.role}`}>
                  {m.role === "assistant" && m.explainerId ? (
                    <button
                      className={`ex-card ${current?.id === m.explainerId ? "active" : ""}`}
                      onClick={() => loadExplainer(m.explainerId!)}
                    >
                      <span className="ex-ico">▶</span>
                      <span className="ex-title">{m.text}</span>
                    </button>
                  ) : (
                    <div className="bubble">
                      {m.text}
                      {m.attachments && (
                        <div className="att-line">
                          {m.attachments.map((a) => (
                            <span key={a} className="att-chip mini">
                              📎 {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {activeLoading && (
                <div className="msg assistant">
                  <div className="render-card">
                    <div className="render-title">✎ Drawing your explainer…</div>
                    <div className="render-sub">
                      {fidelity === "hifi"
                        ? "Drawing every scene stroke by stroke, layer by layer. This takes several minutes."
                        : "Generating the illustrations and narration, this takes about a minute."}
                    </div>
                    <div className="render-bar">
                      <span />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* composer */}
            <div className="composer">
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
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Explain photosynthesis… or how a transformer works…  (Enter to send, Shift+Enter for a new line)"
                rows={2}
              />
              <div className="composer-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  onChange={onPickFiles}
                  hidden
                />
                <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Attach">
                  📎
                </button>
                <select
                  value={fidelity}
                  onChange={(e) => setFidelity(e.target.value as Fidelity)}
                  className="style-select"
                  title="Hand-drawn draws every scene stroke by stroke. Much slower."
                >
                  <option value="fast">Standard</option>
                  <option value="hifi">Hand-drawn (slow)</option>
                </select>
                <select value={style} onChange={(e) => setStyle(e.target.value as Style)} className="style-select">
                  <option value="linear">Linear</option>
                  <option value="interactive">Interactive</option>
                </select>
                <button className="send" onClick={submit} disabled={!!loadingChatId}>
                  {activeLoading ? "…" : "Generate ▸"}
                </button>
              </div>
              {error && <div className="err">{error}</div>}
            </div>
          </div>
        </main>

        {/* ---- notes ---- */}
        <aside className="notes">
          <div className="notes-head">Notes</div>
          {current ? (
            <div className="note-compose">
              <input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                placeholder="Note at current time…"
              />
              <button onClick={addNote} title="Add note at current timestamp">
                + {fmt(liveMs)}
              </button>
            </div>
          ) : (
            <p className="notes-empty">Notes appear once an explainer is playing.</p>
          )}
          <div className="note-list">
            {current && notes.length === 0 && (
              <p className="notes-empty">
                No notes yet. Jot one while it plays — it&apos;ll stamp the timestamp.
              </p>
            )}
            {notes.map((n) => {
              const vidTitle = activeChat?.explainers[n.explainerId]?.title ?? "Explainer";
              return (
                <div key={n.id} className="note">
                  <div className="note-top">
                    <button className="note-ts" onClick={() => goToNote(n)}>
                      {fmt(n.tMs)}
                    </button>
                    <span className="note-vid" title={vidTitle}>
                      {vidTitle}
                    </span>
                    <button className="note-x" onClick={() => deleteNote(n.id)}>
                      ×
                    </button>
                  </div>
                  <span className="note-text" title={n.text}>
                    {n.text}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
