"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";

interface Standard { code: string; grade: string; domain: string; cluster: string; skill: string }
interface Cluster { cluster: string; standards: Standard[] }
interface Domain { domain: string; clusters: Cluster[] }
interface Data {
  grade: string;
  grades: string[];
  domains: Domain[];
  stats: { total: number; grades: number };
  attribution: string;
}

const label = (g: string) => (g === "K" ? "Kindergarten" : `Grade ${g}`);

// High school standards are published across the whole 9-12 band, not by grade.
// The grade shown is the typical US course placement, so say which course.
const HS_COURSE: Record<string, string> = {
  "9": "Algebra 1",
  "10": "Geometry",
  "11": "Algebra 2",
  "12": "Precalculus",
};

export default function CurriculumPage() {
  const [grade, setGrade] = useState("4");
  const [data, setData] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Standard[] | null>(null);

  const load = useCallback((g: string) => {
    fetch(`/api/standards?grade=${g}`).then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  useEffect(() => { load(grade); }, [grade, load]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/standards?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!data) {
    return <div className="shell"><AppNav /><div className="page"><p className="muted">Loading…</p></div></div>;
  }

  const shown = results ?? null;

  return (
    <div className="shell">
      <AppNav />
      <div className="page">
        <header className="page-head">
          <h1>Curriculum</h1>
          <p>
            {data.stats.total} skills across {data.stats.grades} grades, following the US Common Core sequence.
            Pick any skill to have the tutor teach it.
          </p>
        </header>

        <input
          className="cur-search"
          placeholder="Search skills, e.g. long division, fractions, 4.NBT"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {!shown && HS_COURSE[grade] && (
          <p className="muted cur-course-note">
            High school standards are published across the whole 9 to 12 band rather than by grade. These are the ones
            typically taught in <b>{HS_COURSE[grade]}</b>.
          </p>
        )}

        {!shown && (
          <div className="cur-grades">
            {data.grades.map((g) => (
              <button
                key={g}
                className={`cur-grade ${g === grade ? "on" : ""} ${HS_COURSE[g] ? "hs" : ""}`}
                onClick={() => setGrade(g)}
                title={HS_COURSE[g] ? `${label(g)} · typically ${HS_COURSE[g]}` : label(g)}
              >
                {g === "K" ? "K" : g}
              </button>
            ))}
          </div>
        )}

        {shown ? (
          <section className="hub-section">
            <h2>{shown.length} match{shown.length === 1 ? "" : "es"}</h2>
            {shown.map((s) => (
              <StandardRow key={s.code} s={s} showGrade />
            ))}
            {shown.length === 0 && <p className="muted">Nothing matched. Try a different word.</p>}
          </section>
        ) : (
          data.domains.map((d) => (
            <section key={d.domain} className="cur-domain">
              <h2>{d.domain}</h2>
              {d.clusters.map((c) => (
                <div key={c.cluster} className="cur-cluster">
                  <div className="cur-cluster-name">{c.cluster}</div>
                  {c.standards.map((s) => (
                    <StandardRow key={s.code} s={s} />
                  ))}
                </div>
              ))}
            </section>
          ))
        )}

        <p className="muted cur-attrib">{data.attribution}</p>
      </div>
    </div>
  );
}

function StandardRow({ s, showGrade }: { s: Standard; showGrade?: boolean }) {
  const [prereqs, setPrereqs] = useState<Standard[] | null>(null);
  const [open, setOpen] = useState(false);

  async function togglePrereqs() {
    setOpen((o) => !o);
    if (prereqs) return;
    const d = await fetch(`/api/standards?ladder=${encodeURIComponent(s.code)}`).then((r) => r.json()).catch(() => null);
    setPrereqs(d?.prerequisites ?? []);
  }

  return (
    <>
    <div className="cur-row">
      <span className="cur-code">{s.code}</span>
      <span className="cur-skill">
        {s.skill}
        {showGrade && <span className="cur-grade-tag">{label(s.grade)}</span>}
      </span>
      <button className="ghost-btn sm" onClick={togglePrereqs} title="What comes before this?">
        {open ? "Hide steps" : "Before this"}
      </button>
      <Link
        className="ghost-btn sm"
        href={`/onboarding?topic=${encodeURIComponent(s.skill)}&code=${encodeURIComponent(s.code)}&grade=${encodeURIComponent(s.grade)}`}
      >
        Teach me this
      </Link>
    </div>
    {open && (
      <div className="cur-prereqs">
        {prereqs === null ? (
          <span className="muted">Loading…</span>
        ) : prereqs.length === 0 ? (
          <span className="muted">No mapped prerequisites. The tutor will work them out from the learner&apos;s answers.</span>
        ) : (
          <>
            <div className="cur-prereqs-h">Needs first, easiest to hardest</div>
            {prereqs.map((p) => (
              <div key={p.code} className="cur-prereq">
                <span className="cur-code">{p.code}</span>
                <span>{p.skill}</span>
                <span className="cur-grade-tag">{label(p.grade)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    )}
    </>
  );
}
