"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import AssessmentRunner, { type PublicItem } from "@/components/AssessmentRunner";
import ReportView from "@/components/ReportView";

const EDUCATION = [
  "Primary school (grades 1-5)",
  "Middle school (grades 6-8)",
  "High school (grades 9-12)",
  "Undergraduate",
  "Graduate",
  "Professional / self-taught",
];

type Step = "info" | "topic" | "diagnostic" | "report";

interface Report {
  overall: number;
  rank: string;
  perAspect: { aspect: string; score: number }[];
  weakAspects: string[];
  summary: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [education, setEducation] = useState("");
  const [topic, setTopic] = useState("");
  const [items, setItems] = useState<PublicItem[]>([]);
  const [diagnosticId, setDiagnosticId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Require login; skip the info step if the profile is already set up.
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) {
        router.push("/signup");
        return;
      }
      if (d.profile?.educationLevel) {
        setName(d.profile.name ?? "");
        setEducation(d.profile.educationLevel);
        setStep("topic");
      }
    });
  }, [router]);

  async function saveInfo() {
    if (!name.trim() || !education) {
      setError("Please add your name and education level.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), age, gender, educationLevel: education }),
      });
      setStep("topic");
    } finally {
      setBusy(false);
    }
  }

  async function startDiagnostic() {
    if (!topic.trim()) {
      setError("Name something you find difficult.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/adaptive/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not build the questionnaire");
      setItems(data.items);
      setDiagnosticId(data.diagnosticId);
      setStep("diagnostic");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitDiagnostic(answers: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/adaptive/diagnostic/${diagnosticId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Grading failed");
      setReport(data);
      setStep("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <AppNav />
      <div className="page narrow">
        <div className="onboard-steps">
          {(["info", "topic", "diagnostic", "report"] as Step[]).map((s, i) => (
            <span key={s} className={`ob-step ${step === s ? "active" : ""} ${["info", "topic", "diagnostic", "report"].indexOf(step) > i ? "done" : ""}`}>
              {i + 1}
            </span>
          ))}
        </div>

        {step === "info" && (
          <>
            <header className="page-head"><h1>Tell us about you</h1><p>This helps us pitch everything at the right level.</p></header>
            <div className="form">
              <label className="field"><span className="field-label">Your name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Rivera" />
              </label>
              <div className="form-row">
                <label className="field"><span className="field-label">Age</span>
                  <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 20" />
                </label>
                <label className="field"><span className="field-label">Gender (optional)</span>
                  <input value={gender} onChange={(e) => setGender(e.target.value)} placeholder="optional" />
                </label>
              </div>
              <label className="field"><span className="field-label">Education level</span>
                <select value={education} onChange={(e) => setEducation(e.target.value)} className="style-select">
                  <option value="">Select…</option>
                  {EDUCATION.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </label>
              {error && <div className="err">{error}</div>}
              <button className="send big" onClick={saveInfo} disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
            </div>
          </>
        )}

        {step === "topic" && (
          <>
            <header className="page-head"><h1>What do you struggle with?</h1><p>Name a subject, topic, or domain. We&apos;ll build a diagnostic calibrated to your level.</p></header>
            <div className="form">
              <label className="field"><span className="field-label">Topic you find difficult</span>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startDiagnostic()} placeholder="e.g. Fractions, Recursion, Essay writing…" />
              </label>
              {error && <div className="err">{error}</div>}
              <button className="send big" onClick={startDiagnostic} disabled={busy}>{busy ? "Building your questionnaire…" : "Start the diagnostic ▸"}</button>
              {busy && <div className="render-bar"><span /></div>}
            </div>
          </>
        )}

        {step === "diagnostic" && (
          <AssessmentRunner
            items={items}
            onSubmit={submitDiagnostic}
            submitting={busy}
            submitLabel="Submit diagnostic ▸"
            title={`Diagnostic: ${topic}`}
            subtitle="Answer what you can. It's fine to be unsure, this just maps where you stand."
          />
        )}

        {step === "report" && report && (
          <>
            <header className="page-head"><h1>Your initial assessment</h1><p>Here&apos;s where you stand on <b>{topic}</b>.</p></header>
            <ReportView report={report} />
            <div className="outline-actions">
              <button className="send big" onClick={() => router.push("/adaptive")}>Go to my tutor ▸</button>
            </div>
          </>
        )}
        {error && step !== "info" && step !== "topic" && <div className="err">{error}</div>}
      </div>
    </div>
  );
}
